"""
app/api/feedback.py - In-app feedback (bug reports, feature requests, etc.)

Replaces WhatsApp-DM feedback with a proper queue. Any signed-in student can
submit; only reviewers in ADMIN_USER_IDS (see app/api/deps.require_admin)
can list, triage, or delete entries - submission and triage are
deliberately separate permission levels since every beta tester needs the
first but only one or two people need the second.

Screenshots are uploaded separately from the feedback body (POST
/feedback/screenshot) because the frontend captures the image
client-side (html2canvas) as a standalone step before the rest of the
form is necessarily filled in - decoupling upload from submission avoids
holding a multi-megabyte image in form state while the student is still
typing.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.api.deps import require_admin
from app.api.schemas import FeedbackCreate, FeedbackOut, FeedbackUpdate
from app.auth import get_current_user_id
from app.config import FEEDBACK_UPLOAD_DIR
from app.db.models import Feedback
from app.db.repository import repository
from app.rate_limit import rate_limit
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/feedback", tags=["feedback"])

_ALLOWED_CATEGORIES = {
    "bug", "feature", "performance", "ai_response",
    "ui_ux", "study_plan", "question_generation", "other",
}
_ALLOWED_SEVERITIES = {"low", "medium", "high", "critical"}
_ALLOWED_STATUSES = {"new", "open", "in_progress", "resolved", "closed"}
_ALLOWED_SCREENSHOT_TYPES = {"image/png", "image/jpeg", "image/webp"}
_MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024  # 5 MB - a viewport screenshot, not a photo dump


def _reference_id(feedback_id: int) -> str:
    return f"SPD-{feedback_id:06d}"


def _to_out(fb: Feedback) -> FeedbackOut:
    return FeedbackOut(
        id=fb.id,
        reference_id=_reference_id(fb.id),
        category=fb.category,
        title=fb.title,
        description=fb.description,
        expected_behavior=fb.expected_behavior,
        actual_behavior=fb.actual_behavior,
        severity=fb.severity,
        status=fb.status,
        priority=fb.priority,
        screenshot_url=fb.screenshot_url,
        metadata=fb.metadata_json or {},
        created_at=fb.created_at,
        updated_at=fb.updated_at,
    )


@router.post("/screenshot")
async def upload_screenshot(
    file: UploadFile,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("feedback_screenshot", max_calls=20, window_seconds=300)),
):
    """Saves a client-captured screenshot and returns the URL to reference
    in the feedback body's `screenshot_url` field. Standalone from
    POST /feedback so a slow or failed upload never blocks the rest of
    the form."""
    if file.content_type not in _ALLOWED_SCREENSHOT_TYPES:
        raise HTTPException(400, f"Unsupported image type '{file.content_type}' - use PNG, JPEG, or WebP")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "Empty file")
    if len(file_bytes) > _MAX_SCREENSHOT_BYTES:
        raise HTTPException(400, f"Screenshot exceeds the {_MAX_SCREENSHOT_BYTES // (1024*1024)} MB limit")

    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[file.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = Path(FEEDBACK_UPLOAD_DIR) / filename
    path.write_bytes(file_bytes)

    return {"screenshot_url": f"/feedback-uploads/{filename}"}


@router.post("", response_model=FeedbackOut)
def submit_feedback(
    body: FeedbackCreate,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("feedback_submit", max_calls=20, window_seconds=300)),
):
    if body.category not in _ALLOWED_CATEGORIES:
        raise HTTPException(422, f"Invalid category - expected one of {sorted(_ALLOWED_CATEGORIES)}")
    if body.severity not in _ALLOWED_SEVERITIES:
        raise HTTPException(422, f"Invalid severity - expected one of {sorted(_ALLOWED_SEVERITIES)}")
    if not body.title.strip():
        raise HTTPException(422, "Title is required")
    if not body.description.strip():
        raise HTTPException(422, "Description is required")

    fb = repository.create_feedback(
        user_id=user_id,
        category=body.category,
        title=body.title.strip(),
        description=body.description.strip(),
        expected_behavior=body.expected_behavior,
        actual_behavior=body.actual_behavior,
        severity=body.severity,
        screenshot_url=body.screenshot_url,
        metadata=body.metadata,
    )
    logger.info("Feedback %s submitted by %s (category=%s, severity=%s)",
                _reference_id(fb.id), user_id, fb.category, fb.severity)
    return _to_out(fb)


@router.get("", response_model=list[FeedbackOut])
def list_feedback(
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    user: str | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
    _admin: str = Depends(require_admin),
):
    if status and status not in _ALLOWED_STATUSES:
        raise HTTPException(422, f"Invalid status - expected one of {sorted(_ALLOWED_STATUSES)}")
    rows = repository.list_feedback(
        status=status,
        priority=priority,
        category=category,
        user_id=user,
        search=search,
        created_after=date_from,
        created_before=date_to,
        limit=min(limit, 200),
        offset=offset,
    )
    return [_to_out(fb) for fb in rows]


@router.get("/{feedback_id}", response_model=FeedbackOut)
def get_feedback(feedback_id: int, _admin: str = Depends(require_admin)):
    fb = repository.get_feedback(feedback_id)
    if fb is None:
        raise HTTPException(404, "Feedback not found")
    return _to_out(fb)


@router.patch("/{feedback_id}", response_model=FeedbackOut)
def update_feedback(feedback_id: int, body: FeedbackUpdate, _admin: str = Depends(require_admin)):
    if body.status and body.status not in _ALLOWED_STATUSES:
        raise HTTPException(422, f"Invalid status - expected one of {sorted(_ALLOWED_STATUSES)}")
    if body.severity and body.severity not in _ALLOWED_SEVERITIES:
        raise HTTPException(422, f"Invalid severity - expected one of {sorted(_ALLOWED_SEVERITIES)}")

    fb = repository.update_feedback(
        feedback_id,
        status=body.status,
        priority=body.priority,
        severity=body.severity,
    )
    if fb is None:
        raise HTTPException(404, "Feedback not found")
    return _to_out(fb)


@router.delete("/{feedback_id}", status_code=204)
def delete_feedback(feedback_id: int, _admin: str = Depends(require_admin)):
    if not repository.delete_feedback(feedback_id):
        raise HTTPException(404, "Feedback not found")
