"""
app/services/task_classifier.py - Infers what KIND of request a student's
message is, so ai_router can route to a model actually suited to it
(reasoning-heavy models for math, code-tuned models for programming
questions, etc.) instead of one fixed model for everything.

Pure heuristic, server-side, no LLM call involved - same reasoning as
notes_chat.py's grounding classification and confusion detection: cheap,
deterministic, and testable, rather than asking a model to self-report
what kind of question it just received.
"""

from __future__ import annotations

import re
from typing import Literal

TaskType = Literal["reasoning", "coding", "creative", "long_context", "simple", "general"]

_CODING_PATTERNS = re.compile(
    r"\b(code|function|algorithm|debug|syntax|compile|program(?:ming)?|"
    r"python|java(?:script)?|c\+\+|typescript|variable|loop|array|"
    r"class(?:es)?\b.*\b(method|attribute)|recursion|pseudocode)\b",
    re.IGNORECASE,
)

_REASONING_PATTERNS = re.compile(
    r"\b(solve|calculate|derive|derivation|prove|proof|integral|derivative|"
    r"equation|theorem|matrix|matrices|vector|limit|differential|"
    r"eigenvalue|probability|statistics|optimi[sz]e|complexity analysis)\b"
    r"|[∫∑√≈≠≤≥±→]",
    re.IGNORECASE,
)

_CREATIVE_PATTERNS = re.compile(
    r"\b(diagram|draw|visuali[sz]e|flowchart|flow chart|mind ?map|"
    r"illustrate|sketch|chart it|show (?:me )?(?:a|the) (?:diagram|flow))\b",
    re.IGNORECASE,
)

_LONG_CONTEXT_PATTERNS = re.compile(
    r"\b(summari[sz]e (?:the )?(?:whole|entire|full)|write (?:an? )?(?:essay|report|"
    r"comprehensive|full summary)|everything about|entire chapter|"
    r"all of (?:my|the) notes|comprehensive (?:notes|summary|overview))\b",
    re.IGNORECASE,
)

_SIMPLE_PATTERNS = re.compile(
    r"^(what is|what's|define|who is|who was|when (?:is|was|did)|where is|"
    r"how many|what page|which (?:page|section))\b",
    re.IGNORECASE,
)


def classify_task(message: str) -> TaskType:
    """Priority order matters: a message can trip more than one pattern
    (e.g. "debug this proof" has both coding and reasoning signals) -
    coding and reasoning are checked before the broader creative/
    long-context/simple checks since they're the most specific and most
    consequential to get right (a math question routed to a coding-tuned
    model, or vice versa, is a bigger quality loss than a borderline
    simple/general miscategorization)."""
    if not message or not message.strip():
        return "general"

    if _CODING_PATTERNS.search(message):
        return "coding"
    if _REASONING_PATTERNS.search(message):
        return "reasoning"
    if _CREATIVE_PATTERNS.search(message):
        return "creative"
    if _LONG_CONTEXT_PATTERNS.search(message):
        return "long_context"
    if len(message.strip()) <= 60 and _SIMPLE_PATTERNS.match(message.strip()):
        return "simple"
    return "general"
