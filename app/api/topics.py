"""app/api/topics.py - Trigger topic extraction and list a course's topics."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.agents.topic_extraction import extract_topics
from app.api.deps import require_course_owner
from app.api.schemas import TopicOut
from app.auth import get_current_user_id
from app.db.repository import repository
from app.rate_limit import rate_limit

router = APIRouter(prefix="/courses/{course_id}/topics", tags=["topics"])


@router.post("/extract", response_model=list[TopicOut])
def extract_course_topics(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("topic_extract", max_calls=5, window_seconds=300)),
):
    require_course_owner(course_id, user_id)

    topics = extract_topics(course_id)
    if not topics:
        raise HTTPException(422, "Could not extract topics — check that materials have finished processing")
    return topics


@router.get("", response_model=list[TopicOut])
def list_topics(course_id: int, user_id: str = Depends(get_current_user_id)):
    require_course_owner(course_id, user_id)
    return repository.list_topics(course_id)
