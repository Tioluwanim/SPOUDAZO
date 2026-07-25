"""
app/agents/common.py - Shared helpers for the agent modules.

Every agent follows the same shape: pull context (repository / rag_service)
→ call ai_router.complete_custom() with a task-specific system prompt →
parse the (hopefully) JSON response → persist via repository.

LLMs wrap JSON in markdown fences more often than not even when told not
to — parse_json_response() strips that defensively rather than trusting
raw output.
"""

from __future__ import annotations

import json
import re

from app.utils.logger import get_logger

logger = get_logger(__name__)


class AgentParseError(Exception):
    """Raised when the LLM response can't be parsed into the expected shape."""


def parse_json_response(raw: str) -> dict | list:
    """
    Strips markdown code fences and leading/trailing prose the model may
    have added despite instructions, then parses JSON. Raises
    AgentParseError with the raw text attached (via args) so the caller
    can log/retry rather than silently swallowing a bad generation.
    """
    text = raw.strip()

    # Strip ```json ... ``` or ``` ... ``` fences.
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # If there's still prose around it, grab the outermost {...} or [...].
    if not (text.startswith("{") or text.startswith("[")):
        brace_match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
        if brace_match:
            text = brace_match.group(1)

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse agent JSON response: %s | raw=%s", e, raw[:500])
        raise AgentParseError(raw) from e


def truncate_for_context(text: str, max_chars: int = 12000) -> str:
    """Simple char-budget truncation for material text fed into a single
    generation call. Good enough for MVP-week single-call extraction;
    revisit with real chunk-batching once a course has more material than
    this comfortably covers."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[...truncated...]"


def call_llm_json_with_retry(
    system_prompt: str,
    user_prompt: str,
    doc_id: str,
    max_retries: int = 2,
) -> dict | list:
    """
    Calls ai_router.complete_custom and parses the response as JSON,
    retrying on parse failure instead of failing the whole request after
    one bad generation. Every agent that expects structured JSON back
    (topic extraction, question generation, grading) should go through
    this rather than calling complete_custom + parse_json_response
    directly - a single malformed response used to mean the student's
    request just failed; this gives the model another shot first.

    On retry, the prompt is reinforced with what went wrong, which in
    practice fixes the large majority of cases (usually a stray code
    fence or a trailing comment the model added despite instructions).
    """
    from app.services.ai_router import ai_router  # local import avoids a circular import at module load

    last_error: AgentParseError | None = None
    prompt = user_prompt

    for attempt in range(max_retries + 1):
        raw = ai_router.complete_custom(
            system_prompt=system_prompt,
            user_prompt=prompt,
            doc_id=f"{doc_id}-attempt{attempt}",
        )
        try:
            return parse_json_response(raw)
        except AgentParseError as e:
            last_error = e
            logger.warning(
                "JSON parse failed on attempt %d/%d for %s: %s",
                attempt + 1, max_retries + 1, doc_id, str(e)[:200],
            )
            prompt = (
                f"{user_prompt}\n\n---\n"
                "Your previous response could not be parsed as JSON. Common causes: "
                "markdown code fences, trailing commentary, or a trailing comma. "
                "Respond with ONLY the raw JSON object or array - nothing else, no "
                "```json fences, no explanation before or after."
            )

    assert last_error is not None
    raise last_error
