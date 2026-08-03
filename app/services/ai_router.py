"""
ai_router.py - Production LLM router. OpenRouter/HuggingFace endpoints
verified March 2026; Groq added later and not exercised against a live
endpoint from this environment (no network access to Groq's API here) -
verify GROQ_MODEL against Groq's current free-tier catalog before relying
on it in production, same caveat as this app's Cloudflare R2 provider.

PRIMARY  → OpenRouter  https://openrouter.ai/api/v1
           Model: "openrouter/free" by default, or a task-specific
           override (see OPENROUTER_MODEL_* in config.py) - see
           app.services.task_classifier for how a message's task type is
           inferred. OpenRouter's free-models router never returns 404;
           it auto-selects from all currently live free models.
           Docs: https://openrouter.ai/docs/guides/routing/routers/free-models-router

SECOND   → Groq  https://api.groq.com/openai/v1
           A genuinely separate free-tier provider, not another route to
           the OpenRouter aggregator - if OpenRouter's free router is
           degraded, this is a real independent second opinion.

FALLBACK → HuggingFace Inference Providers  https://router.huggingface.co/v1
           Model: "meta-llama/Llama-3.1-8B-Instruct:cerebras"
           Uses :auto suffix to auto-select best available provider.
           OpenAI-compatible. Token needs "Make calls to Inference Providers" scope.
           Docs: https://huggingface.co/docs/inference-providers

All three use the openai SDK — identical interface for streaming and non-streaming.
"""

from __future__ import annotations

import time
import logging
from typing import Generator, Iterator

from app.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    OPENROUTER_MODEL_REASONING,
    OPENROUTER_MODEL_CODING,
    OPENROUTER_MODEL_CREATIVE,
    OPENROUTER_MODEL_LONG_CONTEXT,
    OPENROUTER_MODEL_SIMPLE,
    OPENROUTER_TIMEOUT,
    OPENROUTER_RATE_LIMIT_DELAY,
    GROQ_API_KEY,
    GROQ_MODEL,
    GROQ_BASE_URL,
    GROQ_TIMEOUT,
    HUGGINGFACE_API_KEY,
    HUGGINGFACE_MODEL,
    HUGGINGFACE_BASE_URL,
    HUGGINGFACE_TIMEOUT,
    MAX_TOKENS,
    TEMPERATURE,
    CONTEXT_WINDOW_TOKENS,
    RETRY_MAX_ATTEMPTS,
)
from app.models.schemas import ChatMessage, ChatResponse, LLMProvider
from app.services.task_classifier import TaskType
from app.utils.logger import get_logger, ServiceLogger

logger = get_logger(__name__)

_SYSTEM = (
    "You are Spoudazõ's study buddy - a warm, encouraging presence helping a Nigerian "
    "university student understand their own uploaded course material. Think of "
    "yourself as the friend in the class who's already got the concept and is happy "
    "to walk someone else through it, not a formal lecturer.\n\n"
    "You are given relevant excerpts from the student's course notes/materials as "
    "context, followed by a question. Before answering, quickly work through the "
    "excerpts in your head - what's actually being asked, which parts of the context "
    "are relevant, and what a clear explanation would need to cover - then give your "
    "answer. Answer accurately and clearly based solely on the provided context.\n\n"
    "Rules:\n"
    "- Answer ONLY from the context provided.\n"
    "- If the context is insufficient to answer, say so clearly and warmly (e.g. "
    "\"I don't see that covered in what you've uploaded yet - want to add more notes "
    "on this?\") and suggest the student upload more material on that topic, rather "
    "than guessing.\n"
    "- Never invent facts, formulas, or figures not present in the context.\n"
    "- Be concise but thorough; prefer the shortest answer that fully "
    "addresses the question, explained the way a helpful coursemate would, not "
    "a textbook. A little warmth and encouragement is welcome, especially if the "
    "question suggests the student is stuck or stressed - but don't overdo it or "
    "pad answers with fluff.\n"
    "- When the context includes a section tag (e.g. [METHODS], [RESULTS]), "
    "you may reference which section supports a claim if it adds clarity.\n"
    "- Use structure only when it aids understanding: short lists for "
    "multi-part answers (e.g. several steps or properties), plain prose for "
    "single-point answers. Avoid headers in chat responses.\n"
    "- If multiple context excerpts disagree or seem inconsistent, note the "
    "discrepancy rather than silently picking one.\n"
)

# ── OpenRouter free-router slug ───────────────────────────────────────────────
# "openrouter/free" is the official OpenRouter free-models router.
# It NEVER 404s — auto-selects from whichever free models are live.
_OR_FREE_ROUTER = "openrouter/free"


def _build_openrouter_client():
    from openai import OpenAI
    return OpenAI(
        api_key         = OPENROUTER_API_KEY,
        base_url        = "https://openrouter.ai/api/v1",
        timeout         = OPENROUTER_TIMEOUT,
        default_headers = {
            "HTTP-Referer": "https://pdf-research-analyzer.local",
            "X-Title"     : "PDF Research Analyzer",
        },
    )


def _build_huggingface_client():
    """
    OpenAI SDK pointed at HuggingFace Inference Providers router.
    Endpoint: https://router.huggingface.co/v1  (confirmed current 2026)
    Requires token with 'Make calls to Inference Providers' scope.
    """
    from openai import OpenAI
    return OpenAI(
        api_key  = HUGGINGFACE_API_KEY,
        base_url = HUGGINGFACE_BASE_URL,   # https://router.huggingface.co/v1
        timeout  = HUGGINGFACE_TIMEOUT,
    )


def _build_groq_client():
    """OpenAI-compatible client pointed at Groq's API - same SDK, different
    base_url, same pattern as OpenRouter/HuggingFace above."""
    from openai import OpenAI
    return OpenAI(
        api_key  = GROQ_API_KEY,
        base_url = GROQ_BASE_URL,
        timeout  = GROQ_TIMEOUT,
    )


# ── Task-based model selection ────────────────────────────────────────────────
# Maps a task type to its OpenRouter model override; empty string means "no
# override configured for this task", so the caller falls back to the
# default model. See config.py for why these all default to "".
_TASK_MODEL_OVERRIDES: dict[str, str] = {
    "reasoning": OPENROUTER_MODEL_REASONING,
    "coding": OPENROUTER_MODEL_CODING,
    "creative": OPENROUTER_MODEL_CREATIVE,
    "long_context": OPENROUTER_MODEL_LONG_CONTEXT,
    "simple": OPENROUTER_MODEL_SIMPLE,
}


class AIRouter:
    """
    Routes LLM requests with automatic fallback.
    Never crashes — all public methods are fully exception-safe.
    """

    def __init__(self) -> None:
        self._or_client = None
        self._hf_client = None
        self._groq_client = None
        # Use configured model or fall back to free router
        self._or_model = OPENROUTER_MODEL or _OR_FREE_ROUTER
        logger.info(
            "AIRouter ready — OR model=%s  Groq model=%s (configured=%s)  HF model=%s  HF url=%s",
            self._or_model, GROQ_MODEL, bool(GROQ_API_KEY), HUGGINGFACE_MODEL, HUGGINGFACE_BASE_URL,
        )

    # ── Lazy clients ──────────────────────────────────────────────────────────

    @property
    def or_client(self):
        if self._or_client is None:
            self._or_client = _build_openrouter_client()
        return self._or_client

    @property
    def hf_client(self):
        if self._hf_client is None:
            self._hf_client = _build_huggingface_client()
        return self._hf_client

    @property
    def groq_client(self):
        if self._groq_client is None:
            self._groq_client = _build_groq_client()
        return self._groq_client

    def _model_for_task(self, task_type: TaskType | None) -> str:
        """Resolves which OpenRouter model to use for this request - a
        task-specific override if one is configured, otherwise the same
        default model every request has always used."""
        if task_type:
            override = _TASK_MODEL_OVERRIDES.get(task_type, "")
            if override:
                return override
        return self._or_model

    # ── Public API ────────────────────────────────────────────────────────────

    def chat(
        self,
        question : str,
        context  : str,
        history  : list[ChatMessage],
        doc_id   : str  = "",
        stream   : bool = True,
        system_addendum: str = "",
        task_type: TaskType | None = None,
    ) -> Generator[str, None, None] | ChatResponse:
        slog     = ServiceLogger("ai_router", doc_id=doc_id)
        messages = self._build_messages(question, context, history, system_addendum)
        model    = self._model_for_task(task_type)
        slog.info("Chat — stream=%s  task=%s  model=%s  q='%s'", stream, task_type or "default", model, question[:60])

        if stream:
            return self._stream_with_fallback(messages, slog, model)
        return self._complete_with_fallback(messages, question, doc_id, slog, model)

    def complete_custom(
        self,
        system_prompt: str,
        user_prompt  : str,
        doc_id       : str = "",
        task_type    : TaskType | None = None,
    ) -> str:
        """
        Same OpenRouter → Groq → HuggingFace fallback as chat(), but with a
        caller-supplied system prompt instead of the hardcoded research-
        assistant one. Used by app/agents/* (topic extraction, question
        generation, grading, text actions) which each need a different,
        task-specific system prompt. Always non-streaming — these are
        structured/JSON generation tasks, not chat.
        """
        slog = ServiceLogger("ai_router", doc_id=doc_id)
        model = self._model_for_task(task_type)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        response = self._complete_with_fallback(messages, user_prompt, doc_id, slog, model)
        return response.answer

    def get_provider_status(self) -> dict:
        return {
            "openrouter" : {
                "configured": bool(OPENROUTER_API_KEY),
                "model"     : self._or_model,
                "task_overrides": {k: v for k, v in _TASK_MODEL_OVERRIDES.items() if v},
            },
            "groq": {
                "configured": bool(GROQ_API_KEY),
                "model"     : GROQ_MODEL,
            },
            "huggingface": {
                "configured": bool(HUGGINGFACE_API_KEY),
                "model"     : HUGGINGFACE_MODEL,
            },
        }

    # ── Streaming ─────────────────────────────────────────────────────────────

    def _stream_with_fallback(
        self,
        messages : list[dict],
        slog     : ServiceLogger,
        model    : str,
    ) -> Generator[str, None, None]:
        # Peek the first chunk rather than list(generator) - buffering the
        # WHOLE response before yielding anything would make this
        # indistinguishable from a blocking call to the caller (nothing
        # shown until generation finishes, then everything at once). We
        # still need SOME way to detect "this provider returned nothing at
        # all" to fall through to the next one, so we consume exactly one
        # chunk to check, then yield it and continue lazily from there.

        # Primary: OpenRouter
        if OPENROUTER_API_KEY:
            try:
                slog.info("Streaming via OpenRouter (%s) …", model)
                gen = self._stream_openrouter(messages, slog, model)
                first_chunk = next(gen, None)
                if first_chunk is not None:
                    yield first_chunk
                    yield from gen
                    return
                slog.warning("OpenRouter returned empty stream — trying Groq")
            except Exception as e:
                _log_error("OpenRouter", e, slog)
        else:
            slog.warning("OPENROUTER_API_KEY not set — skipping primary")

        # Second: Groq - a genuinely separate provider, not another route
        # through the same OpenRouter aggregator.
        if GROQ_API_KEY:
            try:
                slog.info("Streaming via Groq (%s) …", GROQ_MODEL)
                gen = self._stream_groq(messages, slog)
                first_chunk = next(gen, None)
                if first_chunk is not None:
                    yield first_chunk
                    yield from gen
                    return
                slog.warning("Groq returned empty stream — trying HuggingFace")
            except Exception as e:
                _log_error("Groq", e, slog)
        else:
            slog.warning("GROQ_API_KEY not set — skipping second provider")

        # Fallback: HuggingFace
        if HUGGINGFACE_API_KEY:
            try:
                slog.info("Streaming via HuggingFace (%s) …", HUGGINGFACE_MODEL)
                gen = self._stream_huggingface(messages, slog)
                first_chunk = next(gen, None)
                if first_chunk is not None:
                    yield first_chunk
                    yield from gen
                    return
                slog.error("HuggingFace also returned empty stream")
            except Exception as e:
                _log_error("HuggingFace", e, slog)
        else:
            slog.warning("HUGGINGFACE_API_KEY not set — skipping fallback")

        yield (
            "⚠️ All LLM providers are currently unavailable. "
            "Please verify your API keys in the .env file. "
            "OpenRouter key must start with 'sk-or-'. "
            "HuggingFace token must have 'Make calls to Inference Providers' permission."
        )

    def _stream_openrouter(
        self,
        messages : list[dict],
        slog     : ServiceLogger,
        model    : str,
    ) -> Iterator[str]:
        for attempt in range(1, RETRY_MAX_ATTEMPTS + 1):
            try:
                resp = self.or_client.chat.completions.create(
                    model      = model,
                    messages   = messages,
                    max_tokens = MAX_TOKENS,
                    temperature= max(float(TEMPERATURE), 0.01),
                    stream     = True,
                )
                count = 0
                for chunk in resp:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        count += 1
                        yield delta.content
                slog.info("OpenRouter stream done — %d tokens", count)
                return

            except Exception as e:
                status = _http_status(e)
                if status == 429:
                    wait = OPENROUTER_RATE_LIMIT_DELAY
                    slog.warning(
                        "OpenRouter 429 — waiting %.1fs (attempt %d/%d)",
                        wait, attempt, RETRY_MAX_ATTEMPTS,
                    )
                    time.sleep(wait)
                    if attempt >= RETRY_MAX_ATTEMPTS:
                        raise
                elif status and 400 <= status < 500:
                    # Hard client error — no point retrying
                    slog.error("OpenRouter HTTP %s: %s", status, _error_body(e))
                    raise
                elif attempt < RETRY_MAX_ATTEMPTS:
                    delay = 2 ** (attempt - 1)
                    slog.warning(
                        "OpenRouter transient error attempt %d/%d: %s — retry in %ds",
                        attempt, RETRY_MAX_ATTEMPTS, e, delay,
                    )
                    time.sleep(delay)
                else:
                    raise

    def _stream_groq(
        self,
        messages : list[dict],
        slog     : ServiceLogger,
    ) -> Iterator[str]:
        """Groq's API is OpenAI-compatible; error/retry shape mirrors
        HuggingFace's handling below since both are standard
        OpenAI-SDK-style 429/5xx semantics."""
        for attempt in range(1, RETRY_MAX_ATTEMPTS + 1):
            try:
                resp = self.groq_client.chat.completions.create(
                    model      = GROQ_MODEL,
                    messages   = messages,
                    max_tokens = MAX_TOKENS,
                    temperature= max(float(TEMPERATURE), 0.01),
                    stream     = True,
                )
                count = 0
                for chunk in resp:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        count += 1
                        yield delta.content
                slog.info("Groq stream done — %d tokens", count)
                return

            except Exception as e:
                status = _http_status(e)
                if status == 429:
                    slog.warning(
                        "Groq 429 — waiting 10s (attempt %d/%d)",
                        attempt, RETRY_MAX_ATTEMPTS,
                    )
                    time.sleep(10)
                    if attempt >= RETRY_MAX_ATTEMPTS:
                        raise
                elif status and 400 <= status < 500:
                    slog.error("Groq HTTP %s: %s", status, _error_body(e))
                    raise
                elif attempt < RETRY_MAX_ATTEMPTS:
                    delay = 2 ** (attempt - 1)
                    slog.warning(
                        "Groq transient error attempt %d/%d: %s — retry in %ds",
                        attempt, RETRY_MAX_ATTEMPTS, e, delay,
                    )
                    time.sleep(delay)
                else:
                    raise

    def _stream_huggingface(
        self,
        messages : list[dict],
        slog     : ServiceLogger,
    ) -> Iterator[str]:
        """
        HuggingFace Inference Providers router.
        Model format: "org/model:provider" e.g. "meta-llama/Llama-3.1-8B-Instruct:cerebras"
        Use ":auto" suffix to let HF auto-select the best available provider.
        """
        for attempt in range(1, RETRY_MAX_ATTEMPTS + 1):
            try:
                resp = self.hf_client.chat.completions.create(
                    model      = HUGGINGFACE_MODEL,
                    messages   = messages,
                    max_tokens = MAX_TOKENS,
                    temperature= max(float(TEMPERATURE), 0.01),
                    stream     = True,
                )
                count = 0
                for chunk in resp:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        count += 1
                        yield delta.content
                slog.info("HuggingFace stream done — %d tokens", count)
                return

            except Exception as e:
                status = _http_status(e)
                body   = _error_body(e)
                if status == 429:
                    slog.warning(
                        "HuggingFace 429 — waiting 15s (attempt %d/%d)",
                        attempt, RETRY_MAX_ATTEMPTS,
                    )
                    time.sleep(15)
                    if attempt >= RETRY_MAX_ATTEMPTS:
                        raise
                elif status == 503:
                    slog.warning("HuggingFace 503 model loading — waiting 20s")
                    time.sleep(20)
                elif status == 401:
                    slog.error(
                        "HuggingFace 401 Unauthorized. "
                        "Ensure your HF token has 'Make calls to Inference Providers' "
                        "permission at huggingface.co/settings/tokens"
                    )
                    raise
                elif status and 400 <= status < 500:
                    slog.error("HuggingFace HTTP %s: %s", status, body)
                    raise
                elif attempt < RETRY_MAX_ATTEMPTS:
                    delay = 2 ** (attempt - 1)
                    slog.warning(
                        "HuggingFace transient error attempt %d/%d: %s — retry in %ds",
                        attempt, RETRY_MAX_ATTEMPTS, e, delay,
                    )
                    time.sleep(delay)
                else:
                    raise

    # ── Non-streaming ─────────────────────────────────────────────────────────

    def _complete_with_fallback(
        self,
        messages : list[dict],
        question : str,
        doc_id   : str,
        slog     : ServiceLogger,
        model    : str,
    ) -> ChatResponse:
        start    = time.monotonic()
        answer   = ""
        provider = LLMProvider.OPENROUTER
        model_u  = model

        if OPENROUTER_API_KEY:
            try:
                answer   = self._complete_openrouter(messages, slog, model)
                provider = LLMProvider.OPENROUTER
            except Exception as e:
                _log_error("OpenRouter", e, slog)

        if not answer and GROQ_API_KEY:
            try:
                answer   = self._complete_groq(messages, slog)
                provider = LLMProvider.GROQ
                model_u  = GROQ_MODEL
            except Exception as e:
                _log_error("Groq", e, slog)

        if not answer and HUGGINGFACE_API_KEY:
            try:
                answer   = self._complete_huggingface(messages, slog)
                provider = LLMProvider.HUGGINGFACE
                model_u  = HUGGINGFACE_MODEL
            except Exception as e:
                _log_error("HuggingFace", e, slog)
                answer   = (
                    "⚠️ All LLM providers failed. "
                    "Check your API keys and model availability."
                )

        return ChatResponse(
            answer           = answer,
            doc_id           = doc_id,
            question         = question,
            provider         = provider,
            model            = model_u,
            response_time_ms = round((time.monotonic() - start) * 1000, 2),
        )

    def _complete_openrouter(
        self, messages: list[dict], slog: ServiceLogger, model: str
    ) -> str:
        resp   = self.or_client.chat.completions.create(
            model      = model,
            messages   = messages,
            max_tokens = MAX_TOKENS,
            temperature= max(float(TEMPERATURE), 0.01),
            stream     = False,
        )
        answer = resp.choices[0].message.content or ""
        slog.info("OpenRouter complete ✓ — %d chars", len(answer))
        return answer

    def _complete_groq(
        self, messages: list[dict], slog: ServiceLogger
    ) -> str:
        resp   = self.groq_client.chat.completions.create(
            model      = GROQ_MODEL,
            messages   = messages,
            max_tokens = MAX_TOKENS,
            temperature= max(float(TEMPERATURE), 0.01),
            stream     = False,
        )
        answer = resp.choices[0].message.content or ""
        slog.info("Groq complete ✓ — %d chars", len(answer))
        return answer

    def _complete_huggingface(
        self, messages: list[dict], slog: ServiceLogger
    ) -> str:
        resp   = self.hf_client.chat.completions.create(
            model      = HUGGINGFACE_MODEL,
            messages   = messages,
            max_tokens = MAX_TOKENS,
            temperature= max(float(TEMPERATURE), 0.01),
            stream     = False,
        )
        answer = resp.choices[0].message.content or ""
        slog.info("HuggingFace complete ✓ — %d chars", len(answer))
        return answer

    # ── Prompt builder ────────────────────────────────────────────────────────

    def _build_messages(
        self,
        question : str,
        context  : str,
        history  : list[ChatMessage],
        system_addendum: str = "",
    ) -> list[dict]:
        system_content = _SYSTEM + (f"\n\n{system_addendum}" if system_addendum else "")
        msgs: list[dict] = [{"role": "system", "content": system_content}]

        for msg in _trim_history(history):
            msgs.append({"role": msg.role.value, "content": msg.content})

        if context:
            user_content = (
                "CONTEXT FROM THE DOCUMENT:\n"
                + "=" * 60 + "\n"
                + context + "\n"
                + "=" * 60 + "\n\n"
                + f"QUESTION: {question}"
            )
        else:
            user_content = (
                "No relevant context was found for this question.\n\n"
                f"QUESTION: {question}"
            )

        msgs.append({"role": "user", "content": user_content})
        return msgs


# ── Helpers ───────────────────────────────────────────────────────────────────

def _trim_history(
    history   : list[ChatMessage],
    max_chars : int = CONTEXT_WINDOW_TOKENS * 3,
) -> list[ChatMessage]:
    trimmed     = list(history)
    total_chars = sum(len(m.content) for m in trimmed)
    while total_chars > max_chars and len(trimmed) > 2:
        removed      = trimmed.pop(0)
        total_chars -= len(removed.content)
    return trimmed


def _http_status(exc: Exception) -> int | None:
    if hasattr(exc, "status_code"):
        return int(exc.status_code)
    if hasattr(exc, "response") and exc.response is not None:
        return int(exc.response.status_code)
    return None


def _error_body(exc: Exception) -> str:
    if hasattr(exc, "body"):
        return str(exc.body)[:300]
    if hasattr(exc, "message"):
        return str(exc.message)[:300]
    if hasattr(exc, "response") and exc.response is not None:
        try:
            return exc.response.text[:300]
        except Exception:
            pass
    return str(exc)[:300]


def _log_error(
    provider : str,
    exc      : Exception,
    slog     : ServiceLogger,
) -> None:
    status = _http_status(exc)
    body   = _error_body(exc)
    if status:
        slog.warning("%s HTTP %s: %s — trying fallback", provider, status, body)
    else:
        slog.warning(
            "%s error (%s): %s — trying fallback",
            provider, type(exc).__name__, exc,
        )


# ── Singleton ─────────────────────────────────────────────────────────────────
ai_router = AIRouter()
