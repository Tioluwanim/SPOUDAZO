"""
app/services/flashcard_service.py - Section 15's "Flashcard Service".

Thin by design: flashcard generation is one of text_actions.py's actions
(see ALL_ACTIONS) sharing that module's prompt-building and JSON-parsing
machinery with explain/summarize/etc. A separate module here would either
duplicate that machinery or import back into text_actions.py, so this is
a named, stable entry point rather than a reimplementation - callers who
want "just flashcards" (e.g. a future dedicated flashcard-deck feature)
have one function to depend on instead of reaching into the general
text-actions module and knowing which string key means "flashcards".
"""

from __future__ import annotations

from app.agents.text_actions import run_text_action


def generate_flashcards(selected_text: str, doc_id: str, section_title: str = "", course_context: str = "") -> list[dict]:
    outcome = run_text_action(
        action="flashcards",
        selected_text=selected_text,
        doc_id=doc_id,
        section_title=section_title,
        course_context=course_context,
    )
    return outcome["result"]
