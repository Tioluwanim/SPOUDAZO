"""
app/api/materials.py - Upload course material (PDF/DOCX/etc), run it
through the ported ingestion pipeline (extract → chunk → embed → index),
and attach it to a course.

Runs in the background: the upload endpoint returns as soon as the file
is saved and a Document row exists (fast - a few hundred ms), and the
slow extract → embed → index pipeline (which can take from seconds to
several minutes, especially on a cold BGE-M3 model load) runs after the
response via FastAPI's BackgroundTasks. The frontend polls
GET /courses/{id}/materials to see the status move from "uploaded" ->
"extracting" -> "embedding" -> "ready" (or "failed").

BackgroundTasks runs in the same process as the request, not a separate
worker - it's the right amount of infrastructure for this app's current
scale (no Redis/Celery needed), but it does mean a server restart mid-
processing loses that job. Revisit with a real task queue if that
becomes a real problem in practice.
"""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import require_course_owner, require_document_owner
from app.api.schemas import (
    AnnotationCreate,
    AnnotationOut,
    DocumentSectionOut,
    FavoriteToggleOut,
    MaterialDetailOut,
    MaterialOut,
    ReadingProgressIn,
    ReadingProgressOut,
    TextActionRequest,
    TextActionResponse,
)
from app.agents.text_actions import ALL_ACTIONS, run_text_action
from app.auth import get_current_user_id
from app.db.repository import repository
from app.models.schemas import DocumentStatus
from app.rate_limit import rate_limit
from app.services.extraction_service import extraction_service
from app.services.pdf_service import pdf_service
from app.services.rag_service import rag_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/courses/{course_id}/materials", tags=["materials"])


def _process_material(doc_id: str) -> None:
    """Runs in the background after the upload response has already been
    sent. Any failure here is captured on the Document's own status/error
    fields (visible to the frontend via polling) - there's no request
    left to raise an HTTPException into."""
    doc = pdf_service.load_document(doc_id)
    if doc is None:
        logger.error("Background processing: document %s vanished before processing started", doc_id)
        return

    try:
        doc = extraction_service.process(doc)
        pdf_service.save_document(doc)
        if doc.status == DocumentStatus.FAILED:
            logger.error("Background extraction failed for %s: %s", doc_id, doc.error_message)
            return

        # Persist "embedding" BEFORE the slow call, not after - build_index()
        # sets this same status on the in-memory object internally, but that
        # change is invisible to anyone polling the DB until build_index
        # returns. On a cold BGE-M3 load that can be many minutes, during
        # which the frontend would otherwise show a stale "extracted" badge
        # with no signal that anything is actually happening.
        doc.status = DocumentStatus.EMBEDDING
        pdf_service.save_document(doc)

        doc = rag_service.build_index(doc)
        pdf_service.save_document(doc)
        if doc.status == DocumentStatus.FAILED:
            logger.error("Background indexing failed for %s: %s", doc_id, doc.error_message)
    except Exception as e:
        # Belt-and-suspenders: extraction_service/rag_service are expected
        # to catch their own errors and set status=FAILED, but a background
        # task that raises uncaught just disappears silently otherwise -
        # make sure the Document record reflects the failure either way.
        logger.exception("Unexpected error during background processing of %s", doc_id)
        doc.status = DocumentStatus.FAILED
        doc.error_message = str(e)
        pdf_service.save_document(doc)


@router.post("", response_model=MaterialOut)
async def upload_material(
    course_id: int,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    week_number: int | None = Form(default=None),
    user_id: str = Depends(get_current_user_id),
):
    require_course_owner(course_id, user_id)

    file_bytes = await file.read()
    checksum = hashlib.sha256(file_bytes).hexdigest()

    # Same content already processed in this course (double-click, retry
    # after a refresh, the same lecture note re-uploaded) - hand back the
    # existing material instead of re-extracting/re-embedding/re-indexing
    # content that's already there.
    existing = repository.get_ready_document_by_checksum(course_id, checksum)
    if existing:
        logger.info("Upload for course %s matched existing document %s by checksum - skipping reprocessing",
                    course_id, existing.doc_id)
        return MaterialOut(
            doc_id=existing.doc_id,
            filename=existing.filename,
            status=existing.status,
            chunk_count=existing.chunk_count,
            week_number=existing.week_number if week_number is None else week_number,
        )

    doc, error = pdf_service.save_upload(file_bytes, file.filename, checksum=checksum)
    if error:
        raise HTTPException(400, error.detail or error.error)

    repository.attach_document_to_course(doc.doc_id, course_id, week_number=week_number)
    background_tasks.add_task(_process_material, doc.doc_id)

    return MaterialOut(
        doc_id=doc.doc_id,
        filename=doc.filename,
        status=doc.status.value,
        chunk_count=doc.chunk_count,
        week_number=week_number,
    )


@router.get("", response_model=list[MaterialOut])
def list_materials(course_id: int, user_id: str = Depends(get_current_user_id)):
    require_course_owner(course_id, user_id)
    # One query for everything this view needs, instead of the previous
    # per-document loop through pdf_service.load_document() (see
    # repository.list_materials_summary for why that was expensive).
    rows = repository.list_materials_summary(course_id)
    return [
        MaterialOut(
            doc_id=r["doc_id"],
            filename=r["filename"],
            status=r["status"],
            chunk_count=r["chunk_count"],
            week_number=r["week_number"],
        )
        for r in rows
    ]


@router.get("/{doc_id}", response_model=MaterialDetailOut)
def get_material(course_id: int, doc_id: str, user_id: str = Depends(get_current_user_id)):
    """Powers the Smart Library reading pane - the structured content of one
    document (title + sections with page ranges), not the raw file. Sections
    already exist from the extraction pipeline; this just exposes them
    instead of re-deriving anything."""
    document = _require_readable_document(course_id, doc_id, user_id)
    processed = pdf_service.load_document(doc_id)
    if processed is None:
        raise HTTPException(404, "Document not found")

    return MaterialDetailOut(
        doc_id=processed.doc_id,
        filename=processed.filename,
        status=processed.status.value,
        week_number=document.week_number,
        course_id=course_id,
        page_count=processed.metadata.page_count,
        word_count=processed.metadata.word_count,
        sections=[
            DocumentSectionOut(
                title=s.title,
                content=s.content,
                section_type=s.section_type.value,
                page_start=s.page_start,
                page_end=s.page_end,
            )
            for s in processed.sections
        ],
    )


def _require_readable_document(course_id: int, doc_id: str, user_id: str):
    """Shared by every reader endpoint below - the document must exist,
    belong to this course, be owned by this user, AND be fully processed.
    Annotations/favorites/progress/text-actions on a still-processing
    document don't make sense (there's nothing stable to anchor a
    section_index to yet), so this is stricter than require_document_owner
    alone."""
    require_course_owner(course_id, user_id)
    document = require_document_owner(doc_id, user_id)
    if document.course_id != course_id:
        raise HTTPException(404, "Document not found")
    if document.status != DocumentStatus.READY.value:
        raise HTTPException(
            409,
            f"Document is still processing (status: {document.status}) - "
            "try again once it finishes.",
        )
    return document


# ── Annotations (highlights & bookmarks) ────────────────────────────────────

@router.post("/{doc_id}/annotations", response_model=AnnotationOut)
def create_annotation(
    course_id: int, doc_id: str, body: AnnotationCreate,
    user_id: str = Depends(get_current_user_id),
):
    _require_readable_document(course_id, doc_id, user_id)
    if body.kind not in ("highlight", "bookmark"):
        raise HTTPException(422, "kind must be 'highlight' or 'bookmark'")
    if not body.quote.strip():
        raise HTTPException(422, "quote cannot be empty")

    ann = repository.create_annotation(
        user_id=user_id, doc_id=doc_id, kind=body.kind,
        section_index=body.section_index, quote=body.quote.strip(),
        note=body.note.strip() if body.note else None,
    )
    return AnnotationOut(
        id=ann.id, doc_id=ann.doc_id, kind=ann.kind, section_index=ann.section_index,
        quote=ann.quote, note=ann.note, created_at=ann.created_at,
    )


@router.get("/{doc_id}/annotations", response_model=list[AnnotationOut])
def list_annotations(
    course_id: int, doc_id: str, kind: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    _require_readable_document(course_id, doc_id, user_id)
    rows = repository.list_annotations(user_id, doc_id, kind=kind)
    return [
        AnnotationOut(
            id=a.id, doc_id=a.doc_id, kind=a.kind, section_index=a.section_index,
            quote=a.quote, note=a.note, created_at=a.created_at,
        )
        for a in rows
    ]


@router.delete("/{doc_id}/annotations/{annotation_id}", status_code=204)
def delete_annotation(
    course_id: int, doc_id: str, annotation_id: int,
    user_id: str = Depends(get_current_user_id),
):
    _require_readable_document(course_id, doc_id, user_id)
    ann = repository.get_annotation(annotation_id)
    if ann is None or ann.doc_id != doc_id or ann.user_id != user_id:
        raise HTTPException(404, "Annotation not found")
    repository.delete_annotation(annotation_id)


# ── Favorites ────────────────────────────────────────────────────────────────

@router.post("/{doc_id}/favorite", response_model=FavoriteToggleOut)
def toggle_favorite(course_id: int, doc_id: str, user_id: str = Depends(get_current_user_id)):
    require_course_owner(course_id, user_id)
    document = require_document_owner(doc_id, user_id)
    if document.course_id != course_id:
        raise HTTPException(404, "Document not found")
    favorited = repository.toggle_favorite(user_id, doc_id)
    return FavoriteToggleOut(doc_id=doc_id, favorited=favorited)


# ── Reading progress ─────────────────────────────────────────────────────────

# ── Reading progress ─────────────────────────────────────────────────────────

@router.get("/{doc_id}/progress", response_model=ReadingProgressOut | None)
def get_reading_progress(course_id: int, doc_id: str, user_id: str = Depends(get_current_user_id)):
    _require_readable_document(course_id, doc_id, user_id)
    row = repository.get_reading_progress(user_id, doc_id)
    if row is None:
        return None
    return ReadingProgressOut(
        doc_id=doc_id, last_section_index=row.last_section_index,
        progress_percent=row.progress_percent, last_viewed_at=row.last_viewed_at,
    )


@router.put("/{doc_id}/progress", response_model=ReadingProgressOut)
def update_reading_progress(
    course_id: int, doc_id: str, body: ReadingProgressIn,
    user_id: str = Depends(get_current_user_id),
):
    _require_readable_document(course_id, doc_id, user_id)
    if not (0 <= body.progress_percent <= 100):
        raise HTTPException(422, "progress_percent must be between 0 and 100")
    row = repository.upsert_reading_progress(
        user_id, doc_id, body.last_section_index, body.progress_percent,
    )
    # Cap a single delta at 10 minutes - a stale browser tab reporting a
    # huge gap (laptop was asleep, tab was backgrounded for hours) should
    # not count as ten hours of actual reading.
    repository.record_reading_activity(user_id, min(body.seconds_delta, 600))
    return ReadingProgressOut(
        doc_id=doc_id, last_section_index=row.last_section_index,
        progress_percent=row.progress_percent, last_viewed_at=row.last_viewed_at,
    )


# ── Highlight-to-ask AI actions ──────────────────────────────────────────────

@router.post("/{doc_id}/text-action", response_model=TextActionResponse)
def text_action(
    course_id: int, doc_id: str, body: TextActionRequest,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("reader_text_action", max_calls=60, window_seconds=300)),
):
    """Backs the reader's highlight-to-ask toolbar - explain / simplify /
    example / analogy / summarize / mnemonic / flashcards / key points.
    See app/agents/text_actions.py for the full action list and why
    quiz/theory/CBT-from-selection and Visualize aren't here yet."""
    require_course_owner(course_id, user_id)
    document = _require_readable_document(course_id, doc_id, user_id)

    if body.action not in ALL_ACTIONS:
        raise HTTPException(422, f"Unknown action - expected one of {sorted(ALL_ACTIONS)}")
    if not body.selected_text.strip():
        raise HTTPException(422, "No text selected")
    if len(body.selected_text) > 6000:
        raise HTTPException(422, "Selected text is too long - try a shorter passage")

    course = repository.get_course(course_id)
    course_context = f"{course.code} {course.name}" if course else ""

    try:
        outcome = run_text_action(
            action=body.action,
            selected_text=body.selected_text,
            doc_id=doc_id,
            section_title=body.section_title,
            course_context=course_context,
            target_language=body.target_language,
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error(f"[{doc_id}] text-action '{body.action}' failed: {e}", exc_info=True)
        raise HTTPException(502, "The study assistant couldn't process that - try again")

    return TextActionResponse(action=body.action, kind=outcome["kind"], result=outcome["result"])


# ── Page thumbnails ──────────────────────────────────────────────────────────

@router.get("/{doc_id}/thumbnails/{page_number}")
def get_page_thumbnail(
    course_id: int, doc_id: str, page_number: int,
    user_id: str = Depends(get_current_user_id),
):
    _require_readable_document(course_id, doc_id, user_id)
    path = pdf_service.get_page_thumbnail(doc_id, page_number)
    if path is None:
        raise HTTPException(404, "No thumbnail available for that page")
    return FileResponse(str(path), media_type="image/png")
