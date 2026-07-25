"""
app/agents/question_generation.py - Generate theory and CBT questions for
a topic, grounded in the course's actual material via rag_service.

Theory questions get a rubric generated alongside the question — this is
the piece the grading agent depends on. Generate and cache rubrics here,
at question-creation time, not at grading time, so every student grades
against the same rubric (see build plan: this is the main cost/quality
lever for the grading feature).
"""

from __future__ import annotations

from app.agents.common import AgentParseError, call_llm_json_with_retry
from app.db.models import Question
from app.db.repository import repository
from app.services.rag_service import rag_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

_THEORY_SYSTEM_PROMPT = """You are an exam-preparation assistant for Nigerian university students.

Given course material excerpts about a specific topic, write ONE theory exam question and
a grading rubric for it, in the style a lecturer would actually ask and grade.

Before answering, think about what specifically makes this topic hard or exam-relevant based
on the material given - what would a lecturer emphasize, and what do students typically get
wrong or leave out. Put this thinking in a "reasoning" field, then write the question and rubric.

Rules:
- The question should be answerable from the given material and typical of a real exam
  ("Explain...", "State and derive...", "Differentiate between...").
- The rubric is a list of distinct, checkable points an examiner would look for — not a
  full model answer. 3-6 points is typical. Each point should be specific enough that a
  grader (human or AI) could check "is this present in the student's answer: yes/no/partial".
- Respond with ONLY this JSON object, no prose, no markdown fences:
  {
    "reasoning": "brief note on what this question is really testing and common gaps",
    "question": "...",
    "rubric": [
      {"point": "Initial Value Property", "description": "States that L{f(0)} relates to lim s->inf of sF(s)"},
      ...
    ]
  }
"""

_CBT_SYSTEM_PROMPT = """You are an exam-preparation assistant for Nigerian university students.

Given course material excerpts about a specific topic, write multiple-choice questions
(CBT style) with 4 options (A-D), typical of a real computer-based test. The user message
tells you exactly how many to generate.

For each question, think briefly about what misconception each wrong option is designed to
catch before finalizing it - a good distractor targets a real, plausible error, not a random
wrong fact.

Rules:
- Each question must have exactly one correct answer, clearly determinable from the material.
- Distractors (wrong options) should be plausible — common misconceptions or near-misses,
  not obviously wrong filler.
- Include a short explanation (1-2 sentences) for why the correct answer is correct.
- Respond with ONLY this JSON object, no prose, no markdown fences:
  {
    "reasoning": "brief note on the misconceptions these distractors target",
    "questions": [
      {
        "question": "...",
        "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
        "correct_answer": "B",
        "explanation": "..."
      },
      ...
    ]
  }
"""


def _get_topic_context(topic_id: int) -> tuple[int, str, str]:
    """Returns (course_id, topic_name, context_text) for a topic, using
    rag_service to pull material relevant to the topic name specifically
    (not the whole course's material — question generation should be
    grounded in the parts of the material that actually cover this topic)."""
    topic = repository.get_topic(topic_id)
    if topic is None:
        raise ValueError(f"Topic {topic_id} not found")

    doc_ids = repository.get_course_document_ids(topic.course_id)
    context, _results = rag_service.get_library_context(
        query=topic.name,
        doc_ids=doc_ids,
        top_k=6,
    )
    return topic.course_id, topic.name, context


def generate_theory_question(topic_id: int) -> Question | None:
    course_id, topic_name, context = _get_topic_context(topic_id)
    if not context:
        logger.warning("generate_theory_question: no retrievable context for topic %s", topic_id)

    user_prompt = (
        f"TOPIC: {topic_name}\n\n"
        f"MATERIAL EXCERPTS:\n{'=' * 60}\n{context or '(no material retrieved — write from the topic name alone)'}\n{'=' * 60}\n\n"
        "Generate the question and rubric now."
    )

    try:
        parsed = call_llm_json_with_retry(
            system_prompt=_THEORY_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            doc_id=f"topic-{topic_id}-theory-gen",
        )
    except AgentParseError:
        logger.error("Theory question generation returned unparsable output for topic %s after retries", topic_id)
        return None

    if reasoning := parsed.get("reasoning"):
        logger.info("Theory question reasoning for topic %s: %s", topic_id, str(reasoning)[:300])

    question_text = (parsed.get("question") or "").strip()
    rubric = parsed.get("rubric") or []
    if not question_text or not rubric:
        logger.error("Theory question generation returned incomplete payload for topic %s", topic_id)
        return None

    return repository.create_question(
        course_id=course_id,
        topic_id=topic_id,
        type="theory",
        prompt=question_text,
        rubric=rubric,
    )


def generate_cbt_batch(topic_id: int, n: int = 5) -> list[Question]:
    course_id, topic_name, context = _get_topic_context(topic_id)
    if not context:
        logger.warning("generate_cbt_batch: no retrievable context for topic %s", topic_id)

    user_prompt = (
        f"TOPIC: {topic_name}\n\n"
        f"MATERIAL EXCERPTS:\n{'=' * 60}\n{context or '(no material retrieved — write from the topic name alone)'}\n{'=' * 60}\n\n"
        f"Generate {n} MCQs now."
    )

    try:
        parsed = call_llm_json_with_retry(
            system_prompt=_CBT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            doc_id=f"topic-{topic_id}-cbt-gen",
        )
    except AgentParseError:
        logger.error("CBT generation returned unparsable output for topic %s after retries", topic_id)
        return []

    if not isinstance(parsed, dict) or "questions" not in parsed:
        logger.error("CBT generation expected {reasoning, questions}, got %s", type(parsed))
        return []

    if reasoning := parsed.get("reasoning"):
        logger.info("CBT reasoning for topic %s: %s", topic_id, str(reasoning)[:300])

    created: list[Question] = []
    for item in parsed["questions"]:
        question_text = (item.get("question") or "").strip()
        options = item.get("options") or {}
        correct = (item.get("correct_answer") or "").strip().upper()
        if not question_text or not options or correct not in options:
            continue
        q = repository.create_question(
            course_id=course_id,
            topic_id=topic_id,
            type="cbt",
            prompt=question_text,
            options=options,
            correct_answer=correct,
            explanation=item.get("explanation"),
        )
        created.append(q)

    return created
