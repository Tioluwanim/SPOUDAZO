"""
app/api/deps.py - Ownership checks shared across routers.

Verifying a Firebase token tells you *who* is calling. It doesn't tell
you they're allowed to see *this* course's materials, topics, questions,
or chat. Every course-scoped route needs both: get_current_user_id for
identity, then one of these to confirm that identity owns the resource
being requested. Missing this second check was the actual security gap
in the original endpoints - they all had an implicit user_id someone
gave you, but course_id was open to anyone.

Not-found vs not-yours is deliberately blurred to 404 in all three
helpers, not 403 - a 403 would confirm the resource exists and just
isn't yours, which leaks information. 404 gives no signal either way.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException

from app.auth import get_current_user_id
from app.config import ADMIN_USER_IDS
from app.db.models import Course, Question, Topic
from app.db.repository import repository


def require_course_owner(course_id: int, user_id: str) -> Course:
    course = repository.get_course(course_id)
    if course is None or course.user_id != user_id:
        raise HTTPException(404, "Course not found")
    return course


def require_topic_owner(topic_id: int, user_id: str) -> Topic:
    topic = repository.get_topic(topic_id)
    if topic is None:
        raise HTTPException(404, "Topic not found")
    require_course_owner(topic.course_id, user_id)
    return topic


def require_question_owner(question_id: int, user_id: str) -> Question:
    question = repository.get_question(question_id)
    if question is None:
        raise HTTPException(404, "Question not found")
    require_course_owner(question.course_id, user_id)
    return question


def require_study_plan_item_owner(item_id: int, user_id: str):
    item = repository.get_study_plan_item(item_id)
    if item is None:
        raise HTTPException(404, "Study plan item not found")
    plan = repository.get_study_plan(item.plan_id)
    if plan is None or plan.user_id != user_id:
        raise HTTPException(404, "Study plan item not found")
    return item


def require_admin(user_id: str = Depends(get_current_user_id)) -> str:
    """Gate for feedback triage (list/update/delete) - anyone signed in can
    submit feedback, but only reviewers listed in ADMIN_USER_IDS can see the
    full queue. 403, not 404, is fine here (unlike the ownership helpers
    above): admin status isn't tied to a specific resource, so there's
    nothing about *this* endpoint's existence to leak."""
    if user_id not in ADMIN_USER_IDS:
        raise HTTPException(403, "Not authorized to manage feedback")
    return user_id
