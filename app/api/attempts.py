"""app/api/attempts.py - Submit answers for grading, and query weak areas."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.agents.grading import grade_cbt_answer, grade_theory_answer
from app.agents.common import AgentParseError
from app.api.deps import require_course_owner, require_question_owner
from app.api.schemas import (
    CBTAttemptRequest,
    CBTAttemptResult,
    TheoryAttemptRequest,
    TheoryAttemptResult,
    WeakAreaOut,
)
from app.auth import get_current_user_id
from app.db.repository import repository

router = APIRouter(tags=["attempts"])


@router.post("/questions/{question_id}/theory-attempts", response_model=TheoryAttemptResult)
def submit_theory_attempt(
    question_id: int, payload: TheoryAttemptRequest, user_id: str = Depends(get_current_user_id)
):
    require_question_owner(question_id, user_id)
    try:
        result = grade_theory_answer(question_id, user_id, payload.student_answer)
    except AgentParseError:
        raise HTTPException(502, "Grading failed — the model returned an unparsable response, try again")
    except ValueError as e:
        raise HTTPException(404, str(e))
    return TheoryAttemptResult(**result)


@router.post("/questions/{question_id}/cbt-attempts", response_model=CBTAttemptResult)
def submit_cbt_attempt(
    question_id: int, payload: CBTAttemptRequest, user_id: str = Depends(get_current_user_id)
):
    require_question_owner(question_id, user_id)
    try:
        result = grade_cbt_answer(question_id, user_id, payload.selected_option)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return CBTAttemptResult(**result)


@router.get("/courses/{course_id}/weak-areas", response_model=list[WeakAreaOut])
def get_weak_areas(course_id: int, limit: int = 10, user_id: str = Depends(get_current_user_id)):
    require_course_owner(course_id, user_id)
    return repository.get_weak_areas(course_id, user_id, limit=limit)
