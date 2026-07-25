"""app/api/questions.py - Generate and fetch theory/CBT questions for a topic."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.agents.question_generation import generate_cbt_batch, generate_theory_question
from app.api.deps import require_topic_owner
from app.api.schemas import CBTQuestionOut, TheoryQuestionOut
from app.auth import get_current_user_id
from app.db.repository import repository
from app.rate_limit import rate_limit

router = APIRouter(prefix="/topics/{topic_id}/questions", tags=["questions"])


@router.post("/theory/generate", response_model=TheoryQuestionOut)
def generate_theory(
    topic_id: int,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("theory_generate", max_calls=15, window_seconds=300)),
):
    require_topic_owner(topic_id, user_id)

    question = generate_theory_question(topic_id)
    if question is None:
        raise HTTPException(422, "Could not generate a theory question for this topic")
    return question


@router.get("/theory", response_model=list[TheoryQuestionOut])
def list_theory_questions(topic_id: int, user_id: str = Depends(get_current_user_id)):
    require_topic_owner(topic_id, user_id)
    return repository.list_questions(topic_id, type="theory")


@router.post("/cbt/generate", response_model=list[CBTQuestionOut])
def generate_cbt(
    topic_id: int,
    n: int = Query(default=5, ge=1, le=20),
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("cbt_generate", max_calls=15, window_seconds=300)),
):
    require_topic_owner(topic_id, user_id)

    questions = generate_cbt_batch(topic_id, n=n)
    if not questions:
        raise HTTPException(422, "Could not generate CBT questions for this topic")
    return questions


@router.get("/cbt", response_model=list[CBTQuestionOut])
def list_cbt_questions(topic_id: int, user_id: str = Depends(get_current_user_id)):
    require_topic_owner(topic_id, user_id)
    return repository.list_questions(topic_id, type="cbt")
