"""
app/agents/study_planner.py - Daily revision schedule generator.

Deliberately not an LLM call. Scheduling "study Euler's Method on
Tuesday" doesn't need a language model to guess at - it needs the
weak-area ranking that already exists (repository.get_weak_areas) and
some arithmetic to spread topics across the days left before the exam.
Keeping this deterministic means it can't fail with malformed JSON the
way the generation/grading agents occasionally can, and it's actually
easier to reason about and test.

Algorithm: weakest-mastery topics get scheduled first (and get revisited
more than once if there are more available days than topics), spread
across the days between today and the exam date. hours_per_day caps how
many topics land on a single day - if there genuinely isn't enough time
to cover everything once before the exam, the plan compresses rather
than running past the exam date, and the response says so.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.db.repository import repository


def generate_study_plan(course_id: int, user_id: str, exam_date: datetime, hours_per_day: int) -> dict:
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # The frontend sends exam_date as an ISO string with a trailing "Z"
    # (new Date(...).toISOString()), which Pydantic parses as timezone-
    # AWARE. today (from utcnow()) is naive. Python refuses to subtract
    # an aware and a naive datetime, so normalize to naive here rather
    # than at every call site - this is the one place exam_date enters
    # the system.
    if exam_date.tzinfo is not None:
        exam_date = exam_date.replace(tzinfo=None)
    exam_day = exam_date.replace(hour=0, minute=0, second=0, microsecond=0)

    days_remaining = (exam_day - today).days
    if days_remaining < 1:
        raise ValueError("Exam date must be at least a day from now")

    hours_per_day = max(1, hours_per_day)

    # Weakest-mastery topics first; unattempted topics already default to
    # mastery_score=0 in get_weak_areas, so a brand-new course's topics all
    # start tied and just take extraction order.
    ranked = repository.get_weak_areas(course_id, user_id, limit=1000)
    if not ranked:
        raise ValueError("This course has no topics yet - extract topics before building a plan")

    topic_ids_ranked = [t["topic_id"] for t in ranked]

    total_slots = days_remaining * hours_per_day
    schedule: list[int] = []
    compressed = False

    if total_slots >= len(topic_ids_ranked):
        # Enough room to cover every topic once, then loop back over the
        # weakest ones again as revision passes until the days run out.
        i = 0
        while len(schedule) < total_slots:
            schedule.append(topic_ids_ranked[i % len(topic_ids_ranked)])
            i += 1
    else:
        # Not enough days at this pace to cover every topic once -
        # compress: spread all topics evenly across the available slots,
        # dropping revision passes, and flag it so the student knows.
        compressed = True
        step = len(topic_ids_ranked) / total_slots
        schedule = [topic_ids_ranked[int(i * step)] for i in range(total_slots)]

    items = []
    for day_offset in range(days_remaining):
        day_topics = schedule[day_offset * hours_per_day : (day_offset + 1) * hours_per_day]
        scheduled_date = today + timedelta(days=day_offset)
        for topic_id in day_topics:
            items.append({"topic_id": topic_id, "scheduled_date": scheduled_date})

    plan = repository.create_study_plan(
        course_id=course_id,
        user_id=user_id,
        exam_date=exam_day,
        hours_per_day=hours_per_day,
        items=items,
    )

    return {"plan": plan, "compressed": compressed}