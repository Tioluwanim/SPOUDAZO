"""
app/services/smart_search_service.py - Section 15's "Smart Search
Service", backing Section 12's "Smart Search" requirement (this was a
genuine gap - the reader only had client-side substring search within
one open document; there was no cross-library search at all before this).

Combines:
  - Hybrid (semantic + keyword + metadata) search over the student's own
    document content, via rag_service.search_library - which now also
    does BM25 fusion (see rag_service.py), not just vector search.
  - A separate text match over the student's own highlights/bookmarks,
    since those aren't part of the vector index.
Scoped to documents the requesting user actually owns (via
repository.get_user_ready_documents) - the vector index itself has no
per-user partitioning, so this service is where that boundary is enforced.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.db.repository import repository
from app.services.rag_service import rag_service


@dataclass
class SearchHit:
    kind: str          # "content" | "highlight" | "bookmark"
    doc_id: str
    filename: str
    course_id: int
    snippet: str
    score: float
    section_title: str = ""
    page_number: int | None = None
    annotation_id: int | None = None


def search(user_id: str, query: str, course_id: int | None = None, limit: int = 20) -> list[SearchHit]:
    if not query.strip():
        return []

    owned_docs = repository.get_user_ready_documents(user_id, course_id=course_id)
    if not owned_docs:
        return _search_annotations(user_id, query, limit)

    doc_meta = {d["doc_id"]: d for d in owned_docs}
    doc_ids = list(doc_meta.keys())

    response = rag_service.search_library(query=query, doc_ids=doc_ids, top_k=limit)

    hits: list[SearchHit] = [
        SearchHit(
            kind="content",
            doc_id=r.chunk.doc_id,
            filename=doc_meta.get(r.chunk.doc_id, {}).get("filename", r.chunk.doc_id),
            course_id=doc_meta.get(r.chunk.doc_id, {}).get("course_id", 0),
            snippet=r.chunk.content[:280],
            score=r.score,
            page_number=r.chunk.page_number,
        )
        for r in response.results
    ]

    hits.extend(_search_annotations(user_id, query, limit))

    hits.sort(key=lambda h: h.score, reverse=True)
    return hits[:limit]


def _search_annotations(user_id: str, query: str, limit: int) -> list[SearchHit]:
    annotations = repository.search_annotations(user_id, query, limit=limit)
    hits: list[SearchHit] = []
    for ann in annotations:
        document = repository.get_document_by_doc_id(ann.doc_id)
        if document is None or document.course_id is None:
            continue
        hits.append(SearchHit(
            kind=ann.kind,
            doc_id=ann.doc_id,
            filename=document.filename,
            course_id=document.course_id,
            snippet=ann.note or ann.quote,
            # Annotation matches don't have a comparable embedding score -
            # fixed just below the minimum useful semantic threshold so
            # they show up, but content matches with a real relevance
            # score are never pushed below an annotation hit.
            score=0.5,
            annotation_id=ann.id,
        ))
    return hits
