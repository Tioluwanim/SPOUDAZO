"""
app/agents/smart_library.py - Online resources for a topic (Smart
Library's "not just your own notes" piece).

Deliberately separate from rag_service/topic_extraction: those work
over the student's own uploaded material. This agent goes the other
direction - it searches the open web for resources *about* a topic
(articles, explainers, video lectures) to supplement what the student
uploaded, for when their own notes are thin on a topic or they just want
a second explanation of it.

Results are cached in TopicResource rather than re-searched on every
page view - see web_search_service.py's docstring for why (free-tier
search API, metered by request).
"""

from __future__ import annotations

from app.db.repository import repository
from app.services.web_search_service import WebSearchError, search
from app.utils.logger import get_logger

logger = get_logger(__name__)


def get_or_fetch_resources(topic_id: int, force_refresh: bool = False) -> list[dict]:
    if not force_refresh:
        cached = repository.list_topic_resources(topic_id)
        if cached:
            return cached

    topic = repository.get_topic(topic_id)
    if topic is None:
        raise ValueError(f"Topic {topic_id} not found")

    course = repository.get_course(topic.course_id)
    course_context = f"{course.code} {course.name}" if course else ""

    # A plain "<topic> explained" query rather than something clever - Tavily's
    # own ranking already favors authoritative results for a query this direct,
    # and a simpler query is easier to sanity-check when something looks off.
    query = f"{topic.name} {course_context} explained".strip()

    try:
        results = search(query, max_results=5)
    except WebSearchError:
        logger.warning("Web search failed for topic %s - falling back to any stale cache", topic_id)
        return repository.list_topic_resources(topic_id)  # empty list if nothing cached either

    if not results:
        return []

    return repository.replace_topic_resources(topic_id, results)
