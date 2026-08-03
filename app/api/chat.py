"""app/api/chat.py - Ask questions about a course's uploaded material."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.deps import require_course_owner
from app.api.schemas import CourseChatRequest, CourseChatResponse
from app.auth import get_current_user_id
from app.rate_limit import rate_limit
from app.services import study_assistant_service

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
        result = study_assistant_service.ask(
            course_id=course_id,
            user_id=user_id,
            message=payload.message,
            history=[turn.model_dump() for turn in payload.history],
            current_doc_id=payload.current_doc_id,
            current_section_index=payload.current_section_index,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    return CourseChatResponse(**result)


@router.post("/stream")
def chat_stream(
    course_id: int,
    payload: CourseChatRequest,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("chat_stream", max_calls=20, window_seconds=300)),
):
    """
    Server-Sent Events: one `meta` event first (sources/grounding - known
    before generation starts, since grounding is decided from retrieval,
    not from the model's own output), then a `token` event per chunk as
    the answer generates, then a final `done` event.

    Kept as a separate endpoint from POST /chat (rather than a query
    param toggling streaming on the same route) since the response shape
    is fundamentally different (SSE vs a single JSON body) - callers
    should be able to tell which one they're getting from the URL alone.
    """
    require_course_owner(course_id, user_id)

    try:
        metadata, token_generator = study_assistant_service.ask_streaming(
            course_id=course_id,
            user_id=user_id,
            message=payload.message,
            history=[turn.model_dump() for turn in payload.history],
            current_doc_id=payload.current_doc_id,
            current_section_index=payload.current_section_index,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    def event_stream():
        yield f"event: meta\ndata: {json.dumps(metadata)}\n\n"
        try:
            for chunk in token_generator:
                yield f"event: token\ndata: {json.dumps({'text': chunk})}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
