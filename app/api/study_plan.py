"""app/api/study_plan.py - Generate and fetch a course's daily revision plan."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.agents.study_planner import generate_study_plan
from app.api.deps import require_course_owner, require_study_plan_item_owner
from app.api.schemas import StudyPlanCreate, StudyPlanItemOut, StudyPlanOut
from app.auth import get_current_user_id
from app.db.repository import repository

router = APIRouter(prefix="/courses/{course_id}/study-plan", tags=["study-plan"])
item_router = APIRouter(prefix="/study-plan-items", tags=["study-plan"])


def _to_plan_out(plan, items, compressed: bool = False) -> StudyPlanOut:
    topics_by_id = {t.id: t.name for t in repository.list_topics(plan.course_id)}
    return StudyPlanOut(
        id=plan.id,
        exam_date=plan.exam_date,
        hours_per_day=plan.hours_per_day,
        compressed=compressed,
        items=[
            StudyPlanItemOut(
                id=item.id,
                topic_id=item.topic_id,
                topic_name=topics_by_id.get(item.topic_id, "Unknown topic"),
                scheduled_date=item.scheduled_date,
                completed=item.completed,
            )
            for item in items
        ],
    )


@router.post("", response_model=StudyPlanOut)
def create_study_plan(
    course_id: int, payload: StudyPlanCreate, user_id: str = Depends(get_current_user_id)
):
    require_course_owner(course_id, user_id)
    try:
        result = generate_study_plan(course_id, user_id, payload.exam_date, payload.hours_per_day)
    except ValueError as e:
        raise HTTPException(422, str(e))

    plan = result["plan"]
    return _to_plan_out(plan, plan.items, compressed=result["compressed"])


@router.get("", response_model=StudyPlanOut | None)
def get_study_plan(course_id: int, user_id: str = Depends(get_current_user_id)):
    require_course_owner(course_id, user_id)
    plan = repository.get_latest_study_plan(course_id, user_id)
    if plan is None:
        return None
    items = repository.list_study_plan_items(plan.id)
    return _to_plan_out(plan, items)


@item_router.patch("/{item_id}/complete", response_model=StudyPlanItemOut)
def toggle_item_complete(item_id: int, completed: bool, user_id: str = Depends(get_current_user_id)):
    require_study_plan_item_owner(item_id, user_id)
    item = repository.set_study_plan_item_completed(item_id, completed)
    topic = repository.get_topic(item.topic_id)
    return StudyPlanItemOut(
        id=item.id,
        topic_id=item.topic_id,
        topic_name=topic.name if topic else "Unknown topic",
        scheduled_date=item.scheduled_date,
        completed=item.completed,
    )
