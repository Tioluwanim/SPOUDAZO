"""
app/agents/notes_chat.py - "Ask about your notes" chatbot.

Three-tier grounding, decided server-side (not self-reported by the
model, which is unreliable) based on what context actually existed
before the LLM call:
  1. "notes"      - the student's own uploaded material covered it
  2. "notes+web"  - own material was thin, cached Smart Library web
                     resources for the course filled the gap
  3. "web"        - no relevant notes at all, but web resources existed
  4. "general"    - nothing in notes or cached web resources; the model
                     answers from its own general knowledge, and is
                     required to say so explicitly rather than blur the
                     line between "grounded in your material" and "I'm
                     just guessing based on training data"

This is the actual point of linking chat to Smart Library: without it,
a question outside the uploaded notes either gets stonewalled ("not in
your notes") or silently answered from general knowledge with no signal
to the student about which one happened. Neither is good enough for
something students are meant to trust while studying.
"""

from __future__ import annotations

from app.agents.smart_library import get_or_fetch_resources
from app.db.repository import repository
from app.models.schemas import ChatMessage, MessageRole
from app.services.ai_router import ai_router
from app.services.pdf_service import pdf_service
from app.services.rag_service import rag_service
from app.services.task_classifier import classify_task
from app.utils.logger import get_logger

logger = get_logger(__name__)

MAX_HISTORY_TURNS = 6  # keep the last N turns - enough context, bounded token cost
THIN_CONTEXT_CHARS = 200  # below this, treat notes context as "didn't really cover it"

_TEACHING_METHOD = """When you explain a concept (not just answering a quick factual lookup),
use this structure - it's Spoudazõ's own teaching method, not a generic assistant style:

1. ANCHOR - one plain sentence with the actual core idea, no hedging, no "essentially" or
   "basically" as a crutch.
2. PICTURE - a concrete example or comparison that makes it click. Avoid the most overused
   AI-explainer analogies (a librarian, a factory, a recipe, a filing cabinet) - reach for
   something more specific to the actual concept, or grounded in everyday Nigerian student
   life (transport, markets, exam halls, campus life) when it genuinely fits, not forced.
3. CHECK - one short question or common mistake the student can use to test whether it
   actually landed.

Skip this structure for simple factual questions ("what page is this on", "what's the
formula") - use it for genuine explanations, not everything.

ADAPT TO THE STUDENT'S LEVEL: infer it from how they write and what they already seem to
know, based on this conversation so far - their vocabulary, what they take for granted,
what they're struggling with. A question phrased with confident technical terminology
gets a more technical answer; a question that fumbles the basic terms gets simpler
language and more scaffolding. Don't ask the student to state their level - infer it, and
let it show in your answer rather than announcing "since you're a beginner...".

FORMATTING: use real Markdown, not description. Write actual math with LaTeX ($inline$
and $$display$$), not spelled-out approximations or plain-text notation. When a process,
flow, hierarchy, or comparison would genuinely be clearer as a diagram than a paragraph,
generate a Mermaid diagram in a ```mermaid fenced block - don't just describe what a
diagram would show. Use tables for comparisons, fenced code blocks with a language tag for
code or algorithms, and headers only when the answer actually has multiple distinct parts
(don't force structure onto a two-sentence answer)."""

_CONFUSION_PATTERNS = (
    # Core phrases without a rigid prefix requirement - "I still don't
    # understand" or "I really don't get it" should match just as much as
    # the bare phrase does; anchoring to "i don't understand" as a fixed
    # string missed both of those.
    "don't understand", "dont understand",
    "don't get it", "dont get it",
    "doesn't make sense", "doesnt make sense", "makes no sense",
    "still confused", "i'm confused", "im confused", "so confused",
    "explain again", "explain that again", "explain differently",
    "i'm lost", "im lost",
    "can you simplify", "simpler please", "dumb it down", "break it down more",
)


def _is_confused(message: str) -> bool:
    """Server-side detection, same reasoning as grounding classification
    above: asking the model to notice its own explanation didn't land is
    less reliable than just checking the student's own words for it."""
    lowered = message.lower()
    return any(p in lowered for p in _CONFUSION_PATTERNS)


_CONFUSION_ADDENDUM = """\n\nThe student's message signals they're still confused by a
previous explanation (in the conversation history above). Do NOT repeat the same
explanation in different words - that's what already didn't work. Instead: use a
genuinely different analogy or example than whatever you used before, simplify the
language further, and consider a visual (Mermaid diagram) if the concept has any
structure to it at all. Break it into smaller pieces rather than one denser paragraph."""

_GROUNDING_INSTRUCTIONS = {
    "notes": "",
    "notes+web": (
        "\n\nThe student's own notes only partly cover this - you also have some cached web "
        "resources below. Blend them, but make clear (briefly, don't belabor it) which parts "
        "come from their own material versus the extra web sources."
    ),
    "web": (
        "\n\nThe student's own uploaded notes don't cover this at all - you're answering "
        "using the cached web resources below instead. Say so plainly near the start of "
        "your answer, e.g. \"This isn't in your uploaded notes, but here's what I found...\""
    ),
    "general": (
        "\n\nNeither the student's notes nor any cached web resources cover this. Answer from "
        "your own general knowledge, but you MUST say so clearly and near the start, e.g. "
        "\"This isn't covered in your notes - here's what I know generally...\". Never let it "
        "read as if this came from their material."
    ),
}


def ask_course_notes(
    course_id: int,
    message: str,
    history: list[dict] | None = None,
    context_addendum: str = "",
) -> dict:
    """
    history: [{"role": "user"|"assistant", "content": "..."}], oldest first.
    context_addendum: pre-rendered text from ai_context_service (current
    document/section, weak topics, exam date, reading history) - optional,
    so this function's existing behavior is unchanged for any caller that
    doesn't pass one.
    Returns {"answer": str, "sources": [...], "grounding": "notes"|"notes+web"|"web"|"general"}.
    """
    course = repository.get_course(course_id)
    if course is None:
        raise ValueError(f"Course {course_id} not found")

    doc_ids = repository.get_course_document_ids(course_id)
    notes_context, results = ("", [])
    if doc_ids:
        notes_context, results = rag_service.get_library_context(query=message, doc_ids=doc_ids, top_k=6)

    notes_stripped = notes_context.strip()
    has_notes = len(notes_stripped) > 0
    notes_sufficient = len(notes_stripped) >= THIN_CONTEXT_CHARS

    web_snippets: list[str] = []
    if not notes_sufficient:
        web_snippets = _gather_web_context(course_id, message)

    grounding = _classify_grounding(notes_sufficient, has_notes, bool(web_snippets))

    context_parts = []
    if notes_context.strip():
        context_parts.append(f"[FROM STUDENT'S OWN NOTES]\n{notes_context}")
    if web_snippets:
        context_parts.append("[FROM CACHED WEB RESOURCES]\n" + "\n\n".join(web_snippets))
    combined_context = "\n\n".join(context_parts)

    confusion_addendum = _CONFUSION_ADDENDUM if _is_confused(message) else ""
    system_addendum = _TEACHING_METHOD + _GROUNDING_INSTRUCTIONS[grounding] + context_addendum + confusion_addendum

    chat_history = [
        ChatMessage(
            role=MessageRole.USER if turn.get("role") == "user" else MessageRole.ASSISTANT,
            content=turn.get("content", ""),
        )
        for turn in (history or [])[-MAX_HISTORY_TURNS:]
    ]

    response = ai_router.chat(
        question=message,
        context=combined_context,
        history=chat_history,
        doc_id=f"course-{course_id}-chat",
        stream=False,
        system_addendum=system_addendum,
        task_type=classify_task(message),
    )

    sources = _resolve_source_filenames(results)

    return {"answer": response.answer, "sources": sources, "grounding": grounding}


def ask_course_notes_stream(
    course_id: int,
    message: str,
    history: list[dict] | None = None,
    context_addendum: str = "",
):
    """
    Same grounding/context logic as ask_course_notes, but returns
    (metadata, token_generator) instead of a single completed answer -
    metadata (sources/grounding) is known before generation starts, so the
    caller can send it as an immediate first SSE event while the answer
    itself streams in behind it.
    """
    course = repository.get_course(course_id)
    if course is None:
        raise ValueError(f"Course {course_id} not found")

    doc_ids = repository.get_course_document_ids(course_id)
    notes_context, results = ("", [])
    if doc_ids:
        notes_context, results = rag_service.get_library_context(query=message, doc_ids=doc_ids, top_k=6)

    notes_stripped = notes_context.strip()
    has_notes = len(notes_stripped) > 0
    notes_sufficient = len(notes_stripped) >= THIN_CONTEXT_CHARS

    web_snippets: list[str] = []
    if not notes_sufficient:
        web_snippets = _gather_web_context(course_id, message)

    grounding = _classify_grounding(notes_sufficient, has_notes, bool(web_snippets))

    context_parts = []
    if notes_context.strip():
        context_parts.append(f"[FROM STUDENT'S OWN NOTES]\n{notes_context}")
    if web_snippets:
        context_parts.append("[FROM CACHED WEB RESOURCES]\n" + "\n\n".join(web_snippets))
    combined_context = "\n\n".join(context_parts)

    confusion_addendum = _CONFUSION_ADDENDUM if _is_confused(message) else ""
    system_addendum = _TEACHING_METHOD + _GROUNDING_INSTRUCTIONS[grounding] + context_addendum + confusion_addendum

    chat_history = [
        ChatMessage(
            role=MessageRole.USER if turn.get("role") == "user" else MessageRole.ASSISTANT,
            content=turn.get("content", ""),
        )
        for turn in (history or [])[-MAX_HISTORY_TURNS:]
    ]

    token_generator = ai_router.chat(
        question=message,
        context=combined_context,
        history=chat_history,
        doc_id=f"course-{course_id}-chat",
        stream=True,
        system_addendum=system_addendum,
        task_type=classify_task(message),
    )

    metadata = {"sources": _resolve_source_filenames(results), "grounding": grounding}
    return metadata, token_generator


def _classify_grounding(notes_sufficient: bool, has_notes: bool, has_web: bool) -> str:
    if notes_sufficient:
        return "notes"
    if has_notes and has_web:
        return "notes+web"
    if not has_notes and has_web:
        return "web"
    return "general"


def _gather_web_context(course_id: int, message: str) -> list[str]:
    """Cheap keyword-overlap match against the course's topics (not
    another embedding call) to find which cached Smart Library resource
    sets are plausibly relevant, then pull their cached snippets. No new
    web search here - refreshing the cache is a deliberate user action
    (the "Find more" button), not something a chat message should
    trigger automatically and burn quota on."""
    message_words = set(message.lower().split())
    topics = repository.list_topics(course_id)

    snippets: list[str] = []
    for topic in topics:
        topic_words = set(topic.name.lower().split())
        if not (message_words & topic_words):
            continue
        for resource in repository.list_topic_resources(topic.id)[:2]:
            if resource.get("snippet"):
                snippets.append(f"{resource['title']}: {resource['snippet']}")

    return snippets[:5]


def _resolve_source_filenames(results: list) -> list[str]:
    """SearchResult only carries chunk.doc_id, not a filename - look up
    each unique doc_id actually used in the retrieved context. Small,
    bounded number of lookups (top_k chunks map to at most top_k distinct
    documents, usually far fewer)."""
    seen_doc_ids: set[str] = set()
    filenames: list[str] = []
    for result in results:
        doc_id = result.chunk.doc_id
        if doc_id in seen_doc_ids:
            continue
        seen_doc_ids.add(doc_id)
        doc = pdf_service.load_document(doc_id)
        if doc:
            filenames.append(doc.filename)
    return sorted(filenames)
