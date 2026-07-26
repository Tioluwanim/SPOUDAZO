"""
app/services/embedding_loader.py - The one place responsible for getting
embeddings, via Hugging Face's remote Inference API.

Architecture, specifically for Render free tier (512MB RAM):
- No model weights are ever downloaded or loaded into this process. There
  is no torch, no local sentence-transformers model in memory - loading
  BGE-M3 locally (even just the library overhead) would likely exceed
  512MB on its own, before touching a single request.
- Every embedding call is a lightweight HTTP request to Hugging Face's
  Inference API via `huggingface_hub.InferenceClient`. HF's servers do
  the actual computation; this process just sends text and receives
  vectors back.
- HF_MODEL_REPO selects which model HF's API runs. HF_TOKEN authenticates
  requests (required for a private repo; also raises your free-tier rate
  limit even for a public model - see huggingface.co/pricing).

Honest caveat about response shape: `feature_extraction()`'s return shape
depends on how the specific model is served upstream - some models return
one pooled vector per input, others return one vector per token (needing
mean-pooling on our end). This can't be verified from a sandbox with no
network access to huggingface.co, so `_encode_one()` below defensively
handles both shapes rather than assuming one. Once this is deployed for
real, it's worth logging the raw response shape once to confirm which
case BGE-M3 actually hits and simplifying accordingly.

Rate limits: free-tier Inference API allows a few hundred requests/hour.
Each chunk of a document is one request (see the per-text-not-batched
note below) - a ~150-chunk PDF is ~150 requests. Fine for occasional use;
worth watching if multiple students upload large documents in the same
hour.
"""

from __future__ import annotations

from app.config import HF_MODEL_REPO, HF_TOKEN
from app.utils.logger import get_logger

logger = get_logger(__name__)

_client_wrapper = None


class _RemoteEmbeddingClient:
    """
    Wraps huggingface_hub.InferenceClient behind the same .encode()
    interface sentence-transformers exposes, so embedding_service.py's
    existing calling code (batch splitting, progress logging, etc.)
    doesn't need to know the actual computation happens remotely.
    """

    def __init__(self, repo_id: str, token: str = ""):
        from huggingface_hub import InferenceClient
        self._client = InferenceClient(token=token or None)
        self._repo_id = repo_id

    def encode(
        self,
        texts,
        batch_size: int = 32,          # accepted for interface compatibility; see note below
        normalize_embeddings: bool = True,
        show_progress_bar: bool = False,
        **_ignored,
    ):
        import numpy as np

        single_input = isinstance(texts, str)
        text_list = [texts] if single_input else list(texts)

        # Called one text at a time rather than as a single batched
        # request. huggingface_hub *does* support passing a list directly,
        # but the resulting response shape for a batch of texts that may
        # tokenize to different lengths is not something this sandbox can
        # verify against the real API - one call at a time keeps the
        # response shape unambiguous (see _encode_one) at the cost of more
        # HTTP round-trips. Worth revisiting for real batching once this
        # is verified live against your actual HF_MODEL_REPO.
        vectors = [self._encode_one(t, normalize_embeddings) for t in text_list]
        result = np.vstack(vectors)
        return result[0] if single_input else result

    def _encode_one(self, text: str, normalize: bool):
        import numpy as np

        raw = self._client.feature_extraction(text, model=self._repo_id, normalize=normalize)
        vec = np.asarray(raw, dtype="float32")

        if vec.ndim == 1:
            pass  # already a single pooled vector - the common case for a properly-served sentence embedding model
        elif vec.ndim == 2:
            # Token-level output (one row per token) - mean-pool to a single vector.
            vec = vec.mean(axis=0)
        else:
            raise ValueError(f"Unexpected embedding response shape {vec.shape} from HF Inference API")

        if normalize:
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm

        return vec


def get_embedding_model():
    """
    Returns the process-wide remote embedding client. Nothing is
    downloaded here - this just constructs a lightweight HTTP client
    wrapper, once, and reuses it for the life of the process.
    """
    global _client_wrapper

    if _client_wrapper is not None:
        return _client_wrapper

    logger.info(
        "Using Hugging Face Inference API for embeddings — model='%s'%s (no local model weights loaded)",
        HF_MODEL_REPO,
        " with an auth token" if HF_TOKEN else "",
    )
    _client_wrapper = _RemoteEmbeddingClient(HF_MODEL_REPO, HF_TOKEN)
    return _client_wrapper


def warm_up() -> None:
    """
    Kept for interface compatibility with the startup hook in app/main.py.
    There's no local model load to eagerly trigger anymore - constructing
    the lightweight client wrapper is instant, so this just does that.
    """
    get_embedding_model()


def is_model_loaded() -> bool:
    return _client_wrapper is not None
