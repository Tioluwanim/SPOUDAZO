"""
app/api/materials.py - Upload course material (PDF/DOCX/etc), run it
through the ported ingestion pipeline (extract → chunk → embed → index),
and attach it to a course.

Runs in the background: the upload endpoint returns as soon as the file
is saved and a Document row exists (fast - a few hundred ms), and the
slow extract → embed → index pipeline (which can take from seconds to
several minutes, especially on a cold BGE-M3 model load) runs after the
response via FastAPI's BackgroundTasks. The frontend polls
GET /courses/{id}/materials to see the status move from "uploaded" ->
"extracting" -> "embedding" -> "ready" (or "failed").

BackgroundTasks runs in the same process as the request, not a separate
worker - it's the right amount of infrastructure for this app's current
scale (no Redis/Celery needed), but it does mean a server restart mid-
processing loses that job. Revisit with a real task queue if that
becomes a real problem in practice.
"""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.api.deps import require_course_owner
from app.api.schemas import (
    AnnotationCreate,
    AnnotationOut,
    DocumentSectionOut,
    FavoriteToggleOut,
    MaterialDetailOut,
    MaterialOut,
    ReadingProgressIn,
    ReadingProgressOut,
    TextActionRequest,
    TextActionResponse,
)
from app.agents.text_actions import ALL_ACTIONS
from app.auth import get_current_user_id
from app.db.repository import repository
from app.models.schemas import DocumentStatus
from app.rate_limit import rate_limit
from app.services import annotation_service, reader_service, reading_analytics_service
from app.services.extraction_service import extraction_service
from app.services.pdf_service import pdf_service
from app.services.rag_service import rag_service
from app.services.text_action_cache import get_or_run_text_action
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/courses/{course_id}/materials", tags=["materials"])


def _process_material(doc_id: str) -> None:
    """Runs in the background after the upload response has already been
    sent. Any failure here is captured on the Document's own status/error
    fields (visible to the frontend via polling) - there's no request
    left to raise an HTTPException into."""
    doc = pdf_service.load_document(doc_id)
    if doc is None:
        logger.error("Background processing: document %s vanished before processing started", doc_id)
        return

    try:
        doc = extraction_service.process(doc)
        pdf_service.save_document(doc)
        if doc.status == DocumentStatus.FAILED:
            logger.error("Background extraction failed for %s: %s", doc_id, doc.error_message)
            return

        # Persist "embedding" BEFORE the slow call, not after - build_index()
        # sets this same status on the in-memory object internally, but that
        # change is invisible to anyone polling the DB until build_index
        # returns. On a cold BGE-M3 load that can be many minutes, during
        # which the frontend would otherwise show a stale "extracted" badge
        # with no signal that anything is actually happening.
        doc.status = DocumentStatus.EMBEDDING
        pdf_service.save_document(doc)

        doc = rag_service.build_index(doc)
        pdf_service.save_document(doc)
        if doc.status == DocumentStatus.FAILED:
            logger.error("Background indexing failed for %s: %s", doc_id, doc.error_message)
    except Exception as e:
        # Belt-and-suspenders: extraction_service/rag_service are expected
        # to catch their own errors and set status=FAILED, but a background
        # task that raises uncaught just disappears silently otherwise -
        # make sure the Document record reflects the failure either way.
        logger.exception("Unexpected error during background processing of %s", doc_id)
        doc.status = DocumentStatus.FAILED
        doc.error_message = str(e)
        pdf_service.save_document(doc)


@router.post("", response_model=MaterialOut)
async def upload_material(
    course_id: int,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    week_number: int | None = Form(default=None),
    user_id: str = Depends(get_current_user_id),
):
    require_course_owner(course_id, user_id)

    file_bytes = await file.read()
    checksum = hashlib.sha256(file_bytes).hexdigest()

    # Same content already processed in this course (double-click, retry
    # after a refresh, the same lecture note re-uploaded) - hand back the
    # existing material instead of re-extracting/re-embedding/re-indexing
    # content that's already there.
    existing = repository.get_ready_document_by_checksum(course_id, checksum)
    if existing:
        logger.info("Upload for course %s matched existing document %s by checksum - skipping reprocessing",
                    course_id, existing.doc_id)
        return MaterialOut(
            doc_id=existing.doc_id,
            filename=existing.filename,
            status=existing.status,
            chunk_count=existing.chunk_count,
            week_number=existing.week_number if week_number is None else week_number,
        )

    doc, error = pdf_service.save_upload(file_bytes, file.filename, checksum=checksum)
    if error:
        raise HTTPException(400, error.detail or error.error)

    repository.attach_document_to_course(doc.doc_id, course_id, week_number=week_number)
    background_tasks.add_task(_process_material, doc.doc_id)

    return MaterialOut(
        doc_id=doc.doc_id,
        filename=doc.filename,
        status=doc.status.value,
        chunk_count=doc.chunk_count,
        week_number=week_number,
    )


@router.get("", response_model=list[MaterialOut])
def list_materials(course_id: int, user_id: str = Depends(get_current_user_id)):
    require_course_owner(course_id, user_id)
    # One query for everything this view needs, instead of the previous
    # per-document loop through pdf_service.load_document() (see
    # repository.list_materials_summary for why that was expensive).
    rows = repository.list_materials_summary(course_id)
    return [
        MaterialOut(
            doc_id=r["doc_id"],
            filename=r["filename"],
            status=r["status"],
            chunk_count=r["chunk_count"],
            week_number=r["week_number"],
        )
        for r in rows
    ]


@router.get("/{doc_id}", response_model=MaterialDetailOut)
def get_material(course_id: int, doc_id: str, user_id: str = Depends(get_current_user_id)):
    """Powers the Smart Library reading pane - the structured content of one
    document (title + sections with page ranges), not the raw file. Sections
    already exist from the extraction pipeline; this just exposes them
    instead of re-deriving anything."""
    document, processed = reader_service.get_reader_document(course_id, doc_id, user_id)

    return MaterialDetailOut(
        doc_id=processed.doc_id,
        filename=processed.filename,
        status=processed.status.value,
        week_number=document.week_number,
        course_id=course_id,
        page_count=processed.metadata.page_count,
        word_count=processed.metadata.word_count,
        sections=[
            DocumentSectionOut(
                title=s.title,
                content=s.content,
                section_type=s.section_type.value,
                page_start=s.page_start,
                page_end=s.page_end,
            )
            for s in processed.sections
        ],
    )


# ── Annotations (highlights & bookmarks) ────────────────────────────────────

@router.post("/{doc_id}/annotations", response_model=AnnotationOut)
def create_annotation(
    course_id: int, doc_id: str, body: AnnotationCreate,
    user_id: str = Depends(get_current_user_id),
):
    ann = annotation_service.create(
        course_id, doc_id, user_id, body.kind, body.section_index, body.quote, body.note,
    )
    return AnnotationOut(
        id=ann.id, doc_id=ann.doc_id, kind=ann.kind, section_index=ann.section_index,
        quote=ann.quote, note=ann.note, created_at=ann.created_at,
    )


@router.get("/{doc_id}/annotations", response_model=list[AnnotationOut])
def list_annotations(
    course_id: int, doc_id: str, kind: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    rows = annotation_service.list_for_document(course_id, doc_id, user_id, kind=kind)
    return [
        AnnotationOut(
            id=a.id, doc_id=a.doc_id, kind=a.kind, section_index=a.section_index,
            quote=a.quote, note=a.note, created_at=a.created_at,
        )
        for a in rows
    ]


@router.delete("/{doc_id}/annotations/{annotation_id}", status_code=204)
def delete_annotation(
    course_id: int, doc_id: str, annotation_id: int,
    user_id: str = Depends(get_current_user_id),
):
    annotation_service.delete(course_id, doc_id, annotation_id, user_id)


# ── Favorites ────────────────────────────────────────────────────────────────

@router.post("/{doc_id}/favorite", response_model=FavoriteToggleOut)
def toggle_favorite(course_id: int, doc_id: str, user_id: str = Depends(get_current_user_id)):
    reader_service.require_readable_document(course_id, doc_id, user_id)
    favorited = repository.toggle_favorite(user_id, doc_id)
    return FavoriteToggleOut(doc_id=doc_id, favorited=favorited)


# ── Reading progress ─────────────────────────────────────────────────────────

@router.get("/{doc_id}/progress", response_model=ReadingProgressOut | None)
def get_reading_progress(course_id: int, doc_id: str, user_id: str = Depends(get_current_user_id)):
    reader_service.require_readable_document(course_id, doc_id, user_id)
    row = repository.get_reading_progress(user_id, doc_id)
    if row is None:
        return None
    return ReadingProgressOut(
        doc_id=doc_id, last_section_index=row.last_section_index,
        progress_percent=row.progress_percent, last_viewed_at=row.last_viewed_at,
    )


@router.put("/{doc_id}/progress", response_model=ReadingProgressOut)
def update_reading_progress(
    course_id: int, doc_id: str, body: ReadingProgressIn,
    user_id: str = Depends(get_current_user_id),
):
    reader_service.require_readable_document(course_id, doc_id, user_id)
    if not (0 <= body.progress_percent <= 100):
        raise HTTPException(422, "progress_percent must be between 0 and 100")
    row = reading_analytics_service.record_progress(
        user_id, doc_id, body.last_section_index, body.progress_percent, body.seconds_delta,
    )
    return ReadingProgressOut(
        doc_id=doc_id, last_section_index=row.last_section_index,
        progress_percent=row.progress_percent, last_viewed_at=row.last_viewed_at,
    )


# ── Highlight-to-ask AI actions ──────────────────────────────────────────────

@router.post("/{doc_id}/text-action", response_model=TextActionResponse)
def text_action(
    course_id: int, doc_id: str, body: TextActionRequest,
    user_id: str = Depends(get_current_user_id),
    _rl: None = Depends(rate_limit("reader_text_action", max_calls=60, window_seconds=300)),
):
    """Backs the reader's highlight-to-ask toolbar. See
    app/agents/text_actions.py for the full action list, and
    app/services/text_action_cache.py for why repeated identical requests
    don't re-hit the LLM."""
    reader_service.require_readable_document(course_id, doc_id, user_id)

    if body.action not in ALL_ACTIONS:
        raise HTTPException(422, f"Unknown action - expected one of {sorted(ALL_ACTIONS)}")
    if not body.selected_text.strip():
        raise HTTPException(422, "No text selected")
    if len(body.selected_text) > 6000:
        raise HTTPException(422, "Selected text is too long - try a shorter passage")

    course = repository.get_course(course_id)
    course_context = f"{course.code} {course.name}" if course else ""

    try:
        outcome = get_or_run_text_action(
            action=body.action,
            selected_text=body.selected_text,
            doc_id=doc_id,
            section_title=body.section_title,
            course_context=course_context,
            target_language=body.target_language,
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error(f"[{doc_id}] text-action '{body.action}' failed: {e}", exc_info=True)
        raise HTTPException(502, "The study assistant couldn't process that - try again")

    return TextActionResponse(action=body.action, kind=outcome["kind"], result=outcome["result"])


# ── Page thumbnails ──────────────────────────────────────────────────────────

@router.get("/{doc_id}/thumbnails/{page_number}")
def get_page_thumbnail(
    course_id: int, doc_id: str, page_number: int,
    user_id: str = Depends(get_current_user_id),
):
    path = reader_service.get_page_thumbnail_path(course_id, doc_id, page_number, user_id)
    return FileResponse(str(path), media_type="image/png")


# ── Original file (PDF mode / download) ─────────────────────────────────────

@router.get("/{doc_id}/file")
def stream_original_file(
    course_id: int, doc_id: str, request: Request,
    user_id: str = Depends(get_current_user_id),
):
    """
    Original PDF mode's data source. Honors HTTP Range requests (what
    react-pdf/pdf.js issue for lazy page-by-page loading) - the response
    is 206 Partial Content with Content-Range when a Range header is
    present, 200 with the full body otherwise. Never downloads a whole
    r2-stored file server-side just to serve one requested range (see
    reader_service.get_original_file_stream / StorageService.stream).
    """
    range_header = request.headers.get("range")
    byte_iter, start, end, total_size, filename, mime_type = reader_service.get_original_file_stream(
        course_id, doc_id, user_id, range_header,
    )

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
        "Content-Disposition": f'inline; filename="{filename}"',
    }

    if range_header:
        headers["Content-Range"] = f"bytes {start}-{end}/{total_size}"
        return StreamingResponse(byte_iter, status_code=206, media_type=mime_type, headers=headers)

    return StreamingResponse(byte_iter, status_code=200, media_type=mime_type, headers=headers)


@router.get("/{doc_id}/download")
def download_original_file(
    course_id: int, doc_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Same source as /file, but forces a download instead of inline
    viewing (Content-Disposition: attachment) and never partial - a
    download should always be the complete file."""
    byte_iter, start, end, total_size, filename, mime_type = reader_service.get_original_file_stream(
        course_id, doc_id, user_id, range_header=None,
    )
    headers = {
        "Content-Length": str(total_size),
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    return StreamingResponse(byte_iter, status_code=200, media_type=mime_type, headers=headers)


@router.delete("/{doc_id}", status_code=204)
def delete_material(
    course_id: int, doc_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Deletes the original file (from whichever storage provider owns
    it), the FAISS/BM25 index (with proper in-memory cache invalidation,
    not just the files on disk), and the database record."""
    reader_service.delete_document(course_id, doc_id, user_id)
