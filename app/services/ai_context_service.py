"""
app/services/ai_context_service.py - Section 15's "AI Context Service".

Automatically gathers what the spec's "AI Context Awareness" section
lists - current document/section/page, weak topics, reading history, exam
date - so the study assistant never has to ask the student for
information the app already has. Independent of the chat/agent layer
that consumes it (study_assistant_service imports this, not the other
way around) - this only reads state, it doesn't know what a "chat
message" is.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.db.repository import repository


@dataclass
class ContextBundle:
    course_name: str = ""
    current_document_filename: str = ""
    current_section_title: str = ""
    current_page: int | None = None
    weak_topics: list[str] = field(default_factory=list)
    exam_date: datetime | None = None
    days_until_exam: int | None = None
    recently_read_documents: list[str] = field(default_factory=list)

    def to_prompt_block(self) -> str:
        """Renders as a compact block to fold into a system prompt. Empty
        bundle renders to "" so callers never have to special-case "no
        context available" - an empty addendum is just a no-op."""
        lines: list[str] = []
        if self.current_document_filename:
            where = f"The student is currently reading \"{self.current_document_filename}\""
            if self.current_section_title:
                where += f", section \"{self.current_section_title}\""
            if self.current_page:
                where += f" (page {self.current_page})"
            lines.append(where + ".")
        if self.weak_topics:
            lines.append(f"Their weakest topics in this course right now: {', '.join(self.weak_topics)}.")
        if self.exam_date and self.days_until_exam is not None:
            lines.append(
                f"Their exam is on {self.exam_date.strftime('%d %b %Y')} "
                f"({self.days_until_exam} day{'s' if self.days_until_exam != 1 else ''} away)."
            )
        if self.recently_read_documents:
            lines.append(f"Recently read in this course: {', '.join(self.recently_read_documents)}.")

        if not lines:
            return ""
        return (
            "\n\nContext already available about this student - use it naturally where "
            "relevant, don't ask them to repeat it, and don't force it into every answer "
            "if it isn't relevant to their question:\n" + "\n".join(f"- {l}" for l in lines)
        )


def build_context_bundle(
    course_id: int,
    user_id: str,
    current_doc_id: str | None = None,
    current_section_index: int | None = None,
) -> ContextBundle:
    """
    `current_doc_id`/`current_section_index` are passed explicitly by the
    reader (it knows precisely what's on screen); when absent (e.g. the
    floating chat widget used outside the reader), this falls back to the
    most recently viewed document in the course via ReadingProgress -
    still automatic, just less precise than "exactly this section right now".
    """
    bundle = ContextBundle()

    course = repository.get_course(course_id)
    if course is None:
        return bundle
    bundle.course_name = f"{course.code} {course.name}"

    doc_id = current_doc_id
    if doc_id is None:
        recent = repository.list_recent_documents(user_id, limit=1)
        recent_in_course = [r for r in recent if r["course_id"] == course_id]
        if recent_in_course:
            doc_id = recent_in_course[0]["doc_id"]

    if doc_id:
        document = repository.get_document_by_doc_id(doc_id)
        if document and document.course_id == course_id:
            bundle.current_document_filename = document.filename
            if current_section_index is not None:
                from app.services.pdf_service import pdf_service
                processed = pdf_service.load_document(doc_id)
                if processed and 0 <= current_section_index < len(processed.sections):
                    section = processed.sections[current_section_index]
                    bundle.current_section_title = section.title
                    bundle.current_page = section.page_start

    weak = repository.get_weak_areas(course_id, user_id, limit=3)
    bundle.weak_topics = [w["name"] for w in weak if w["mastery_score"] < 50]

    plan = repository.get_latest_study_plan(course_id, user_id)
    if plan:
        bundle.exam_date = plan.exam_date
        bundle.days_until_exam = max(0, (plan.exam_date.date() - datetime.utcnow().date()).days)

    recent_docs = repository.list_recent_documents(user_id, limit=5)
    bundle.recently_read_documents = [
        r["filename"] for r in recent_docs if r["course_id"] == course_id and r["doc_id"] != doc_id
    ][:3]

    return bundle
