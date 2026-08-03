"""
app/services/study_assistant_service.py - Section 15's "Study Assistant
Service".

Thin orchestration layer over app/agents/notes_chat.py: pulls the
automatic context bundle from ai_context_service and folds it in, so the
API layer (app/api/chat.py) doesn't need to know that context injection
happens at all - it just calls ask() or ask_streaming().
"""

from __future__ import annotations

from app.agents.notes_chat import ask_course_notes, ask_course_notes_stream
from app.services.ai_context_service import build_context_bundle


def ask(
    course_id: int,
    user_id: str,
    message: str,
    history: list[dict] | None = None,
    current_doc_id: str | None = None,
    current_section_index: int | None = None,
) -> dict:
    bundle = build_context_bundle(course_id, user_id, current_doc_id, current_section_index)
    return ask_course_notes(
        course_id=course_id,
        message=message,
        history=history,
        context_addendum=bundle.to_prompt_block(),
    )


def ask_streaming(
    course_id: int,
    user_id: str,
    message: str,
    history: list[dict] | None = None,
    current_doc_id: str | None = None,
    current_section_index: int | None = None,
):
    """Returns (metadata, token_generator) - see ask_course_notes_stream."""
    bundle = build_context_bundle(course_id, user_id, current_doc_id, current_section_index)
    return ask_course_notes_stream(
        course_id=course_id,
        message=message,
        history=history,
        context_addendum=bundle.to_prompt_block(),
    )
