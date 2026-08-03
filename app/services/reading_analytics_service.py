"""
app/services/reading_analytics_service.py - Section 15's "Reading
Analytics Service".

Deliberately thin - the aggregation queries live in the repository
(that's where the SQL belongs), this module owns the *rules* around them:
the cap on a single activity delta, and keeping this dashboard scoped to
reading-specific numbers rather than duplicating topic mastery/exam
readiness, which already live on the Progress page.
"""

from __future__ import annotations

from app.db.repository import repository

MAX_SECONDS_PER_SAVE = 600  # a stale/backgrounded tab shouldn't count as hours of reading


def record_progress(user_id: str, doc_id: str, last_section_index: int, progress_percent: int, seconds_delta: int):
    row = repository.upsert_reading_progress(user_id, doc_id, last_section_index, progress_percent)
    repository.record_reading_activity(user_id, min(max(seconds_delta, 0), MAX_SECONDS_PER_SAVE))
    return row


def get_stats(user_id: str) -> dict:
    return repository.get_reading_stats(user_id)
