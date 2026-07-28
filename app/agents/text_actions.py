"""
app/agents/text_actions.py - Backs the reader's highlight-to-ask toolbar.

Same shape as every other agent (see app/agents/common.py): pull a little
surrounding context, call ai_router with a task-specific system prompt,
return the result. No persistence here - the toolbar's AI actions are
ephemeral output shown in the reader's AI panel, not new rows in the
Question/StudyPlan tables (Highlight and Bookmark, the two toolbar actions
that ARE meant to persist, go through repository.create_annotation
directly from the API layer instead - they're not AI generations).

theory_question and cbt generate a question FROM the highlighted passage
for quick self-testing - they deliberately do NOT create rows in the
Question table. That table's rows are tied to a Topic (see
app/agents/question_generation.py) and feed the persisted practice/
grading/attempt-history flow; a question generated from an arbitrary
highlighted passage isn't tied to a topic_id and was never meant to
compete with that system. This is "quiz me on this paragraph right now",
shown in the AI panel - not a new practice-question source.
"""

from __future__ import annotations

from app.agents.common import call_llm_json_with_retry, truncate_for_context
from app.services.ai_router import ai_router

# Actions that return prose - complete_custom, no JSON parsing needed.
_PROSE_SYSTEM_PROMPTS: dict[str, str] = {
    "explain": (
        "You are a university tutor. The student has highlighted a passage from "
        "their own lecture material and wants it explained clearly. Explain what "
        "it means and why it matters, grounded in the passage itself - don't just "
        "restate it in different words. Keep it focused; a few sentences to a "
        "short paragraph, not an essay."
    ),
    "explain_simply": (
        "You are a university tutor. Rewrite the highlighted passage so a "
        "first-year student who's never seen this material before can understand "
        "it. Simplify the language and sentence structure, but do NOT drop any "
        "important concept, term, or relationship that's actually in the passage - "
        "simplifying means clearer, not thinner."
    ),
    "example": (
        "You are a university tutor. Give one concrete, worked example that "
        "illustrates the concept in the highlighted passage. Prefer an example "
        "grounded in the passage's own subject area over a generic textbook one - "
        "if the passage is about a specific algorithm, formula, or process, your "
        "example should apply that exact thing, not a loosely related idea."
    ),
    "analogy": (
        "You are a university tutor known for memorable analogies. Give ONE "
        "analogy that makes the highlighted concept easier to remember - pull "
        "from computer science, engineering, mathematics, or everyday life, "
        "whichever actually fits the concept best. Briefly explain how the "
        "analogy maps onto the real concept so the connection isn't left implicit."
    ),
    "summarize": (
        "You are a university tutor. Summarize the highlighted passage in your "
        "own words, capturing every distinct claim or step it makes - a student "
        "reading only your summary should not miss anything they'd be tested on. "
        "Be substantially shorter than the original, not just reworded."
    ),
    "mnemonic": (
        "You are a university tutor. Create one memory aid (acronym, rhyme, or "
        "vivid mental image - whichever fits best) that helps a student recall "
        "the highlighted passage's key point(s) under exam pressure. Explain what "
        "each part of the mnemonic stands for."
    ),
}

# Actions that return structured JSON - call_llm_json_with_retry.
_FLASHCARDS_SYSTEM_PROMPT = (
    "You are a university tutor creating flashcards from a student's own "
    "lecture material. Generate 3-6 flashcards from the highlighted passage - "
    "each testing one distinct fact, definition, or relationship actually "
    "present in the passage. Do not invent content not supported by the text.\n\n"
    'Respond with ONLY a JSON array: [{"front": "...", "back": "..."}, ...]. '
    "No markdown fences, no commentary."
)

_KEY_POINTS_SYSTEM_PROMPT = (
    "You are a university tutor. Extract the key points a student would need "
    "to remember from the highlighted passage for an exam - each point one "
    "specific, testable fact or idea, not a vague restatement.\n\n"
    'Respond with ONLY a JSON array of strings: ["point one", "point two", ...]. '
    "No markdown fences, no commentary."
)

_THEORY_QUESTION_SYSTEM_PROMPT = (
    "You are a university examiner. Write ONE theory/essay-style exam question "
    "that directly tests understanding of the highlighted passage, plus a short "
    "model-answer rubric (2-4 points a grader would look for).\n\n"
    'Respond with ONLY JSON: {"question": "...", "rubric_points": ["...", "..."]}. '
    "No markdown fences, no commentary."
)

_CBT_SYSTEM_PROMPT = (
    "You are a university examiner. Write ONE multiple-choice question that "
    "directly tests understanding of the highlighted passage. Exactly 4 options, "
    "only one correct, distractors must be plausible (not obviously wrong).\n\n"
    'Respond with ONLY JSON: {"question": "...", "options": ["...", "...", "...", "..."], '
    '"correct_index": 0, "explanation": "why the correct answer is correct"}. '
    "No markdown fences, no commentary."
)

_VISUALIZE_SYSTEM_PROMPT = (
    "You are a university tutor who prefers diagrams over paragraphs when a "
    "concept has structure (steps, hierarchy, flow, comparison, timeline). Look "
    "at the highlighted passage and produce a Mermaid diagram that represents it - "
    "pick whichever Mermaid diagram type actually fits (flowchart, sequenceDiagram, "
    "classDiagram, timeline, etc.). If the passage genuinely has no structure a "
    "diagram would clarify (e.g. it's a single definition), say so instead of "
    "forcing one.\n\n"
    'Respond with ONLY JSON: {"applicable": true, "diagram_type": "flowchart", '
    '"mermaid": "flowchart TD\\n  A[...] --> B[...]"} - or '
    '{"applicable": false, "reason": "..."} if a diagram would not help here. '
    "The mermaid field must be valid Mermaid syntax with \\n for newlines. "
    "No markdown fences, no commentary."
)

_DEFINE_SYSTEM_PROMPT = (
    "You are a glossary generator for a university student reading their own "
    "lecture material. The student double-clicked one term. Define it precisely "
    "as used in this context (the same term can mean different things in "
    "different fields - use the passage to disambiguate).\n\n"
    'Respond with ONLY JSON: {"term": "...", "definition": "...", '
    '"pronunciation": "phonetic spelling or null if not applicable", '
    '"simple_explanation": "one sentence, first-year-friendly", '
    '"related_concepts": ["...", "..."], "example": "...", '
    '"difficulty_level": "easy|medium|hard", '
    '"estimated_learning_time_minutes": 5}. '
    "No markdown fences, no commentary."
)


def _translate_system_prompt(target_language: str) -> str:
    return (
        f"You are a translator. Translate the highlighted academic passage into "
        f"{target_language}, preserving technical terms accurately - if a technical "
        f"term has no natural translation, keep the original term and gloss it in "
        f"parentheses rather than inventing an unnatural translation. Translate "
        f"meaning, not word-for-word."
    )


PROSE_ACTIONS = frozenset(_PROSE_SYSTEM_PROMPTS)
STRUCTURED_ACTIONS = frozenset({
    "flashcards", "key_points", "theory_question", "cbt", "visualize", "define",
})
# translate isn't in either set - it needs a runtime parameter (target_language),
# so it's handled as its own branch in run_text_action rather than a static
# prompt lookup.
ALL_ACTIONS = PROSE_ACTIONS | STRUCTURED_ACTIONS | frozenset({"translate"})

_STRUCTURED_PROMPTS: dict[str, str] = {
    "flashcards": _FLASHCARDS_SYSTEM_PROMPT,
    "key_points": _KEY_POINTS_SYSTEM_PROMPT,
    "theory_question": _THEORY_QUESTION_SYSTEM_PROMPT,
    "cbt": _CBT_SYSTEM_PROMPT,
    "visualize": _VISUALIZE_SYSTEM_PROMPT,
    "define": _DEFINE_SYSTEM_PROMPT,
}


def _build_user_prompt(selected_text: str, section_title: str, course_context: str) -> str:
    parts = []
    if course_context:
        parts.append(f"Course: {course_context}")
    if section_title:
        parts.append(f"Section: {section_title}")
    parts.append(f"Highlighted passage:\n\"\"\"\n{truncate_for_context(selected_text, 4000)}\n\"\"\"")
    return "\n\n".join(parts)


def run_text_action(
    action: str,
    selected_text: str,
    doc_id: str,
    section_title: str = "",
    course_context: str = "",
    target_language: str = "",
) -> dict:
    """
    Returns {"kind": "prose", "result": str} or {"kind": "list"/"object", "result": ...}
    depending on the action, so the API layer can shape the response without
    needing to know which actions are which.
    """
    if action not in ALL_ACTIONS:
        raise ValueError(f"Unknown text action '{action}' - expected one of {sorted(ALL_ACTIONS)}")
    if not selected_text.strip():
        raise ValueError("No text selected")

    user_prompt = _build_user_prompt(selected_text, section_title, course_context)

    if action in PROSE_ACTIONS:
        result = ai_router.complete_custom(
            system_prompt=_PROSE_SYSTEM_PROMPTS[action],
            user_prompt=user_prompt,
            doc_id=doc_id,
        )
        return {"kind": "prose", "result": result.strip()}

    if action == "translate":
        if not target_language.strip():
            raise ValueError("translate requires target_language")
        result = ai_router.complete_custom(
            system_prompt=_translate_system_prompt(target_language.strip()),
            user_prompt=user_prompt,
            doc_id=doc_id,
        )
        return {"kind": "prose", "result": result.strip()}

    system_prompt = _STRUCTURED_PROMPTS[action]
    parsed = call_llm_json_with_retry(system_prompt, user_prompt, doc_id=doc_id)

    if action in ("flashcards", "key_points"):
        if not isinstance(parsed, list):
            raise ValueError(f"Expected a JSON array back for action '{action}', got {type(parsed).__name__}")
        return {"kind": "list", "result": parsed}

    if not isinstance(parsed, dict):
        raise ValueError(f"Expected a JSON object back for action '{action}', got {type(parsed).__name__}")
    return {"kind": "object", "result": parsed}
