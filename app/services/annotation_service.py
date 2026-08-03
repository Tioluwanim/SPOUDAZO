"""
app/services/annotation_service.py - Section 15's "Annotation Service".

Validation + persistence for highlights and bookmarks. Depends on
reader_service (to confirm the document is actually readable before
annotating it) but nothing else - doesn't know about chat, search, or
analytics.
"""

from __future__ import annotations

from fastapi import HTTPException

from app.db.models import Annotation
from app.db.repository import repository
from app.services import reader_service

VALID_KINDS = ("highlight", "bookmark", "sticky_note")


def create(course_id: int, doc_id: str, user_id: str, kind: str, section_index: int, quote: str, note: str | None) -> Annotation:
    reader_service.require_readable_document(course_id, doc_id, user_id)
    if kind not in VALID_KINDS:
        raise HTTPException(422, f"kind must be one of {VALID_KINDS}")
    if not quote.strip():
        raise HTTPException(422, "quote cannot be empty")
    return repository.create_annotation(
        user_id=user_id, doc_id=doc_id, kind=kind,
        section_index=section_index, quote=quote.strip(),
        note=note.strip() if note else None,
    )


def list_for_document(course_id: int, doc_id: str, user_id: str, kind: str | None = None) -> list[Annotation]:
    reader_service.require_readable_document(course_id, doc_id, user_id)
    return repository.list_annotations(user_id, doc_id, kind=kind)


def delete(course_id: int, doc_id: str, annotation_id: int, user_id: str) -> None:
    reader_service.require_readable_document(course_id, doc_id, user_id)
    ann = repository.get_annotation(annotation_id)
    if ann is None or ann.doc_id != doc_id or ann.user_id != user_id:
        raise HTTPException(404, "Annotation not found")
    repository.delete_annotation(annotation_id)
