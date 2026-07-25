"""
app/agents/topic_extraction.py - Extract exam-relevant topics from a
course's uploaded materials.

MVP-week approach: pull all ready chunks for the course's documents,
truncate to a context budget, ask the model for a structured topic list
in one call. Good enough for a handful of PDFs; if a course ends up with
much more material than fits the budget, revisit with a map-reduce
(extract per-document, then merge/dedupe) rather than truncating harder.
"""

from __future__ import annotations

from app.agents.common import AgentParseError, call_llm_json_with_retry, truncate_for_context
from app.db.models import Topic
from app.db.repository import repository
from app.utils.logger import get_logger

logger = get_logger(__name__)

_SYSTEM_PROMPT = """You are an exam-preparation assistant for Nigerian university students.

Given raw course material (lecture notes, slides, or textbook excerpts), identify the
distinct topics a student would need to master for an exam on this material.

Before answering, think through the material: what would a lecturer actually build exam
questions around? Depth of coverage, worked examples, and repeated emphasis are stronger
signals than a topic simply being mentioned once. Put this thinking in a "reasoning" field,
then give your final topic list.

Rules:
- Extract 5-15 topics depending on material depth. Don't over-split (e.g. "Euler's Method"
  is one topic, not separate topics for "Euler's Method Part 1" and "Part 2").
- Topic names should be exam-answer-sheet-ready: concise, standard terminology a lecturer
  would use (e.g. "Laplace Transform Properties", not "stuff about Laplace").
- Assign each topic a frequency_score from 1-10 estimating how central it seems to the
  material (more coverage/detail = higher score). This is a rough prior, not a guarantee —
  it gets refined later by past-question analysis.
- Respond with ONLY this JSON object, no prose, no markdown fences:
  {
    "reasoning": "brief note on what stood out as most exam-relevant and why",
    "topics": [{"name": "Euler's Method", "frequency_score": 7}, ...]
  }
"""


def extract_topics(course_id: int) -> list[Topic]:
    doc_ids = repository.get_course_document_ids(course_id)
    if not doc_ids:
        logger.warning("extract_topics: course %s has no ready documents", course_id)
        return []

    rows = repository.get_library_chunks(doc_ids=doc_ids)
    if not rows:
        logger.warning("extract_topics: course %s has documents but no ready chunks yet", course_id)
        return []

    material_text = "\n\n".join(chunk.content for chunk, _document in rows)
    material_text = truncate_for_context(material_text)

    user_prompt = f"COURSE MATERIAL:\n{'=' * 60}\n{material_text}\n{'=' * 60}\n\nExtract the topic list now."

    try:
        parsed = call_llm_json_with_retry(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            doc_id=f"course-{course_id}-topics",
        )
    except AgentParseError:
        logger.error("Topic extraction returned unparsable output for course %s after retries", course_id)
        return []

    if not isinstance(parsed, dict) or "topics" not in parsed:
        logger.error("Topic extraction expected {reasoning, topics}, got %s", type(parsed))
        return []

    if reasoning := parsed.get("reasoning"):
        logger.info("Topic extraction reasoning for course %s: %s", course_id, str(reasoning)[:300])

    topics_payload = []
    for item in parsed["topics"]:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        topics_payload.append({
            "name": name,
            "frequency_score": int(item.get("frequency_score", 5)),
            "source_chunk_ids": [],
        })

    if not topics_payload:
        return []

    return repository.bulk_create_topics(course_id, topics_payload)
