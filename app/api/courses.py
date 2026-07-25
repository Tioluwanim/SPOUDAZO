"""app/api/courses.py - Create and list courses."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import require_course_owner
from app.api.schemas import CourseCreate, CourseOut
from app.auth import get_current_user_id
from app.db.repository import repository

router = APIRouter(prefix="/courses", tags=["courses"])


@router.post("", response_model=CourseOut)
def create_course(payload: CourseCreate, user_id: str = Depends(get_current_user_id)):
    course = repository.create_course(user_id=user_id, name=payload.name, code=payload.code)
    return course


@router.get("", response_model=list[CourseOut])
def list_courses(user_id: str = Depends(get_current_user_id)):
    return repository.list_courses(user_id)


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, user_id: str = Depends(get_current_user_id)):
    return require_course_owner(course_id, user_id)
