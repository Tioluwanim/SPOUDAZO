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
