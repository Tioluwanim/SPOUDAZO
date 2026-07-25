"""app/api/resources.py - Online resources for a topic (Smart Library)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.agents.smart_library import get_or_fetch_resources
from app.api.deps import require_topic_owner
from app.api.schemas import TopicResourceOut
from app.auth import get_current_user_id
from app.rate_limit import rate_limit
from app.services.web_search_service import WebSearchError

router = APIRouter(prefix="/topics/{topic_id}/resources", tags=["resources"])


@router.get("", response_model=list[TopicResourceOut])
def get_resources(topic_id: int, user_id: str = Depends(get_current_user_id)):
    require_topic_owner(topic_id, user_id)
    try:
        return get_or_fetch_resources(topic_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except WebSearchError as e:
        raise HTTPException(502, f"Couldn't reach the web search service: {e}")


@router.post("/refresh", response_model=list[TopicResourceOut])
def refresh_resources(
    topic_id: int,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("resource_refresh", max_calls=10, window_seconds=600)),
):
    require_topic_owner(topic_id, user_id)
    try:
        return get_or_fetch_resources(topic_id, force_refresh=True)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except WebSearchError as e:
        raise HTTPException(502, f"Couldn't reach the web search service: {e}")
