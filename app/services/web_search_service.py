"""
app/services/web_search_service.py - Thin wrapper around Tavily's search
API for the Smart Library's online-resources feature.

Tavily specifically (not a generic Google/Bing scrape) because it's built
for exactly this use case - AI-agent-facing search with a genuine free
tier (1,000 credits/month, no card required, 1 credit per basic search)
and results that come back already cleaned rather than raw HTML to
parse. Isolated in its own module so switching providers later (Serper,
Brave, etc.) only means rewriting this one file, not touching the agent
or API layer that calls it.
"""

from __future__ import annotations

from urllib.parse import urlparse

import requests

from app.config import _env_str  # reuse the same env-loading helper as everything else
from app.utils.logger import get_logger

logger = get_logger(__name__)

TAVILY_API_KEY = _env_str("TAVILY_API_KEY")
TAVILY_URL = "https://api.tavily.com/search"


class WebSearchError(Exception):
    pass


def search(query: str, max_results: int = 5) -> list[dict]:
    """Returns [{"title", "url", "snippet", "source_domain"}, ...].
    Raises WebSearchError on failure - callers decide whether that's
    fatal (a fresh search request) or just means falling back to
    whatever's already cached (see agents/smart_library.py)."""
    if not TAVILY_API_KEY:
        raise WebSearchError("TAVILY_API_KEY is not configured on the server")

    try:
        response = requests.post(
            TAVILY_URL,
            json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "search_depth": "basic",  # 1 credit per call, not "advanced" (2 credits) - snippets are enough here
                "max_results": max_results,
            },
            timeout=15,
        )
        response.raise_for_status()
    except requests.RequestException as e:
        logger.error("Tavily search failed for query '%s': %s", query, e)
        raise WebSearchError(str(e)) from e

    data = response.json()
    results = []
    for item in data.get("results", []):
        url = item.get("url", "")
        results.append({
            "title": item.get("title", "").strip() or url,
            "url": url,
            "snippet": (item.get("content") or "").strip()[:400],
            "source_domain": urlparse(url).netloc.replace("www.", ""),
        })
    return results
