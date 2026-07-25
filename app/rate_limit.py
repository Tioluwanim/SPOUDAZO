"""
app/rate_limit.py - Per-user rate limiting for endpoints that spend
metered quota (OpenRouter/HuggingFace requests, Tavily searches).

In-memory, not Redis - correct for a single-process deployment at this
app's current scale. If you move to multiple backend instances behind a
load balancer, each instance gets its own counter, which under-enforces
the limit (a user could get N calls per instance instead of N total).
Revisit with a shared store (Redis) if that becomes real multi-instance
deployment, not before - it's not worth the operational complexity yet.

Protects against: a student rapid-clicking "Generate" out of impatience,
a stuck frontend retry loop, or actual abuse - any of which could burn
through a free-tier API quota for the whole app in minutes, not just
that one student's own budget.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Depends, HTTPException

from app.auth import get_current_user_id


class RateLimiter:
    def __init__(self):
        self._calls: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_calls: int, window_seconds: int) -> None:
        now = time.monotonic()
        history = self._calls[key]
        # Drop timestamps outside the current window rather than letting
        # this list grow forever for an active user.
        cutoff = now - window_seconds
        while history and history[0] < cutoff:
            history.pop(0)

        if len(history) >= max_calls:
            retry_after = int(window_seconds - (now - history[0])) + 1
            raise HTTPException(
                429,
                f"Too many requests - try again in about {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )
        history.append(now)


_limiter = RateLimiter()


def rate_limit(bucket: str, max_calls: int, window_seconds: int):
    """
    Usage: `_ = Depends(rate_limit("theory_generate", max_calls=8, window_seconds=60))`

    `bucket` scopes the limit to a feature, not just a user, so a heavy
    chat session doesn't eat into a separate quiz-generation allowance.
    Keyed by user_id + bucket together.
    """
    def dependency(user_id: str = Depends(get_current_user_id)) -> None:
        _limiter.check(f"{bucket}:{user_id}", max_calls, window_seconds)

    return dependency
