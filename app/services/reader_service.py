"""
app/services/reader_service.py - Section 15's "Reader Service".

Owns the rules for "can this user read this document right now" and the
shape of what the reading pane gets back. app/api/materials.py calls this
instead of touching repository/pdf_service ownership logic directly.
"""

from __future__ import annotations

from typing import Iterator

from fastapi import HTTPException

from app.api.deps import require_course_owner, require_document_owner
from app.db.models import Document
from app.models.schemas import DocumentStatus, ProcessedDocument
from app.services.pdf_service import pdf_service
from app.services.storage import storage_service


def require_readable_document(course_id: int, doc_id: str, user_id: str) -> Document:
    """The document must exist, belong to this course, be owned by this
    user, AND be fully processed. Shared by every reader endpoint
    (annotations/favorites/progress/text-actions/thumbnails) - none of
    those make sense against a document that isn't READY yet."""
    require_course_owner(course_id, user_id)
    document = require_document_owner(doc_id, user_id)
    if document.course_id != course_id:
        raise HTTPException(404, "Document not found")
    if document.status != DocumentStatus.READY.value:
        raise HTTPException(
            409,
            f"Document is still processing (status: {document.status}) - "
            "try again once it finishes.",
        )
    return document


def get_reader_document(course_id: int, doc_id: str, user_id: str) -> tuple[Document, ProcessedDocument]:
    """Returns (the DB row, the fully-loaded content) for the reading pane."""
    document = require_readable_document(course_id, doc_id, user_id)
    processed = pdf_service.load_document(doc_id)
    if processed is None:
        raise HTTPException(404, "Document not found")
    return document, processed


def get_page_thumbnail_path(course_id: int, doc_id: str, page_number: int, user_id: str):
    require_readable_document(course_id, doc_id, user_id)
    path = pdf_service.get_page_thumbnail(doc_id, page_number)
    if path is None:
        raise HTTPException(404, "No thumbnail available for that page")
    return path


def get_original_file_stream(
    course_id: int, doc_id: str, user_id: str, range_header: str | None,
) -> tuple[Iterator[bytes], int, int, int, str, str]:
    """
    Returns (byte_iterator, start, end, total_size, filename, mime_type)
    for "Original PDF" mode / range-request streaming. Goes through
    StorageService.stream() (not get_local_file_path + open()) so this
    works identically for both local and r2 documents, and so an r2
    document's file isn't fully downloaded server-side just to serve one
    byte range - the whole point of Range support.
    """
    document = require_readable_document(course_id, doc_id, user_id)
    if not document.storage_key:
        # Legacy row predating StorageService - fall back to the local
        # file directly rather than erroring on documents that otherwise
        # work fine everywhere else in the app.
        import mimetypes
        from pathlib import Path
        path = pdf_service.get_local_file_path(doc_id)
        if path is None:
            raise HTTPException(404, "Original file not found")
        total_size = path.stat().st_size
        start, end = 0, total_size - 1
        if range_header and range_header.startswith("bytes="):
            spec = range_header.removeprefix("bytes=")
            s, _, e = spec.partition("-")
            start = int(s) if s else 0
            end = min(int(e), total_size - 1) if e else total_size - 1

        def _iter(chunk_size: int = 64 * 1024) -> Iterator[bytes]:
            with path.open("rb") as f:
                f.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    chunk = f.read(min(chunk_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        mime_type = mimetypes.guess_type(document.filename)[0] or "application/octet-stream"
        return _iter(), start, end, total_size, document.filename, mime_type

    try:
        byte_iter, start, end, total_size = storage_service.stream(document.storage_key, range_header)
    except FileNotFoundError:
        raise HTTPException(404, "Original file not found in storage")
    except Exception:
        raise HTTPException(502, "Couldn't read the original file from storage")

    return byte_iter, start, end, total_size, document.filename, document.mime_type or "application/pdf"


def delete_document(course_id: int, doc_id: str, user_id: str) -> None:
    document = require_document_owner(doc_id, user_id)
    if document.course_id != course_id:
        raise HTTPException(404, "Document not found")
    pdf_service.delete_document(doc_id)
