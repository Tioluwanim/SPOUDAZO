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

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile

from app.api.deps import require_course_owner
from app.api.schemas import MaterialOut
from app.auth import get_current_user_id
from app.db.repository import repository
from app.models.schemas import DocumentStatus
from app.services.extraction_service import extraction_service
from app.services.pdf_service import pdf_service
from app.services.rag_service import rag_service
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
    doc, error = pdf_service.save_upload(file_bytes, file.filename)
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
    doc_ids = repository.get_course_document_ids(course_id)
    week_map = repository.get_document_week_map(course_id)
    materials = []
    for doc_id in doc_ids:
        doc = pdf_service.load_document(doc_id)
        if doc:
            materials.append(MaterialOut(
                doc_id=doc.doc_id,
                filename=doc.filename,
                status=doc.status.value,
                chunk_count=doc.chunk_count,
                week_number=week_map.get(doc_id),
            ))
    return materials