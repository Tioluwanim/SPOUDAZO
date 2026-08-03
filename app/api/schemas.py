"""
app/api/schemas.py - Pydantic request/response models for the new endpoints.

Kept separate from app/models/schemas.py (ported, used internally by the
ported services) so the two don't collide.
"""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


# ── Courses ──────────────────────────────────────────────────────────────────

class CourseCreate(BaseModel):
    name: str
    code: str


class CourseOut(BaseModel):
    id: int
    name: str
    code: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Materials ────────────────────────────────────────────────────────────────

class MaterialOut(BaseModel):
    doc_id: str
    filename: str
    status: str
    chunk_count: int
    week_number: int | None = None


class DocumentSectionOut(BaseModel):
    """One reading-pane unit. Sections (not raw pages) are the natural unit
    for the reader - they already carry a title and a page range from
    extraction, so the frontend doesn't need to reinvent chaptering."""
    title: str
    content: str
    section_type: str
    page_start: int
    page_end: int


class MaterialDetailOut(BaseModel):
    """Everything the reading pane needs for one document. Deliberately
    omits raw chunks (RAG's unit, not the reader's) and full_text (sections
    already cover the same content, structured) - sending both would double
    the payload for no benefit to the reading experience."""
    doc_id: str
    filename: str
    status: str
    week_number: int | None = None
    course_id: int
    page_count: int
    word_count: int
    sections: list[DocumentSectionOut]


# ── Topics ───────────────────────────────────────────────────────────────────

class TopicOut(BaseModel):
    id: int
    name: str
    frequency_score: int

    class Config:
        from_attributes = True


# ── Questions ────────────────────────────────────────────────────────────────

class TheoryQuestionOut(BaseModel):
    id: int
    topic_id: int
    prompt: str
    difficulty: str


class CBTQuestionOut(BaseModel):
    id: int
    topic_id: int
    prompt: str
    options: dict
    difficulty: str


class CBTQuestionWithAnswer(CBTQuestionOut):
    correct_answer: str
    explanation: str | None = None


# ── Attempts ─────────────────────────────────────────────────────────────────

class TheoryAttemptRequest(BaseModel):
    student_answer: str


class GapDetail(BaseModel):
    point: str
    reason: str


class TheoryAttemptResult(BaseModel):
    score: int
    max_score: int
    gaps: list[GapDetail]


class CBTAttemptRequest(BaseModel):
    selected_option: str  # "A" | "B" | "C" | "D"


class CBTAttemptResult(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str | None = None


class WeakAreaOut(BaseModel):
    topic_id: int
    name: str
    mastery_score: int


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class CourseChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = []
    current_doc_id: str | None = None        # set when the message came from the reader's docked panel
    current_section_index: int | None = None


class CourseChatResponse(BaseModel):
    answer: str
    sources: list[str]
    grounding: str  # "notes" | "notes+web" | "web" | "general"


# ── Study Planner ────────────────────────────────────────────────────────────

class StudyPlanCreate(BaseModel):
    exam_date: datetime
    hours_per_day: int


class StudyPlanItemOut(BaseModel):
    id: int
    topic_id: int
    topic_name: str
    scheduled_date: datetime
    completed: bool


class StudyPlanOut(BaseModel):
    id: int
    exam_date: datetime
    hours_per_day: int
    compressed: bool = False
    items: list[StudyPlanItemOut]


# ── Smart Library online resources ──────────────────────────────────────────

class TopicResourceOut(BaseModel):
    title: str
    url: str
    snippet: str | None
    source_domain: str | None


# ── Feedback ─────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    category: str            # bug | feature | performance | ai_response | ui_ux | study_plan | question_generation | other
    title: str
    description: str
    expected_behavior: str | None = None
    actual_behavior: str | None = None
    severity: str = "medium"  # low | medium | high | critical
    screenshot_url: str | None = None
    metadata: dict = {}       # auto-captured client context (page, route, browser, etc.)


class FeedbackUpdate(BaseModel):
    status: str | None = None       # new | open | in_progress | resolved | closed
    priority: str | None = None
    severity: str | None = None


class FeedbackOut(BaseModel):
    id: int
    reference_id: str        # e.g. "SPD-000152"
    category: str
    title: str
    description: str
    expected_behavior: str | None
    actual_behavior: str | None
    severity: str
    status: str
    priority: str | None
    screenshot_url: str | None
    metadata: dict
    created_at: datetime
    updated_at: datetime


# ── Smart Library reader ────────────────────────────────────────────────────

class AnnotationCreate(BaseModel):
    kind: str  # highlight | bookmark
    section_index: int
    quote: str
    note: str | None = None


class AnnotationOut(BaseModel):
    id: int
    doc_id: str
    kind: str
    section_index: int
    quote: str
    note: str | None
    created_at: datetime


class BookmarkOut(BaseModel):
    """Annotation plus enough document context to render in the
    cross-course sidebar without a second lookup per bookmark."""
    id: int
    doc_id: str
    filename: str
    course_id: int
    section_index: int
    quote: str
    note: str | None
    created_at: datetime


class RecentDocumentOut(BaseModel):
    doc_id: str
    filename: str
    course_id: int
    progress_percent: int
    last_viewed_at: datetime


class FavoriteToggleOut(BaseModel):
    doc_id: str
    favorited: bool


class ReadingProgressIn(BaseModel):
    last_section_index: int
    progress_percent: int
    seconds_delta: int = 0  # seconds spent reading since the last save - feeds streak/time-read analytics


class ReadingProgressOut(BaseModel):
    doc_id: str
    last_section_index: int
    progress_percent: int
    last_viewed_at: datetime


class ReadingStatsOut(BaseModel):
    total_seconds_read: int
    active_days: int
    current_streak_days: int
    documents_started: int
    documents_completed: int
    highlight_count: int
    bookmark_count: int
    favorite_count: int


class SearchHitOut(BaseModel):
    kind: str  # "content" | "highlight" | "bookmark"
    doc_id: str
    filename: str
    course_id: int
    snippet: str
    score: float
    section_title: str = ""
    page_number: int | None = None
    annotation_id: int | None = None


class TextActionRequest(BaseModel):
    action: str
    selected_text: str
    section_title: str = ""
    target_language: str = ""  # only used by the "translate" action


class TextActionResponse(BaseModel):
    action: str
    kind: str          # "prose" | "list" | "object"
    result: str | list | dict
