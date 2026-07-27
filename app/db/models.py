"""
app/db/models.py — SQLAlchemy ORM models.

extend_existing=True on every table tells SQLAlchemy to update the
existing table definition rather than raise an error when this module
is re-imported (which Streamlit Cloud does on every rerun).

The mapper re-registration warning ("class already exists in registry")
is suppressed by importing this module exactly once via __init__.py
before any session is opened.
"""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    JSON, Boolean, Column, DateTime, ForeignKey,
    Integer, LargeBinary, String, Text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.schemas import DocumentStatus, SectionType, MessageRole


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"extend_existing": True}

    id                = Column(Integer,      primary_key=True)
    doc_id            = Column(String(36),   unique=True, index=True, nullable=False)
    course_id         = Column(Integer,      ForeignKey("courses.id", ondelete="CASCADE"),
                               index=True, nullable=True)
    week_number       = Column(Integer,      nullable=True)  # null = "General" / unassigned
    drive_file_id     = Column(String(128),  index=True,  nullable=True)
    filename          = Column(String(512),  nullable=False)
    title             = Column(String(1024), default="",  nullable=False)
    mime_type         = Column(String(128),  default="application/pdf", nullable=False)
    checksum          = Column(String(64),   default="",  nullable=True)
    modified_time     = Column(DateTime,     nullable=True)
    local_path        = Column(String(1024), nullable=False)
    status            = Column(String(32),   default=DocumentStatus.UPLOADED.value, nullable=False)
    page_count        = Column(Integer,      default=0,   nullable=False)
    chunk_count       = Column(Integer,      default=0,   nullable=False)
    source_folder     = Column(String(512),  nullable=True)
    source            = Column(String(64),   default="upload", nullable=True)
    last_error        = Column(Text,         nullable=True)
    file_size_bytes   = Column(Integer,      default=0,   nullable=False)
    authors           = Column(JSON,         default=list, nullable=False)
    keywords          = Column(JSON,         default=list, nullable=False)
    abstract          = Column(Text,         default="",  nullable=True)
    doi               = Column(String(128),  default="",  nullable=True)
    issn              = Column(String(128),  default="",  nullable=True)
    publisher         = Column(String(256),  default="",  nullable=True)
    journal           = Column(String(256),  default="",  nullable=True)
    volume            = Column(String(64),   default="",  nullable=True)
    issue             = Column(String(64),   default="",  nullable=True)
    article_type      = Column(String(128),  default="",  nullable=True)
    year              = Column(String(32),   default="",  nullable=True)
    language          = Column(String(32),   default="",  nullable=True)
    full_text         = Column(Text,         default="",  nullable=True)
    metadata_json     = Column(JSON,         nullable=True)
    vector_index_path = Column(String(1024), nullable=True)
    created_at        = Column(DateTime,     default=datetime.utcnow, nullable=False)
    updated_at        = Column(DateTime,     default=datetime.utcnow,
                               onupdate=datetime.utcnow, nullable=False)

    versions       = relationship("DocumentVersion", back_populates="document",
                                  cascade="all, delete-orphan")
    sections       = relationship("DocumentSection",  back_populates="document",
                                  cascade="all, delete-orphan")
    chunks         = relationship("DocumentChunk",    back_populates="document",
                                  cascade="all, delete-orphan")
    ingestion_jobs = relationship("IngestionJob",     back_populates="document",
                                  cascade="all, delete-orphan")
    export_jobs    = relationship("ExportJob",        back_populates="document",
                                  cascade="all, delete-orphan")
    chat_sessions  = relationship("ChatSession",      back_populates="document",
                                  cascade="all, delete-orphan")


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    __table_args__ = {"extend_existing": True}

    id              = Column(Integer,      primary_key=True)
    document_id     = Column(Integer,      ForeignKey("documents.id", ondelete="CASCADE"),
                             nullable=False)
    version_number  = Column(Integer,      default=1,        nullable=False)
    drive_file_id   = Column(String(128),  nullable=True)
    checksum        = Column(String(64),   nullable=True)
    modified_time   = Column(DateTime,     nullable=True)
    local_path      = Column(String(1024), nullable=False)
    file_size_bytes = Column(Integer,      default=0,        nullable=False)
    source          = Column(String(64),   default="upload", nullable=False)
    created_at      = Column(DateTime,     default=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="versions")


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    __table_args__ = {"extend_existing": True}

    id            = Column(Integer,      primary_key=True)
    document_id   = Column(Integer,      ForeignKey("documents.id", ondelete="CASCADE"),
                           nullable=True)
    drive_file_id = Column(String(128),  nullable=True)
    status        = Column(String(32),   default="queued",  nullable=False)
    queued_at     = Column(DateTime,     default=datetime.utcnow, nullable=False)
    started_at    = Column(DateTime,     nullable=True)
    completed_at  = Column(DateTime,     nullable=True)
    retry_count   = Column(Integer,      default=0,         nullable=False)
    error_message = Column(Text,         nullable=True)
    source        = Column(String(64),   default="drive",   nullable=False)

    document = relationship("Document",      back_populates="ingestion_jobs")
    logs     = relationship("ProcessingLog", back_populates="ingestion_job",
                            cascade="all, delete-orphan")


class SyncRun(Base):
    __tablename__ = "sync_runs"
    __table_args__ = {"extend_existing": True}

    id            = Column(Integer,      primary_key=True)
    folder_id     = Column(String(128),  nullable=True)
    status        = Column(String(32),   default="running", nullable=False)
    total_files   = Column(Integer,      default=0,         nullable=False)
    new_files     = Column(Integer,      default=0,         nullable=False)
    updated_files = Column(Integer,      default=0,         nullable=False)
    skipped_files = Column(Integer,      default=0,         nullable=False)
    failed_files  = Column(Integer,      default=0,         nullable=False)
    started_at    = Column(DateTime,     default=datetime.utcnow, nullable=False)
    completed_at  = Column(DateTime,     nullable=True)
    error_message = Column(Text,         nullable=True)


class ProcessingLog(Base):
    __tablename__ = "processing_logs"
    __table_args__ = {"extend_existing": True}

    id               = Column(Integer,    primary_key=True)
    document_id      = Column(Integer,    ForeignKey("documents.id", ondelete="CASCADE"),
                              nullable=True)
    ingestion_job_id = Column(Integer,    ForeignKey("ingestion_jobs.id", ondelete="CASCADE"),
                              nullable=True)
    level            = Column(String(16), default="info", nullable=False)
    message          = Column(Text,       nullable=False)
    created_at       = Column(DateTime,   default=datetime.utcnow, nullable=False)

    ingestion_job = relationship("IngestionJob", back_populates="logs")


class DocumentSection(Base):
    __tablename__ = "document_sections"
    __table_args__ = {"extend_existing": True}

    id           = Column(Integer,     primary_key=True)
    document_id  = Column(Integer,     ForeignKey("documents.id", ondelete="CASCADE"),
                          nullable=False)
    section_type = Column(String(64),  default=SectionType.OTHER.value, nullable=False)
    title        = Column(String(512), default="",  nullable=False)
    content      = Column(Text,        nullable=False)
    page_start   = Column(Integer,     default=0,   nullable=False)
    page_end     = Column(Integer,     default=0,   nullable=False)
    char_start   = Column(Integer,     default=0,   nullable=False)
    char_end     = Column(Integer,     default=0,   nullable=False)
    word_count   = Column(Integer,     default=0,   nullable=False)
    created_at   = Column(DateTime,    default=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="sections")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = {"extend_existing": True}

    id           = Column(String(64),   primary_key=True)
    document_id  = Column(Integer,      ForeignKey("documents.id", ondelete="CASCADE"),
                          nullable=False)
    chunk_index  = Column(Integer,      default=0,   nullable=False)
    total_chunks = Column(Integer,      default=0,   nullable=False)
    page_number  = Column(Integer,      default=0,   nullable=False)
    section_type = Column(String(64),   default=SectionType.OTHER.value, nullable=False)
    content      = Column(Text,         nullable=False)
    word_count   = Column(Integer,      default=0,   nullable=False)
    char_count   = Column(Integer,      default=0,   nullable=False)
    embedding    = Column(LargeBinary,  nullable=True)
    created_at   = Column(DateTime,     default=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="chunks")


class ExportJob(Base):
    __tablename__ = "export_jobs"
    __table_args__ = {"extend_existing": True}

    id            = Column(Integer,     primary_key=True)
    document_id   = Column(Integer,     ForeignKey("documents.id", ondelete="SET NULL"),
                           nullable=True)
    document_ids  = Column(JSON,        nullable=True)
    export_type   = Column(String(32),  nullable=False)
    status        = Column(String(32),  default="queued", nullable=False)
    file_name     = Column(String(256), nullable=True)
    error_message = Column(Text,        nullable=True)
    created_at    = Column(DateTime,    default=datetime.utcnow, nullable=False)
    completed_at  = Column(DateTime,    nullable=True)

    document = relationship("Document", back_populates="export_jobs")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = {"extend_existing": True}

    id          = Column(Integer,     primary_key=True)
    document_id = Column(Integer,     ForeignKey("documents.id", ondelete="CASCADE"),
                         nullable=True)
    name        = Column(String(128), nullable=True)
    created_at  = Column(DateTime,    default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime,    default=datetime.utcnow,
                         onupdate=datetime.utcnow, nullable=False)

    document = relationship("Document",    back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session",
                            cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = {"extend_existing": True}

    id         = Column(Integer,     primary_key=True)
    session_id = Column(Integer,     ForeignKey("chat_sessions.id", ondelete="CASCADE"),
                        nullable=False)
    role       = Column(String(16),  default=MessageRole.USER.value, nullable=False)
    content    = Column(Text,        nullable=False)
    provider   = Column(String(64),  nullable=True)
    model      = Column(String(128), nullable=True)
    created_at = Column(DateTime,    default=datetime.utcnow, nullable=False)

    session = relationship("ChatSession", back_populates="messages")


# =============================================================================
# Spoudazo domain models — courses, topics, questions, attempts
# =============================================================================


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = {"extend_existing": True}

    id         = Column(Integer,      primary_key=True)
    user_id    = Column(String(128),  index=True, nullable=False)
    name       = Column(String(256),  nullable=False)
    code       = Column(String(32),   nullable=False)   # e.g. "MTH302"
    created_at = Column(DateTime,     default=datetime.utcnow, nullable=False)

    materials = relationship("Document", backref="course", cascade="all, delete-orphan",
                             foreign_keys="Document.course_id")
    topics    = relationship("Topic",    back_populates="course", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="course", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = {"extend_existing": True}

    id               = Column(Integer,     primary_key=True)
    course_id        = Column(Integer,     ForeignKey("courses.id", ondelete="CASCADE"),
                              index=True, nullable=False)
    name             = Column(String(512), nullable=False)
    frequency_score  = Column(Integer,     default=0, nullable=False)   # bumped by past-question analysis
    source_chunk_ids = Column(JSON,        default=list, nullable=False)
    created_at       = Column(DateTime,    default=datetime.utcnow, nullable=False)

    course      = relationship("Course",   back_populates="topics")
    questions   = relationship("Question", back_populates="topic", cascade="all, delete-orphan")
    masteries   = relationship("TopicMastery", back_populates="topic", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = {"extend_existing": True}

    id             = Column(Integer,     primary_key=True)
    course_id      = Column(Integer,     ForeignKey("courses.id", ondelete="CASCADE"),
                            index=True, nullable=False)
    topic_id       = Column(Integer,     ForeignKey("topics.id", ondelete="CASCADE"),
                            index=True, nullable=False)
    type           = Column(String(16),  nullable=False)   # "theory" | "cbt"
    prompt         = Column(Text,        nullable=False)
    options        = Column(JSON,        nullable=True)    # CBT only: {"A": "...", "B": "...", ...}
    correct_answer = Column(String(8),   nullable=True)     # CBT only: "A" | "B" | "C" | "D"
    explanation    = Column(Text,        nullable=True)     # CBT only: shown after answering
    rubric         = Column(JSON,        nullable=True)     # Theory only: [{"point": "...", "description": "..."}]
    difficulty     = Column(String(16),  default="medium",  nullable=False)
    created_at     = Column(DateTime,    default=datetime.utcnow, nullable=False)

    course   = relationship("Course",  back_populates="questions")
    topic    = relationship("Topic",   back_populates="questions")
    attempts = relationship("Attempt", back_populates="question", cascade="all, delete-orphan")


class Attempt(Base):
    __tablename__ = "attempts"
    __table_args__ = {"extend_existing": True}

    id             = Column(Integer,     primary_key=True)
    user_id        = Column(String(128), index=True, nullable=False)
    question_id    = Column(Integer,     ForeignKey("questions.id", ondelete="CASCADE"),
                            index=True, nullable=False)
    student_answer = Column(Text,        nullable=False)
    is_correct     = Column(String(20),   nullable=True)   # CBT only: "correct" | "incorrect"
    score          = Column(Integer,     nullable=True)   # Theory only: points earned
    max_score      = Column(Integer,     nullable=True)   # Theory only: rubric point count
    gaps           = Column(JSON,        default=list, nullable=False)  # Theory only: missing rubric points
    created_at     = Column(DateTime,    default=datetime.utcnow, nullable=False)

    question = relationship("Question", back_populates="attempts")


class TopicMastery(Base):
    __tablename__ = "topic_mastery"
    __table_args__ = {"extend_existing": True}

    id                = Column(Integer,     primary_key=True)
    user_id           = Column(String(128), index=True, nullable=False)
    topic_id          = Column(Integer,     ForeignKey("topics.id", ondelete="CASCADE"),
                               index=True, nullable=False)
    mastery_score     = Column(Integer,     default=0, nullable=False)   # 0-100
    attempts_count    = Column(Integer,     default=0, nullable=False)
    last_practiced_at = Column(DateTime,    nullable=True)

    topic = relationship("Topic", back_populates="masteries")


class StudyPlan(Base):
    __tablename__ = "study_plans"
    __table_args__ = {"extend_existing": True}

    id            = Column(Integer,     primary_key=True)
    course_id     = Column(Integer,     ForeignKey("courses.id", ondelete="CASCADE"),
                           index=True, nullable=False)
    user_id       = Column(String(128), index=True, nullable=False)
    exam_date     = Column(DateTime,    nullable=False)
    hours_per_day = Column(Integer,     nullable=False)
    created_at    = Column(DateTime,    default=datetime.utcnow, nullable=False)

    items = relationship("StudyPlanItem", back_populates="plan", cascade="all, delete-orphan")


class StudyPlanItem(Base):
    __tablename__ = "study_plan_items"
    __table_args__ = {"extend_existing": True}

    id             = Column(Integer,     primary_key=True)
    plan_id        = Column(Integer,     ForeignKey("study_plans.id", ondelete="CASCADE"),
                            index=True, nullable=False)
    topic_id       = Column(Integer,     ForeignKey("topics.id", ondelete="CASCADE"),
                            index=True, nullable=False)
    scheduled_date = Column(DateTime,    nullable=False)
    completed      = Column(Boolean,     default=False, nullable=False)
    created_at     = Column(DateTime,    default=datetime.utcnow, nullable=False)

    plan  = relationship("StudyPlan", back_populates="items")
    topic = relationship("Topic")


class TopicResource(Base):
    """Cached online resources for a topic - found via web search, not
    uploaded by the student. Cached (not re-searched on every page view)
    because free-tier search APIs meter by request; a topic's resources
    don't change fast enough to justify searching on every visit."""
    __tablename__ = "topic_resources"
    __table_args__ = {"extend_existing": True}

    id             = Column(Integer,     primary_key=True)
    topic_id       = Column(Integer,     ForeignKey("topics.id", ondelete="CASCADE"),
                            index=True, nullable=False)
    title          = Column(String(512), nullable=False)
    url            = Column(String(1024), nullable=False)
    snippet        = Column(Text,        nullable=True)
    source_domain  = Column(String(256), nullable=True)
    created_at     = Column(DateTime,    default=datetime.utcnow, nullable=False)

    topic = relationship("Topic")


# =============================================================================
# In-app feedback (bug reports, feature requests, etc.) — Phase 1 beta launch
# =============================================================================


class Feedback(Base):
    """Student-submitted feedback captured in-app instead of via WhatsApp DM.

    `metadata_json` holds everything auto-captured from the client so the
    student never has to explain technical details themselves - route,
    browser/OS, viewport, current course/topic/document if applicable,
    app version, recent console errors/network failures, and the
    session/request IDs a developer would otherwise have to ask for.
    """
    __tablename__ = "feedback"
    __table_args__ = {"extend_existing": True}

    id             = Column(Integer,      primary_key=True)
    user_id        = Column(String(128),  index=True, nullable=False)
    category       = Column(String(32),   nullable=False)   # bug | feature | performance | ai_response | ui_ux | study_plan | question_generation | other
    title          = Column(String(256),  nullable=False)
    description    = Column(Text,         nullable=False)
    expected_behavior = Column(Text,      nullable=True)
    actual_behavior   = Column(Text,      nullable=True)
    severity       = Column(String(16),   default="medium", nullable=False)  # low | medium | high | critical
    status         = Column(String(16),   default="new",    nullable=False, index=True)  # new | open | in_progress | resolved | closed
    priority       = Column(String(16),   nullable=True)     # set by whoever triages - not student-supplied
    screenshot_url = Column(String(1024), nullable=True)
    metadata_json  = Column(JSON,         nullable=True)
    created_at     = Column(DateTime,     default=datetime.utcnow, nullable=False, index=True)
    updated_at     = Column(DateTime,     default=datetime.utcnow,
                            onupdate=datetime.utcnow, nullable=False)
