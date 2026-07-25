"""
app/main.py - Spoudazõ API entry point.

Boots FastAPI, initializes the database,
preloads the embedding model, and mounts API routers.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import DEBUG
from app.db.repository import init_db

logger = logging.getLogger(__name__)


def _warm_embedding_model() -> None:
    """Preload the embedding model into memory."""
    try:
        from app.services.embedding_loader import warm_up

        warm_up()
        logger.info("Embedding model pre-warmed and ready.")
    except Exception:
        logger.exception(
            "Embedding model warm-up failed. "
            "It will be loaded lazily on the first request."
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks."""
    init_db()
    _warm_embedding_model()
    yield
    # Shutdown tasks can go here if needed.


app = FastAPI(
    title="Spoudazõ API",
    debug=DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


# Import routers after app creation
from app.api import (
    attempts,
    chat,
    courses,
    materials,
    questions,
    resources,
    study_plan,
    topics,
)

app.include_router(courses.router)
app.include_router(materials.router)
app.include_router(topics.router)
app.include_router(questions.router)
app.include_router(attempts.router)
app.include_router(chat.router)
app.include_router(study_plan.router)
app.include_router(study_plan.item_router)
app.include_router(resources.router)