"""
app/agents/grading.py - Score a student's attempt and update their topic
mastery.

Theory grading is rubric-based (see build plan): grade against the fixed
rubric generated at question-creation time by checking each point
present/absent, then sum — not "give a score out of 10" directly. This is
far more consistent across grading runs and is what produces the
"Missing: Initial Value Property" style output.
"""

from __future__ import annotations

import math

from app.agents.common import AgentParseError, call_llm_json_with_retry
from app.db.repository import repository
from app.utils.logger import get_logger

logger = get_logger(__name__)

_GRADING_SYSTEM_PROMPT = """You are grading a Nigerian university student's exam answer against a
fixed rubric. Be fair but rigorous — this mirrors real exam grading, not a pep talk.

For EACH rubric point, first think briefly about exactly what the student wrote that is
relevant to this point (or the absence of it), then decide: "met", "partial", or "missing".
A "partial" counts as half credit. Base this only on what the student actually wrote, not
what they probably meant. Your reasoning should be specific enough that the student can see
exactly what was missing or weak in their answer - this is their main feedback.

Respond with ONLY this JSON object, no prose, no markdown fences:
{
  "results": [
    {"point": "Initial Value Property", "reasoning": "Student never mentioned the limit as s tends to infinity", "status": "missing"},
    {"point": "Linearity Property", "reasoning": "Student stated scaling but not additivity", "status": "partial"},
    ...
  ]
}
"""

_STATUS_CREDIT = {"met": 1.0, "partial": 0.5, "missing": 0.0}


def grade_theory_answer(question_id: int, user_id: str, student_answer: str) -> dict:
    question = repository.get_question(question_id)
    if question is None or question.type != "theory":
        raise ValueError(f"Question {question_id} is not a theory question")

    rubric = question.rubric or []
    if not rubric:
        raise ValueError(f"Question {question_id} has no rubric to grade against")

    rubric_lines = "\n".join(
        f"- {p['point']}: {p.get('description', '')}" for p in rubric
    )
    user_prompt = (
        f"QUESTION: {question.prompt}\n\n"
        f"RUBRIC:\n{rubric_lines}\n\n"
        f"STUDENT ANSWER:\n{student_answer}\n\n"
        "Grade against the rubric now."
    )

    try:
        parsed = call_llm_json_with_retry(
            system_prompt=_GRADING_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            doc_id=f"question-{question_id}-grading",
        )
    except AgentParseError:
        logger.error("Grading returned unparsable output for question %s after retries", question_id)
        raise

    results = parsed.get("results", [])
    max_score = len(rubric)
    earned = 0.0
    gaps: list[dict] = []

    # Match by point name; if the model dropped or renamed a point, treat it
    # as missing rather than silently under-counting max_score.
    results_by_point = {r.get("point", "").strip().lower(): r for r in results}
    for p in rubric:
        key = p["point"].strip().lower()
        r = results_by_point.get(key)
        status = (r.get("status") if r else "missing") or "missing"
        credit = _STATUS_CREDIT.get(status, 0.0)
        earned += credit
        if credit < 1.0:
            reasoning = (r.get("reasoning") if r else None) or "Not addressed in your answer."
            gaps.append({"point": p["point"], "reason": reasoning})

    score = math.floor(earned + 0.5)  # round-half-up: earned=0.5 must show as 1, not 0.
    # (Python's round() uses banker's rounding - round(0.5) == 0 - which would make a
    # single "partial" credit on a small rubric silently disappear from the displayed score.)
    max_score_int = max_score

    repository.create_attempt(
        user_id=user_id,
        question_id=question_id,
        student_answer=student_answer,
        score=score,
        max_score=max_score_int,
        gaps=gaps,
    )

    mastery_pct = int(round((earned / max_score) * 100)) if max_score else 0
    repository.upsert_topic_mastery(user_id=user_id, topic_id=question.topic_id, mastery_score=mastery_pct)

    return {"score": score, "max_score": max_score_int, "gaps": gaps}


def grade_cbt_answer(question_id: int, user_id: str, selected_option: str) -> dict:
    question = repository.get_question(question_id)
    if question is None or question.type != "cbt":
        raise ValueError(f"Question {question_id} is not a CBT question")

    selected = selected_option.strip().upper()
    is_correct = selected == (question.correct_answer or "").strip().upper()

    repository.create_attempt(
        user_id=user_id,
        question_id=question_id,
        student_answer=selected,
        is_correct="correct" if is_correct else "incorrect",
    )

    mastery_pct = 100 if is_correct else 0
    repository.upsert_topic_mastery(user_id=user_id, topic_id=question.topic_id, mastery_score=mastery_pct)

    return {
        "is_correct": is_correct,
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
    }
