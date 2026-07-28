"""
app/api/library.py - Cross-course Smart Library aggregation.

Everything under app/api/materials.py is scoped to one course (it's
nested under /courses/{course_id}/materials); the reader's sidebar needs
"Recent Documents" and "Bookmarks" to span every course a student has,
which is what this router is for. Kept separate from materials.py rather
than adding course_id-less duplicate routes there.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.schemas import BookmarkOut, ReadingStatsOut, RecentDocumentOut
from app.auth import get_current_user_id
from app.db.repository import repository

router = APIRouter(prefix="/library", tags=["library"])


@router.get("/analytics", response_model=ReadingStatsOut)
def get_reading_analytics(user_id: str = Depends(get_current_user_id)):
    """Reading-specific stats only (time read, streak, highlights/bookmarks/
    favorites, documents started/completed) - topic mastery and exam
    readiness already live on the Progress page and aren't duplicated
    here to avoid two different "readiness" numbers disagreeing with
    each other."""
    stats = repository.get_reading_stats(user_id)
    return ReadingStatsOut(**stats)


@router.get("/recent", response_model=list[RecentDocumentOut])
def list_recent_documents(limit: int = 10, user_id: str = Depends(get_current_user_id)):
    rows = repository.list_recent_documents(user_id, limit=min(limit, 50))
    return [
        RecentDocumentOut(
            doc_id=r["doc_id"], filename=r["filename"], course_id=r["course_id"],
            progress_percent=r["progress_percent"], last_viewed_at=r["last_viewed_at"],
        )
        for r in rows
    ]


@router.get("/bookmarks", response_model=list[BookmarkOut])
def list_bookmarks(limit: int = 50, user_id: str = Depends(get_current_user_id)):
    rows = repository.list_bookmarks_for_user(user_id, limit=min(limit, 200))
    out: list[BookmarkOut] = []
    for ann in rows:
        document = repository.get_document_by_doc_id(ann.doc_id)
        if document is None or document.course_id is None:
            continue  # orphaned annotation (document since deleted) - skip rather than error
        out.append(BookmarkOut(
            id=ann.id, doc_id=ann.doc_id, filename=document.filename,
            course_id=document.course_id, section_index=ann.section_index,
            quote=ann.quote, note=ann.note, created_at=ann.created_at,
        ))
    return out


@router.get("/favorites", response_model=list[RecentDocumentOut])
def list_favorites(user_id: str = Depends(get_current_user_id)):
    """Reuses RecentDocumentOut's shape (doc_id/filename/course_id/progress) -
    favorites are just materials, same fields the sidebar needs to render
    either list the same way."""
    doc_ids = repository.list_favorite_doc_ids(user_id)
    out: list[RecentDocumentOut] = []
    for doc_id in doc_ids:
        document = repository.get_document_by_doc_id(doc_id)
        if document is None or document.course_id is None:
            continue
        progress = repository.get_reading_progress(user_id, doc_id)
        out.append(RecentDocumentOut(
            doc_id=doc_id, filename=document.filename, course_id=document.course_id,
            progress_percent=progress.progress_percent if progress else 0,
            last_viewed_at=progress.last_viewed_at if progress else document.modified_time or document.created_at,
        ))
    return out
