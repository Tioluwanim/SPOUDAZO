from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable

import numpy as np
from sqlalchemy import inspect, select, func, text
from sqlalchemy.orm import selectinload

from app.db.models import (
    Annotation,
    Attempt,
    ChatMessage,
    ChatSession,
    Course,
    Document,
    DocumentChunk,
    DocumentSection,
    DocumentVersion,
    ExportJob,
    Favorite,
    Feedback,
    IngestionJob,
    ProcessingLog,
    Question,
    ReadingActivityDay,
    ReadingProgress,
    StudyPlan,
    StudyPlanItem,
    SyncRun,
    Topic,
    TopicMastery,
    TopicResource,
)
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.schemas import (
    DocumentMetadata,
    DocumentSection as SchemaSection,
    DocumentStatus,
    ProcessedDocument,
    SectionType,
    TextChunk,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    # create_all only creates missing tables, never alters existing ones -
    # this index backs the new checksum-dedup lookup (get_ready_document_by
    # _checksum) and needs to appear on databases that already had a
    # `documents` table before this column started being queried by it.
    # checkfirst=True makes this safe to call on every startup.
    from sqlalchemy import Index
    Index("ix_documents_course_checksum", Document.course_id, Document.checksum).create(
        bind=engine, checkfirst=True
    )


class Repository:
    def __init__(self) -> None:
        self.logger = get_logger(__name__)

    @contextmanager
    def session(self):
        session = SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def create_document(
        self,
        doc_id: str,
        filename: str,
        local_path: str,
        file_size_bytes: int,
        mime_type: str = "application/pdf",
        source_folder: str | None = None,
        drive_file_id: str | None = None,
        checksum: str | None = None,
        modified_time: datetime | None = None,
        source: str = "upload",
        status: DocumentStatus | str = DocumentStatus.UPLOADED,
    ) -> Document:
        if isinstance(status, DocumentStatus):
            status_value = status.value
        else:
            status_value = status
        with self.session() as session:
            doc = Document(
                doc_id=doc_id,
                filename=filename,
                local_path=local_path,
                file_size_bytes=file_size_bytes,
                mime_type=mime_type,
                source_folder=source_folder,
                drive_file_id=drive_file_id,
                checksum=checksum or "",
                modified_time=modified_time,
                status=status_value,
            )
            session.add(doc)
            session.flush()
            self._create_version(
                session=session,
                document=doc,
                source=source,
                checksum=checksum,
                modified_time=modified_time,
            )
            return doc

    def _create_version(
        self,
        session,
        document: Document,
        source: str = "upload",
        checksum: str | None = None,
        modified_time: datetime | None = None,
    ) -> DocumentVersion:
        version_number = (
            session.query(func.count(DocumentVersion.id))
            .filter(DocumentVersion.document_id == document.id)
            .scalar() or 0
        ) + 1
        version = DocumentVersion(
            document_id=document.id,
            version_number=version_number,
            drive_file_id=document.drive_file_id,
            checksum=checksum or document.checksum,
            modified_time=modified_time,
            local_path=document.local_path,
            file_size_bytes=document.file_size_bytes,
            source=source,
        )
        session.add(version)
        return version

    def get_document_by_doc_id(self, doc_id: str) -> Document | None:
        with self.session() as session:
            stmt = select(Document).where(Document.doc_id == doc_id)
            return session.execute(stmt).scalar_one_or_none()

    def get_document_by_drive_file_id(self, drive_file_id: str) -> Document | None:
        with self.session() as session:
            stmt = select(Document).where(Document.drive_file_id == drive_file_id)
            return session.execute(stmt).scalar_one_or_none()

    def list_documents(self) -> list[dict]:
        with self.session() as session:
            stmt = select(Document).order_by(Document.updated_at.desc())
            docs = session.execute(stmt).scalars().all()
            return [self._summary_from_record(doc) for doc in docs]

    def _summary_from_record(self, doc: Document) -> dict:
        return {
            "doc_id": doc.doc_id,
            "filename": doc.filename,
            "status": doc.status,
            "title": doc.title or doc.filename,
            "authors": doc.authors or [],
            "pages": doc.page_count,
            "chunks": doc.chunk_count,
            "source": doc.source_folder or "local",
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else "",
            "created_at": doc.created_at.isoformat() if doc.created_at else "",
            "drive_file_id": doc.drive_file_id,
            "last_error": doc.last_error,
        }

    def update_document(
        self,
        doc: ProcessedDocument,
        status: DocumentStatus | None = None,
        error_message: str | None = None,
    ) -> bool:
        with self.session() as session:
            stmt = select(Document).where(Document.doc_id == doc.doc_id)
            record = session.execute(stmt).scalar_one_or_none()
            if not record:
                return False
            record.filename = doc.filename
            record.local_path = doc.file_path
            record.full_text = doc.full_text
            record.page_count = doc.metadata.page_count
            record.chunk_count = doc.chunk_count
            record.vector_index_path = doc.vector_index_path or record.vector_index_path
            record.last_error = error_message or doc.error_message or record.last_error
            record.title = doc.metadata.title or record.title
            record.authors = doc.metadata.authors or record.authors
            record.abstract = doc.metadata.abstract or record.abstract
            record.keywords = doc.metadata.keywords or record.keywords
            record.doi = getattr(doc.metadata, "doi", record.doi)
            record.issn = getattr(doc.metadata, "issn", record.issn)
            record.publisher = getattr(doc.metadata, "publisher", record.publisher)
            record.journal = getattr(doc.metadata, "journal", record.journal)
            record.volume = getattr(doc.metadata, "volume", record.volume)
            record.issue = getattr(doc.metadata, "issue", record.issue)
            record.article_type = getattr(doc.metadata, "article_type", record.article_type)
            record.year = getattr(doc.metadata, "year", record.year)
            record.language = getattr(doc.metadata, "language", record.language)
            record.metadata_json = doc.metadata.model_dump() if doc.metadata else record.metadata_json
            if status:
                record.status = status.value
            elif isinstance(doc.status, DocumentStatus):
                record.status = doc.status.value
            doc.updated_at = datetime.utcnow()
            record.updated_at = doc.updated_at
            session.add(record)
            if doc.sections:
                self.save_sections(doc.doc_id, doc.sections, session=session)
            if doc.chunks:
                self.save_chunks(doc.doc_id, doc.chunks, session=session, preserve_embeddings=True)
            return True

    def update_document_file(
        self,
        doc_id: str,
        local_path: str,
        checksum: str,
        modified_time: datetime | None,
        file_size_bytes: int,
        status: DocumentStatus,
        drive_file_id: str | None = None,
        source_folder: str | None = None,
        source: str | None = None,
    ) -> bool:
        with self.session() as session:
            record = session.execute(select(Document).where(Document.doc_id == doc_id)).scalar_one_or_none()
            if not record:
                return False
            record.local_path = local_path
            record.checksum = checksum
            record.modified_time = modified_time
            record.file_size_bytes = file_size_bytes
            record.status = status.value
            if drive_file_id is not None:
                record.drive_file_id = drive_file_id
            if source_folder is not None:
                record.source_folder = source_folder
            if source is not None:
                record.source = source
            record.updated_at = datetime.utcnow()
            self._create_version(
                session=session,
                document=record,
                source=source or "drive",
                checksum=checksum,
                modified_time=modified_time,
            )
            session.add(record)
            return True

    def save_sections(
        self,
        doc_id: str,
        sections: list[SchemaSection],
        session=None,
    ) -> None:
        """
        Bulk-replace all sections for a document.

        Uses bulk_insert_mappings instead of per-row session.add(), which
        avoids ORM identity-map / unit-of-work overhead. On a 50-100 document
        batch (each with 5-10 sections) this cuts section-save time by
        roughly 5-10x versus the row-by-row approach.
        """
        own_session = session is None
        if own_session:
            session = SessionLocal()
        try:
            document = session.execute(
                select(Document).where(Document.doc_id == doc_id)
            ).scalar_one_or_none()
            if not document:
                return

            session.query(DocumentSection).filter(
                DocumentSection.document_id == document.id
            ).delete(synchronize_session=False)

            if sections:
                mappings = [
                    {
                        "document_id" : document.id,
                        "section_type": section.section_type.value,
                        "title"       : section.title,
                        "content"     : section.content,
                        "page_start"  : section.page_start,
                        "page_end"    : section.page_end,
                        "char_start"  : section.char_start,
                        "char_end"    : section.char_end,
                        "word_count"  : section.word_count,
                    }
                    for section in sections
                ]
                session.bulk_insert_mappings(DocumentSection, mappings)

            if own_session:
                session.commit()
        finally:
            if own_session:
                session.close()

    def save_chunks(
        self,
        doc_id: str,
        chunks: list[TextChunk],
        embeddings: np.ndarray | None = None,
        session=None,
        preserve_embeddings: bool = False,
    ) -> None:
        """
        Bulk-replace all chunks for a document.

        Uses bulk_insert_mappings instead of per-row session.add(). For a
        document with ~100 chunks this is a single executemany() round-trip
        instead of 100 individual ORM inserts; across a 100-document batch
        this is the dominant cost reduction (roughly 5-10x faster commit
        time, measured via SQLAlchemy's bulk APIs vs. unit-of-work ORM adds).
        """
        own_session = session is None
        if own_session:
            session = SessionLocal()
        try:
            document = session.execute(
                select(Document).where(Document.doc_id == doc_id)
            ).scalar_one_or_none()
            if not document:
                return

            existing_embeddings: dict[str, bytes] = {}
            if preserve_embeddings:
                existing = session.execute(
                    select(DocumentChunk.id, DocumentChunk.embedding).where(
                        DocumentChunk.document_id == document.id
                    )
                ).all()
                existing_embeddings = {
                    row[0]: row[1] for row in existing if row[1]
                }

            session.query(DocumentChunk).filter(
                DocumentChunk.document_id == document.id
            ).delete(synchronize_session=False)

            if chunks:
                mappings: list[dict] = []
                for idx, chunk in enumerate(chunks):
                    embedding_bytes = None
                    if embeddings is not None and idx < len(embeddings):
                        array = np.asarray(embeddings[idx], dtype=np.float32)
                        embedding_bytes = array.tobytes()
                    elif preserve_embeddings:
                        embedding_bytes = existing_embeddings.get(chunk.chunk_id)

                    mappings.append({
                        "id"          : chunk.chunk_id,
                        "document_id" : document.id,
                        "chunk_index" : chunk.chunk_index,
                        "total_chunks": chunk.total_chunks,
                        "page_number" : chunk.page_number,
                        "section_type": chunk.section_type.value,
                        "content"     : chunk.content,
                        "word_count"  : chunk.word_count,
                        "char_count"  : chunk.char_count,
                        "embedding"   : embedding_bytes,
                    })

                session.bulk_insert_mappings(DocumentChunk, mappings)

            if own_session:
                session.commit()
        finally:
            if own_session:
                session.close()

    def load_processed_document(self, doc_id: str) -> ProcessedDocument | None:
        with self.session() as session:
            record = session.execute(
                select(Document).where(Document.doc_id == doc_id)
            ).scalar_one_or_none()
            if not record:
                return None
            sections = session.execute(
                select(DocumentSection).where(DocumentSection.document_id == record.id)
            ).scalars().all()
            chunks = session.execute(
                select(DocumentChunk).where(DocumentChunk.document_id == record.id).order_by(DocumentChunk.chunk_index)
            ).scalars().all()
            metadata = DocumentMetadata(
                title=record.title or "",
                authors=record.authors or [],
                abstract=record.abstract or "",
                keywords=record.keywords or [],
                doi=record.doi or "",
                issn=record.issn or "",
                publisher=record.publisher or "",
                journal=record.journal or "",
                volume=record.volume or "",
                issue=record.issue or "",
                article_type=record.article_type or "",
                year=record.year or "",
                language=record.language or "",
                page_count=record.page_count or 0,
                word_count=len((record.full_text or "").split()),
                file_size_bytes=record.file_size_bytes or 0,
            )
            processed = ProcessedDocument(
                doc_id=record.doc_id,
                filename=record.filename,
                file_path=record.local_path,
                status=DocumentStatus(record.status),
                metadata=metadata,
                full_text=record.full_text or "",
                sections=[
                    SchemaSection(
                        section_type=SectionType(section.section_type),
                        title=section.title,
                        content=section.content,
                        page_start=section.page_start,
                        page_end=section.page_end,
                        char_start=section.char_start,
                        char_end=section.char_end,
                        word_count=section.word_count,
                    )
                    for section in sections
                ],
                chunks=[
                    TextChunk(
                        chunk_id=chunk.id,
                        doc_id=record.doc_id,
                        content=chunk.content,
                        section_type=SectionType(chunk.section_type),
                        chunk_index=chunk.chunk_index,
                        total_chunks=chunk.total_chunks,
                        page_number=chunk.page_number,
                        word_count=chunk.word_count,
                        char_count=chunk.char_count,
                    )
                    for chunk in chunks
                ],
                chunk_count=len(chunks),
                vector_index_path=record.vector_index_path,
                error_message=record.last_error,
                created_at=record.created_at,
                updated_at=record.updated_at,
            )
            return processed

    def _ensure_sync_run_schema(self) -> None:
        inspector = inspect(engine)
        columns = [column["name"] for column in inspector.get_columns("sync_runs")]
        if "updated_files" in columns:
            return

        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE sync_runs ADD COLUMN updated_files INTEGER DEFAULT 0 NOT NULL"
                )
            )

    def delete_document(self, doc_id: str) -> bool:
        with self.session() as session:
            record = session.execute(select(Document).where(Document.doc_id == doc_id)).scalar_one_or_none()
            if not record:
                return False
            session.delete(record)
            return True

    def get_documents_for_search(
        self,
        doc_ids: list[str] | None = None,
        author: str | None = None,
        year: str | None = None,
    ) -> list[str]:
        with self.session() as session:
            stmt = select(Document.doc_id).where(Document.status == DocumentStatus.READY.value)
            if doc_ids:
                stmt = stmt.where(Document.doc_id.in_(doc_ids))
            if author:
                stmt = stmt.where(Document.authors.contains([author]))
            if year:
                stmt = stmt.where(Document.year == year)
            return [row[0] for row in session.execute(stmt).all()]

    def get_library_chunks(
        self,
        doc_ids: list[str] | None = None,
        author: str | None = None,
        year: str | None = None,
        section_type: SectionType | None = None,
        page_number: int | None = None,
    ) -> list[tuple[DocumentChunk, Document]]:
        with self.session() as session:
            stmt = (
                select(DocumentChunk, Document)
                .join(Document, Document.id == DocumentChunk.document_id)
                .where(Document.status == DocumentStatus.READY.value)
            )
            if doc_ids:
                stmt = stmt.where(Document.doc_id.in_(doc_ids))
            if author:
                stmt = stmt.where(Document.authors.contains([author]))
            if year:
                stmt = stmt.where(Document.year == year)
            if section_type:
                stmt = stmt.where(DocumentChunk.section_type == section_type.value)
            if page_number is not None:
                stmt = stmt.where(DocumentChunk.page_number == page_number)
            return [(row[0], row[1]) for row in session.execute(stmt).all()]

    def get_recent_sync_runs(self, limit: int = 10) -> list[SyncRun]:
        with self.session() as session:
            stmt = select(SyncRun).order_by(SyncRun.started_at.desc()).limit(limit)
            return session.execute(stmt).scalars().all()

    def get_recent_processing_logs(self, limit: int = 50) -> list[dict]:
        with self.session() as session:
            stmt = (
                select(ProcessingLog, Document, IngestionJob)
                .outerjoin(Document, Document.id == ProcessingLog.document_id)
                .outerjoin(IngestionJob, IngestionJob.id == ProcessingLog.ingestion_job_id)
                .order_by(ProcessingLog.created_at.desc())
                .limit(limit)
            )
            rows = session.execute(stmt).all()
            return [
                {
                    "created_at": log.created_at.isoformat() if log.created_at else "",
                    "level": log.level,
                    "message": log.message,
                    "doc_id": doc.doc_id if doc else "",
                    "filename": doc.filename if doc else "",
                    "job_id": job.id if job else None,
                    "job_status": job.status if job else "",
                }
                for log, doc, job in rows
            ]

    def get_library_stats(self) -> dict:
        with self.session() as session:
            total_docs = session.scalar(select(func.count(Document.id))) or 0
            ready_docs = session.scalar(
                select(func.count(Document.id)).where(Document.status == DocumentStatus.READY.value)
            ) or 0
            failed_docs = session.scalar(
                select(func.count(Document.id)).where(Document.status == DocumentStatus.FAILED.value)
            ) or 0
            total_chunks = session.scalar(select(func.count(DocumentChunk.id))) or 0
            total_pages = session.scalar(select(func.coalesce(func.sum(Document.page_count), 0))) or 0
            pending_jobs = session.scalar(
                select(func.count(IngestionJob.id)).where(IngestionJob.status.in_(["queued", "running"]))
            ) or 0
            return {
                "total_documents": total_docs,
                "ready_documents": ready_docs,
                "failed_documents": failed_docs,
                "total_chunks": total_chunks,
                "total_pages": total_pages,
                "pending_jobs": pending_jobs,
            }

    def delete_all_documents(self) -> int:
        with self.session() as session:
            count = session.scalar(select(func.count(Document.id))) or 0
            session.query(Document).delete()
            return int(count)

    def create_sync_run(self, folder_id: str | None, total_files: int) -> SyncRun:
        with self.session() as session:
            run = SyncRun(folder_id=folder_id, total_files=total_files)
            session.add(run)
            session.flush()
            return run

    def finish_sync_run(
        self,
        sync_run: SyncRun,
        status: str,
        new_files: int,
        skipped_files: int,
        failed_files: int,
        updated_files: int = 0,
        error_message: str | None = None,
    ) -> None:
        self._ensure_sync_run_schema()
        with self.session() as session:
            record = session.execute(select(SyncRun).where(SyncRun.id == sync_run.id)).scalar_one_or_none()
            if not record:
                return
            record.status = status
            record.new_files = new_files
            record.updated_files = updated_files
            record.skipped_files = skipped_files
            record.failed_files = failed_files
            record.completed_at = datetime.utcnow()
            record.error_message = error_message
            session.add(record)

    def create_ingestion_job(
        self,
        document_id: int | None,
        drive_file_id: str | None,
        source: str = "drive",
    ) -> IngestionJob:
        with self.session() as session:
            job = IngestionJob(document_id=document_id, drive_file_id=drive_file_id, source=source)
            session.add(job)
            session.flush()
            return job

    def add_processing_log(
        self,
        document_id: int | None,
        ingestion_job_id: int | None,
        level: str,
        message: str,
    ) -> None:
        with self.session() as session:
            log = ProcessingLog(
                document_id=document_id,
                ingestion_job_id=ingestion_job_id,
                level=level,
                message=message,
            )
            session.add(log)

    def add_document_log(self, doc_id: str, level: str, message: str) -> None:
        with self.session() as session:
            document = session.execute(
                select(Document).where(Document.doc_id == doc_id)
            ).scalar_one_or_none()
            session.add(
                ProcessingLog(
                    document_id=document.id if document else None,
                    ingestion_job_id=None,
                    level=level,
                    message=message,
                )
            )

    def get_ingestion_job(self, ingestion_job_id: int) -> IngestionJob | None:
        with self.session() as session:
            return session.execute(
                select(IngestionJob)
                .options(selectinload(IngestionJob.document))
                .where(IngestionJob.id == ingestion_job_id)
            ).scalar_one_or_none()

    def get_pending_ingestion_jobs(self, limit: int = 10) -> list[IngestionJob]:
        with self.session() as session:
            stmt = (
                select(IngestionJob)
                .options(selectinload(IngestionJob.document))
                .where(IngestionJob.status == "queued")
                .order_by(IngestionJob.queued_at.asc())
                .limit(limit)
            )
            return session.execute(stmt).scalars().all()

    def start_ingestion_job(self, ingestion_job_id: int) -> bool:
        with self.session() as session:
            job = session.execute(
                select(IngestionJob).where(IngestionJob.id == ingestion_job_id)
            ).scalar_one_or_none()
            if not job:
                return False
            job.status = "running"
            job.started_at = datetime.utcnow()
            session.add(job)
            return True

    def complete_ingestion_job(
        self,
        ingestion_job_id: int,
        status: str = "completed",
        error_message: str | None = None,
    ) -> bool:
        with self.session() as session:
            job = session.execute(
                select(IngestionJob).where(IngestionJob.id == ingestion_job_id)
            ).scalar_one_or_none()
            if not job:
                return False
            job.status = status
            job.completed_at = datetime.utcnow()
            if error_message:
                job.error_message = error_message
            session.add(job)
            return True

    def fail_ingestion_job(self, ingestion_job_id: int, error_message: str) -> bool:
        return self.complete_ingestion_job(
            ingestion_job_id=ingestion_job_id,
            status="failed",
            error_message=error_message,
        )

    def get_document_chunk_embeddings(self, doc_id: str) -> list[tuple[str, np.ndarray]]:
        with self.session() as session:
            record = session.execute(select(Document).where(Document.doc_id == doc_id)).scalar_one_or_none()
            if not record:
                return []
            stmt = select(DocumentChunk).where(DocumentChunk.document_id == record.id).order_by(DocumentChunk.chunk_index)
            chunks = session.execute(stmt).scalars().all()
            result = []
            for chunk in chunks:
                if chunk.embedding:
                    result.append((chunk.id, np.frombuffer(chunk.embedding, dtype=np.float32)))
            return result

    def get_chunk_by_id(self, chunk_id: str) -> DocumentChunk | None:
        with self.session() as session:
            return session.execute(select(DocumentChunk).where(DocumentChunk.id == chunk_id)).scalar_one_or_none()

    def get_chunks_by_ids(self, chunk_ids: Iterable[str]) -> list[DocumentChunk]:
        with self.session() as session:
            stmt = select(DocumentChunk).where(DocumentChunk.id.in_(list(chunk_ids)))
            return session.execute(stmt).scalars().all()

    # ── Courses ───────────────────────────────────────────────────────────────

    def create_course(self, user_id: str, name: str, code: str) -> Course:
        with self.session() as session:
            course = Course(user_id=user_id, name=name, code=code)
            session.add(course)
            session.flush()
            session.refresh(course)
            session.expunge(course)
            return course

    def get_course(self, course_id: int) -> Course | None:
        with self.session() as session:
            course = session.get(Course, course_id)
            if course:
                session.expunge(course)
            return course

    def list_courses(self, user_id: str) -> list[Course]:
        with self.session() as session:
            stmt = select(Course).where(Course.user_id == user_id).order_by(Course.created_at.desc())
            courses = session.execute(stmt).scalars().all()
            for c in courses:
                session.expunge(c)
            return courses

    def get_course_document_ids(self, course_id: int) -> list[str]:
        """doc_id strings (not PKs) for documents attached to a course — what rag_service expects."""
        with self.session() as session:
            stmt = select(Document.doc_id).where(Document.course_id == course_id)
            return list(session.execute(stmt).scalars().all())

    def attach_document_to_course(self, doc_id: str, course_id: int, week_number: int | None = None) -> None:
        with self.session() as session:
            doc = session.execute(select(Document).where(Document.doc_id == doc_id)).scalar_one_or_none()
            if doc:
                doc.course_id = course_id
                doc.week_number = week_number

    def get_document_week_map(self, course_id: int) -> dict[str, int | None]:
        """doc_id -> week_number for every document in a course - used to
        group the materials list by week without a separate endpoint."""
        with self.session() as session:
            stmt = select(Document.doc_id, Document.week_number).where(Document.course_id == course_id)
            return {doc_id: week for doc_id, week in session.execute(stmt).all()}

    def list_materials_summary(self, course_id: int) -> list[dict]:
        """One query, five columns - what the materials list view actually
        needs. Replaces the old pattern of loading every doc_id then calling
        pdf_service.load_document() per document, which round-tripped the
        DB three times per document (Document + all its DocumentSections +
        all its DocumentChunks) just to read a filename and a status badge -
        an O(n) query storm that also deserialized full document text and
        every chunk for documents nobody was reading text from on this
        screen."""
        with self.session() as session:
            stmt = (
                select(
                    Document.doc_id,
                    Document.filename,
                    Document.status,
                    Document.chunk_count,
                    Document.week_number,
                )
                .where(Document.course_id == course_id)
                .order_by(Document.week_number.is_(None), Document.week_number, Document.created_at)
            )
            rows = session.execute(stmt).all()
            return [
                {
                    "doc_id": r.doc_id,
                    "filename": r.filename,
                    "status": r.status,
                    "chunk_count": r.chunk_count,
                    "week_number": r.week_number,
                }
                for r in rows
            ]

    def get_ready_document_by_checksum(self, course_id: int, checksum: str) -> Document | None:
        """Finds an already-processed document with identical content in
        this course, so a re-upload (double-click, retry after a refresh,
        the same lecture note added twice) can be recognised and skipped
        instead of re-extracting, re-embedding, and re-indexing content
        that's already there. Scoped to READY documents only - a checksum
        match against a still-processing or failed upload isn't something
        we want to hand back as if it were done."""
        with self.session() as session:
            stmt = (
                select(Document)
                .where(
                    Document.course_id == course_id,
                    Document.checksum == checksum,
                    Document.status == DocumentStatus.READY.value,
                )
                .order_by(Document.created_at.desc())
            )
            doc = session.execute(stmt).scalars().first()
            if doc:
                session.expunge(doc)
            return doc

    # ── Topics ────────────────────────────────────────────────────────────────

    def bulk_create_topics(self, course_id: int, topics: list[dict]) -> list[Topic]:
        """topics: [{"name": ..., "frequency_score": int, "source_chunk_ids": [...]}]"""
        with self.session() as session:
            rows = []
            for t in topics:
                row = Topic(
                    course_id=course_id,
                    name=t["name"],
                    frequency_score=t.get("frequency_score", 0),
                    source_chunk_ids=t.get("source_chunk_ids", []),
                )
                session.add(row)
                rows.append(row)
            session.flush()
            for r in rows:
                session.refresh(r)
                session.expunge(r)
            return rows

    def get_topic(self, topic_id: int) -> Topic | None:
        with self.session() as session:
            topic = session.get(Topic, topic_id)
            if topic:
                session.expunge(topic)
            return topic

    def list_topics(self, course_id: int) -> list[Topic]:
        with self.session() as session:
            stmt = (
                select(Topic)
                .where(Topic.course_id == course_id)
                .order_by(Topic.frequency_score.desc())
            )
            topics = session.execute(stmt).scalars().all()
            for t in topics:
                session.expunge(t)
            return topics

    def bump_topic_frequency(self, topic_id: int, by: int = 1) -> None:
        with self.session() as session:
            topic = session.get(Topic, topic_id)
            if topic:
                topic.frequency_score = (topic.frequency_score or 0) + by

    # ── Questions ─────────────────────────────────────────────────────────────

    def create_question(
        self,
        course_id: int,
        topic_id: int,
        type: str,
        prompt: str,
        options: dict | None = None,
        correct_answer: str | None = None,
        explanation: str | None = None,
        rubric: list[dict] | None = None,
        difficulty: str = "medium",
    ) -> Question:
        with self.session() as session:
            q = Question(
                course_id=course_id,
                topic_id=topic_id,
                type=type,
                prompt=prompt,
                options=options,
                correct_answer=correct_answer,
                explanation=explanation,
                rubric=rubric,
                difficulty=difficulty,
            )
            session.add(q)
            session.flush()
            session.refresh(q)
            session.expunge(q)
            return q

    def get_question(self, question_id: int) -> Question | None:
        with self.session() as session:
            q = session.get(Question, question_id)
            if q:
                session.expunge(q)
            return q

    def list_questions(self, topic_id: int, type: str | None = None) -> list[Question]:
        with self.session() as session:
            stmt = select(Question).where(Question.topic_id == topic_id)
            if type:
                stmt = stmt.where(Question.type == type)
            stmt = stmt.order_by(Question.created_at.desc())
            questions = session.execute(stmt).scalars().all()
            for q in questions:
                session.expunge(q)
            return questions

    # ── Attempts + mastery ───────────────────────────────────────────────────

    def create_attempt(
        self,
        user_id: str,
        question_id: int,
        student_answer: str,
        is_correct: str | None = None,
        score: int | None = None,
        max_score: int | None = None,
        gaps: list[str] | None = None,
    ) -> Attempt:
        with self.session() as session:
            attempt = Attempt(
                user_id=user_id,
                question_id=question_id,
                student_answer=student_answer,
                is_correct=is_correct,
                score=score,
                max_score=max_score,
                gaps=gaps or [],
            )
            session.add(attempt)
            session.flush()
            session.refresh(attempt)
            session.expunge(attempt)
            return attempt

    def upsert_topic_mastery(self, user_id: str, topic_id: int, mastery_score: int) -> TopicMastery:
        """mastery_score is the freshly computed 0-100 score for this attempt;
        stored as a simple running average against attempts_count."""
        with self.session() as session:
            stmt = select(TopicMastery).where(
                TopicMastery.user_id == user_id, TopicMastery.topic_id == topic_id
            )
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                row = TopicMastery(
                    user_id=user_id,
                    topic_id=topic_id,
                    mastery_score=mastery_score,
                    attempts_count=1,
                    last_practiced_at=datetime.utcnow(),
                )
                session.add(row)
            else:
                # running average: new_avg = old_avg + (new - old_avg) / n
                n = row.attempts_count + 1
                row.mastery_score = int(row.mastery_score + (mastery_score - row.mastery_score) / n)
                row.attempts_count = n
                row.last_practiced_at = datetime.utcnow()
            session.flush()
            session.refresh(row)
            session.expunge(row)
            return row

    def get_weak_areas(self, course_id: int, user_id: str, limit: int = 10) -> list[dict]:
        """Topics for this course ranked by lowest mastery first.
        Topics never attempted are treated as mastery_score=0 (weakest)."""
        with self.session() as session:
            topics = session.execute(
                select(Topic).where(Topic.course_id == course_id)
            ).scalars().all()

            mastery_by_topic = {
                m.topic_id: m.mastery_score
                for m in session.execute(
                    select(TopicMastery).where(TopicMastery.user_id == user_id)
                ).scalars().all()
            }

            ranked = sorted(
                topics,
                key=lambda t: mastery_by_topic.get(t.id, 0),
            )[:limit]

            return [
                {
                    "topic_id": t.id,
                    "name": t.name,
                    "mastery_score": mastery_by_topic.get(t.id, 0),
                }
                for t in ranked
            ]


    # ── Study plans ──────────────────────────────────────────────────────────

    def create_study_plan(
        self,
        course_id: int,
        user_id: str,
        exam_date,
        hours_per_day: int,
        items: list[dict],
    ) -> StudyPlan:
        """items: [{"topic_id": int, "scheduled_date": datetime}, ...]"""
        with self.session() as session:
            plan = StudyPlan(
                course_id=course_id,
                user_id=user_id,
                exam_date=exam_date,
                hours_per_day=hours_per_day,
            )
            session.add(plan)
            session.flush()

            for item in items:
                session.add(StudyPlanItem(
                    plan_id=plan.id,
                    topic_id=item["topic_id"],
                    scheduled_date=item["scheduled_date"],
                ))

            session.flush()
            session.refresh(plan)
            # Load items eagerly before expunging - lazy-loaded relationships
            # can't be accessed after the session that owns them is closed.
            _ = list(plan.items)
            for i in plan.items:
                session.refresh(i)
                session.expunge(i)
            session.expunge(plan)
            return plan

    def get_latest_study_plan(self, course_id: int, user_id: str) -> StudyPlan | None:
        with self.session() as session:
            stmt = (
                select(StudyPlan)
                .where(StudyPlan.course_id == course_id, StudyPlan.user_id == user_id)
                .order_by(StudyPlan.created_at.desc())
            )
            plan = session.execute(stmt).scalars().first()
            if plan is None:
                return None
            _ = list(plan.items)
            for i in plan.items:
                session.expunge(i)
            session.expunge(plan)
            return plan

    def list_study_plan_items(self, plan_id: int) -> list[StudyPlanItem]:
        with self.session() as session:
            stmt = (
                select(StudyPlanItem)
                .where(StudyPlanItem.plan_id == plan_id)
                .order_by(StudyPlanItem.scheduled_date.asc())
            )
            items = session.execute(stmt).scalars().all()
            for i in items:
                session.expunge(i)
            return items

    def get_study_plan_item(self, item_id: int) -> StudyPlanItem | None:
        with self.session() as session:
            item = session.get(StudyPlanItem, item_id)
            if item:
                session.expunge(item)
            return item

    def get_study_plan(self, plan_id: int) -> StudyPlan | None:
        with self.session() as session:
            plan = session.get(StudyPlan, plan_id)
            if plan:
                session.expunge(plan)
            return plan

    def set_study_plan_item_completed(self, item_id: int, completed: bool) -> StudyPlanItem | None:
        with self.session() as session:
            item = session.get(StudyPlanItem, item_id)
            if item is None:
                return None
            item.completed = completed
            session.flush()
            session.refresh(item)
            session.expunge(item)
            return item


    # ── Topic resources (Smart Library online resources) ────────────────────

    def list_topic_resources(self, topic_id: int) -> list[dict]:
        with self.session() as session:
            stmt = (
                select(TopicResource)
                .where(TopicResource.topic_id == topic_id)
                .order_by(TopicResource.created_at.desc())
            )
            rows = session.execute(stmt).scalars().all()
            return [
                {
                    "title": r.title,
                    "url": r.url,
                    "snippet": r.snippet,
                    "source_domain": r.source_domain,
                }
                for r in rows
            ]

    def replace_topic_resources(self, topic_id: int, results: list[dict]) -> list[dict]:
        """Overwrites the cached resource set for a topic with fresh search
        results - simplest correct behavior for a "refresh" action; no
        need to diff old vs new for a handful of cached links."""
        with self.session() as session:
            session.query(TopicResource).filter(TopicResource.topic_id == topic_id).delete()
            for r in results:
                session.add(TopicResource(
                    topic_id=topic_id,
                    title=r["title"],
                    url=r["url"],
                    snippet=r.get("snippet"),
                    source_domain=r.get("source_domain"),
                ))
        return results

    # ── Feedback ─────────────────────────────────────────────────────────────

    def create_feedback(
        self,
        user_id: str,
        category: str,
        title: str,
        description: str,
        expected_behavior: str | None = None,
        actual_behavior: str | None = None,
        severity: str = "medium",
        screenshot_url: str | None = None,
        metadata: dict | None = None,
    ) -> Feedback:
        with self.session() as session:
            fb = Feedback(
                user_id=user_id,
                category=category,
                title=title,
                description=description,
                expected_behavior=expected_behavior,
                actual_behavior=actual_behavior,
                severity=severity,
                screenshot_url=screenshot_url,
                metadata_json=metadata or {},
            )
            session.add(fb)
            session.flush()
            session.refresh(fb)
            session.expunge(fb)
            return fb

    def get_feedback(self, feedback_id: int) -> Feedback | None:
        with self.session() as session:
            fb = session.get(Feedback, feedback_id)
            if fb:
                session.expunge(fb)
            return fb

    def list_feedback(
        self,
        status: str | None = None,
        priority: str | None = None,
        category: str | None = None,
        user_id: str | None = None,
        search: str | None = None,
        created_after: datetime | None = None,
        created_before: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Feedback]:
        with self.session() as session:
            stmt = select(Feedback)
            if status:
                stmt = stmt.where(Feedback.status == status)
            if priority:
                stmt = stmt.where(Feedback.priority == priority)
            if category:
                stmt = stmt.where(Feedback.category == category)
            if user_id:
                stmt = stmt.where(Feedback.user_id == user_id)
            if search:
                like = f"%{search}%"
                stmt = stmt.where((Feedback.title.ilike(like)) | (Feedback.description.ilike(like)))
            if created_after:
                stmt = stmt.where(Feedback.created_at >= created_after)
            if created_before:
                stmt = stmt.where(Feedback.created_at <= created_before)
            stmt = stmt.order_by(Feedback.created_at.desc()).offset(offset).limit(limit)
            rows = session.execute(stmt).scalars().all()
            for r in rows:
                session.expunge(r)
            return rows

    def update_feedback(
        self,
        feedback_id: int,
        status: str | None = None,
        priority: str | None = None,
        severity: str | None = None,
    ) -> Feedback | None:
        with self.session() as session:
            fb = session.get(Feedback, feedback_id)
            if fb is None:
                return None
            if status is not None:
                fb.status = status
            if priority is not None:
                fb.priority = priority
            if severity is not None:
                fb.severity = severity
            session.flush()
            session.refresh(fb)
            session.expunge(fb)
            return fb

    def delete_feedback(self, feedback_id: int) -> bool:
        with self.session() as session:
            fb = session.get(Feedback, feedback_id)
            if fb is None:
                return False
            session.delete(fb)
            return True

    # ── Annotations (highlights & bookmarks) ────────────────────────────────

    def create_annotation(
        self, user_id: str, doc_id: str, kind: str, section_index: int,
        quote: str, note: str | None = None,
    ) -> Annotation:
        with self.session() as session:
            ann = Annotation(
                user_id=user_id, doc_id=doc_id, kind=kind,
                section_index=section_index, quote=quote, note=note,
            )
            session.add(ann)
            session.flush()
            session.refresh(ann)
            session.expunge(ann)
            return ann

    def list_annotations(self, user_id: str, doc_id: str, kind: str | None = None) -> list[Annotation]:
        with self.session() as session:
            stmt = select(Annotation).where(Annotation.user_id == user_id, Annotation.doc_id == doc_id)
            if kind:
                stmt = stmt.where(Annotation.kind == kind)
            stmt = stmt.order_by(Annotation.section_index, Annotation.created_at)
            rows = session.execute(stmt).scalars().all()
            for r in rows:
                session.expunge(r)
            return rows

    def list_bookmarks_for_user(self, user_id: str, limit: int = 50) -> list[Annotation]:
        """Cross-course bookmark list for the Smart Library sidebar."""
        with self.session() as session:
            stmt = (
                select(Annotation)
                .where(Annotation.user_id == user_id, Annotation.kind == "bookmark")
                .order_by(Annotation.created_at.desc())
                .limit(limit)
            )
            rows = session.execute(stmt).scalars().all()
            for r in rows:
                session.expunge(r)
            return rows

    def get_annotation(self, annotation_id: int) -> Annotation | None:
        with self.session() as session:
            ann = session.get(Annotation, annotation_id)
            if ann:
                session.expunge(ann)
            return ann

    def delete_annotation(self, annotation_id: int) -> bool:
        with self.session() as session:
            ann = session.get(Annotation, annotation_id)
            if ann is None:
                return False
            session.delete(ann)
            return True

    # ── Favorites ────────────────────────────────────────────────────────────

    def toggle_favorite(self, user_id: str, doc_id: str) -> bool:
        """Returns the new state (True = now favorited)."""
        with self.session() as session:
            stmt = select(Favorite).where(Favorite.user_id == user_id, Favorite.doc_id == doc_id)
            existing = session.execute(stmt).scalar_one_or_none()
            if existing:
                session.delete(existing)
                return False
            session.add(Favorite(user_id=user_id, doc_id=doc_id))
            return True

    def is_favorited(self, user_id: str, doc_id: str) -> bool:
        with self.session() as session:
            stmt = select(Favorite.id).where(Favorite.user_id == user_id, Favorite.doc_id == doc_id)
            return session.execute(stmt).scalar_one_or_none() is not None

    def list_favorite_doc_ids(self, user_id: str) -> list[str]:
        with self.session() as session:
            stmt = select(Favorite.doc_id).where(Favorite.user_id == user_id).order_by(Favorite.created_at.desc())
            return [row[0] for row in session.execute(stmt).all()]

    # ── Reading progress ─────────────────────────────────────────────────────

    def upsert_reading_progress(
        self, user_id: str, doc_id: str, last_section_index: int, progress_percent: int,
    ) -> ReadingProgress:
        with self.session() as session:
            stmt = select(ReadingProgress).where(
                ReadingProgress.user_id == user_id, ReadingProgress.doc_id == doc_id
            )
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                row = ReadingProgress(
                    user_id=user_id, doc_id=doc_id,
                    last_section_index=last_section_index, progress_percent=progress_percent,
                )
                session.add(row)
            else:
                row.last_section_index = last_section_index
                row.progress_percent = progress_percent
            session.flush()
            session.refresh(row)
            session.expunge(row)
            return row

    def get_reading_progress(self, user_id: str, doc_id: str) -> ReadingProgress | None:
        with self.session() as session:
            stmt = select(ReadingProgress).where(
                ReadingProgress.user_id == user_id, ReadingProgress.doc_id == doc_id
            )
            row = session.execute(stmt).scalar_one_or_none()
            if row:
                session.expunge(row)
            return row

    def list_recent_documents(self, user_id: str, limit: int = 10) -> list[dict]:
        """Recently-viewed documents across every course, joined against
        Document in one query for what the sidebar actually needs (no
        second round trip per document to fetch its filename)."""
        with self.session() as session:
            stmt = (
                select(
                    Document.doc_id, Document.filename, Document.course_id,
                    ReadingProgress.progress_percent, ReadingProgress.last_viewed_at,
                )
                .join(Document, Document.doc_id == ReadingProgress.doc_id)
                .where(ReadingProgress.user_id == user_id)
                .order_by(ReadingProgress.last_viewed_at.desc())
                .limit(limit)
            )
            rows = session.execute(stmt).all()
            return [
                {
                    "doc_id": r.doc_id,
                    "filename": r.filename,
                    "course_id": r.course_id,
                    "progress_percent": r.progress_percent,
                    "last_viewed_at": r.last_viewed_at,
                }
                for r in rows
            ]

    # ── Reading activity & analytics ────────────────────────────────────────

    def record_reading_activity(self, user_id: str, seconds_delta: int) -> None:
        """Upserts today's row, adding seconds_delta - called alongside every
        reading-progress save. Silently no-ops on a non-positive delta rather
        than erroring, since a duplicate/late progress save with 0 new
        seconds is a normal occurrence, not a client bug."""
        if seconds_delta <= 0:
            return
        today = datetime.utcnow().date()
        with self.session() as session:
            stmt = select(ReadingActivityDay).where(
                ReadingActivityDay.user_id == user_id,
                ReadingActivityDay.activity_date == today,
            )
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                session.add(ReadingActivityDay(user_id=user_id, activity_date=today, seconds_read=seconds_delta))
            else:
                row.seconds_read += seconds_delta

    def get_reading_stats(self, user_id: str) -> dict:
        """Everything the Smart Library analytics dashboard needs, in one
        pass per table rather than N queries - none of these numbers are
        large enough per user to justify more elaborate aggregation."""
        with self.session() as session:
            activity_rows = session.execute(
                select(ReadingActivityDay.activity_date, ReadingActivityDay.seconds_read)
                .where(ReadingActivityDay.user_id == user_id)
                .order_by(ReadingActivityDay.activity_date.desc())
            ).all()

            total_seconds = sum(r.seconds_read for r in activity_rows)
            active_dates = {r.activity_date for r in activity_rows}

            # Streak = consecutive days ending today or yesterday (so a
            # student who read last night and hasn't opened the app yet
            # today doesn't see their streak reset to 0 at midnight).
            streak = 0
            cursor = datetime.utcnow().date()
            if cursor not in active_dates:
                cursor = cursor - timedelta(days=1)
            while cursor in active_dates:
                streak += 1
                cursor = cursor - timedelta(days=1)

            documents_started = session.execute(
                select(func.count()).select_from(ReadingProgress).where(ReadingProgress.user_id == user_id)
            ).scalar_one()
            documents_completed = session.execute(
                select(func.count()).select_from(ReadingProgress).where(
                    ReadingProgress.user_id == user_id, ReadingProgress.progress_percent >= 95,
                )
            ).scalar_one()
            highlight_count = session.execute(
                select(func.count()).select_from(Annotation).where(
                    Annotation.user_id == user_id, Annotation.kind == "highlight",
                )
            ).scalar_one()
            bookmark_count = session.execute(
                select(func.count()).select_from(Annotation).where(
                    Annotation.user_id == user_id, Annotation.kind == "bookmark",
                )
            ).scalar_one()
            favorite_count = session.execute(
                select(func.count()).select_from(Favorite).where(Favorite.user_id == user_id)
            ).scalar_one()

            return {
                "total_seconds_read": total_seconds,
                "active_days": len(active_dates),
                "current_streak_days": streak,
                "documents_started": documents_started,
                "documents_completed": documents_completed,
                "highlight_count": highlight_count,
                "bookmark_count": bookmark_count,
                "favorite_count": favorite_count,
            }


repository = Repository()
