"""app/api/chat.py - Ask questions about a course's uploaded material."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.agents.notes_chat import ask_course_notes
from app.api.deps import require_course_owner
from app.api.schemas import CourseChatRequest, CourseChatResponse
from app.auth import get_current_user_id
from app.rate_limit import rate_limit

router = APIRouter(prefix="/courses/{course_id}/chat", tags=["chat"])


@router.post("", response_model=CourseChatResponse)
def chat(
    course_id: int,
    payload: CourseChatRequest,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("chat", max_calls=20, window_seconds=300)),
):
    require_course_owner(course_id, user_id)

    try:
        result = ask_course_notes(
            course_id=course_id,
            message=payload.message,
            history=[turn.model_dump() for turn in payload.history],
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    return CourseChatResponse(**result)
