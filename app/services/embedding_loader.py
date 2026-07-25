"""
app/services/embedding_loader.py - The one place responsible for loading
the embedding model.

Architecture:
- The model lives on Hugging Face Hub (HF_MODEL_REPO), full stop. Nothing
  in this codebase downloads a model from Google Drive, Dropbox, GitHub
  Releases, or an arbitrary URL, and nothing copies model files into a
  project folder to be committed or baked into a Docker image. The git
  repo contains only application code.
- Downloading and caching is entirely Hugging Face's own responsibility,
  via `huggingface_hub`'s standard cache (~/.cache/huggingface by
  default, or wherever HF_HOME points - see the deployment note below).
  This module does not implement any custom caching logic.
- The model is loaded exactly once per process (a module-level singleton)
  and reused for every request. Other modules must import
  `get_embedding_model()` from here rather than constructing their own
  `SentenceTransformer(...)` instance - that's the "single service"
  requirement: one loader, many callers, one loaded model in memory.

Deployment note (e.g. Render): to avoid re-downloading the model on every
deploy/restart, mount a persistent disk and set the HF_HOME environment
variable to a path on that disk (e.g. HF_HOME=/data/huggingface-cache).
huggingface_hub reads HF_HOME automatically - no code change needed here,
just the environment variable.
"""

from __future__ import annotations

import threading

from app.config import EMBEDDING_BACKEND, HF_MODEL_REPO, HF_TOKEN
from app.utils.logger import get_logger

logger = get_logger(__name__)

_model = None
_model_lock = threading.Lock()


def _set_torch_threads() -> None:
    """CPU-bound encoding should use all available cores unless the
    deployment environment has already pinned thread counts explicitly."""
    try:
        import os
        import torch
        cpu_count = os.cpu_count() or 4
        if torch.get_num_threads() < cpu_count:
            torch.set_num_threads(cpu_count)
    except Exception:
        pass


def get_embedding_model():
    """
    Returns the process-wide SentenceTransformer instance, loading it
    from HF_MODEL_REPO on first call. Thread-safe: if two requests race
    to trigger the first load, only one actually downloads/initializes
    the model - the other waits and reuses it, rather than loading twice.
    """
    global _model

    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:  # re-check after acquiring the lock
            return _model

        from sentence_transformers import SentenceTransformer

        _set_torch_threads()

        logger.info(
            "Loading embedding model '%s' from Hugging Face Hub (backend=%s)%s",
            HF_MODEL_REPO, EMBEDDING_BACKEND,
            " with an auth token" if HF_TOKEN else "",
        )

        kwargs: dict = {}
        if HF_TOKEN:
            # Only needed for private repos - public repos need nothing here.
            kwargs["token"] = HF_TOKEN
        if EMBEDDING_BACKEND == "onnx":
            kwargs["backend"] = "onnx"

        _model = SentenceTransformer(HF_MODEL_REPO, **kwargs)
        logger.info("Embedding model loaded and ready.")
        return _model


def warm_up() -> None:
    """Triggers the load eagerly (e.g. from a startup hook) so the first
    real request doesn't pay the load cost. Safe to call multiple times -
    get_embedding_model() is idempotent after the first successful load."""
    get_embedding_model()


def is_model_loaded() -> bool:
    """Whether the model has been loaded yet, without triggering a load."""
    return _model is not None