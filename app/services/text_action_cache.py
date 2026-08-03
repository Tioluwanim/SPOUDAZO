"""
app/services/text_action_cache.py - Section 14's "Response caching".

Highlight-to-ask actions are deterministic-ish for a given (doc, action,
exact selected text) - a student re-highlighting the same passage, or
several students in the same course highlighting the same well-known
paragraph, would otherwise re-pay a full LLM call for output that's
already been generated. In-memory + a hard size cap is proportionate to
this app's beta scale (see embedding_service for the same pattern
elsewhere in the codebase) - no Redis needed yet.

Deliberately NOT caching translate (target_language varies the same
selected_text into many different valid outputs, so caching only by
doc_id+action+text would return the wrong language) - see the check
below.
"""

from __future__ import annotations

import hashlib
import time
from collections import OrderedDict
from threading import Lock

from app.agents.text_actions import run_text_action

_TTL_SECONDS = 6 * 60 * 60  # 6 hours - long enough to matter, short enough that stale content ages out on its own
_MAX_ENTRIES = 500

_cache: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
_lock = Lock()


def _cache_key(action: str, selected_text: str, doc_id: str, target_language: str) -> str:
    raw = f"{doc_id}|{action}|{target_language}|{selected_text}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_or_run_text_action(
    action: str,
    selected_text: str,
    doc_id: str,
    section_title: str = "",
    course_context: str = "",
    target_language: str = "",
) -> dict:
    # translate isn't cached (see module docstring); everything else is.
    if action == "translate":
        return run_text_action(
            action=action, selected_text=selected_text, doc_id=doc_id,
            section_title=section_title, course_context=course_context,
            target_language=target_language,
        )

    key = _cache_key(action, selected_text, doc_id, target_language)
    now = time.time()

    with _lock:
        cached = _cache.get(key)
        if cached is not None:
            cached_at, result = cached
            if now - cached_at < _TTL_SECONDS:
                _cache.move_to_end(key)  # LRU touch
                return result
            del _cache[key]  # expired

    result = run_text_action(
        action=action, selected_text=selected_text, doc_id=doc_id,
        section_title=section_title, course_context=course_context,
        target_language=target_language,
    )

    with _lock:
        _cache[key] = (now, result)
        _cache.move_to_end(key)
        while len(_cache) > _MAX_ENTRIES:
            _cache.popitem(last=False)  # evict oldest

    return result
