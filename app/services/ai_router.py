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
           Model configured by HUGGINGFACE_MODEL (recommended to use a currently live HF Inference Provider model)
           Uses the configured HuggingFace Inference Provider model.
           OpenAI-compatible. Token needs "Make calls to Inference Providers" scope.
           Docs: https://huggingface.co/docs/inference-providers

All three use the openai SDK — identical interface for streaming and non-streaming.
"""

from __future__ import annotations

import random
import time
import logging
import threading
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
    VISION_MODEL,
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

# ── Production routing controls ──────────────────────────────────────────────
# These are intentionally conservative for a small Render instance.
PROVIDER_COOLDOWN_SECONDS = 20
RATE_LIMIT_COOLDOWN_SECONDS = 8
MAX_RETRY_BACKOFF_SECONDS = 8
FIRST_TOKEN_TIMEOUT_SECONDS = 35

# Do not retry permanent client/configuration failures.
_PERMANENT_HTTP_ERRORS = {400, 401, 403, 404, 422}

# Provider state is process-local. This prevents a broken provider from being
# hammered repeatedly by every request while still allowing automatic recovery.
_PROVIDER_STATE_LOCK = threading.Lock()
_PROVIDER_UNAVAILABLE_UNTIL: dict[str, float] = {}
_PROVIDER_FAILURES: dict[str, int] = {}


def _provider_is_available(provider: str) -> bool:
    now = time.monotonic()
    with _PROVIDER_STATE_LOCK:
        return now >= _PROVIDER_UNAVAILABLE_UNTIL.get(provider, 0.0)


def _mark_provider_failure(
    provider: str,
    *,
    status: int | None = None,
) -> None:
    now = time.monotonic()

    if status in _PERMANENT_HTTP_ERRORS:
        cooldown = PROVIDER_COOLDOWN_SECONDS * 6
    elif status == 429:
        cooldown = RATE_LIMIT_COOLDOWN_SECONDS
    else:
        cooldown = PROVIDER_COOLDOWN_SECONDS

    with _PROVIDER_STATE_LOCK:
        failures = _PROVIDER_FAILURES.get(provider, 0) + 1
        _PROVIDER_FAILURES[provider] = failures
        _PROVIDER_UNAVAILABLE_UNTIL[provider] = now + cooldown


def _mark_provider_success(provider: str) -> None:
    with _PROVIDER_STATE_LOCK:
        _PROVIDER_FAILURES.pop(provider, None)
        _PROVIDER_UNAVAILABLE_UNTIL.pop(provider, None)


def _retry_delay(attempt: int, *, base: float = 1.0) -> float:
    """Exponential backoff with small jitter to avoid synchronized retries."""
    exponential = min(
        MAX_RETRY_BACKOFF_SECONDS,
        base * (2 ** max(0, attempt - 1)),
    )
    return exponential + random.uniform(0, min(0.5, exponential * 0.15))



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
            "AIRouter ready — OR=%s (%s) | Groq=%s (%s) | HF=%s | "
            "timeouts OR=%ss/Groq=%ss/HF=%ss",
            self._or_model,
            "configured" if OPENROUTER_API_KEY else "disabled",
            GROQ_MODEL,
            "configured" if GROQ_API_KEY else "disabled",
            HUGGINGFACE_MODEL,
            OPENROUTER_TIMEOUT,
            GROQ_TIMEOUT,
            HUGGINGFACE_TIMEOUT,
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

    def transcribe_image(
        self,
        image_bytes: bytes,
        prompt: str,
        doc_id: str = "",
    ) -> str:
        """
        Vision OCR is deliberately isolated from the normal text fallback chain.

        The extraction service already bounds the call duration. This method
        additionally rejects obviously invalid/oversized payloads and avoids
        retrying permanent API errors.
        """
        import base64

        slog = ServiceLogger("ai_router", doc_id=doc_id)

        if not image_bytes:
            slog.warning("Vision OCR skipped — empty image payload")
            return ""

        # Avoid turning a huge rendered page into a massive JSON request.
        max_image_bytes = 12 * 1024 * 1024
        if len(image_bytes) > max_image_bytes:
            slog.warning(
                "Vision OCR skipped — image payload %.1f MB exceeds %.1f MB limit",
                len(image_bytes) / (1024 * 1024),
                max_image_bytes / (1024 * 1024),
            )
            return ""

        if not OPENROUTER_API_KEY:
            slog.warning("Vision OCR skipped — OpenRouter API key unavailable")
            return ""

        if not _provider_is_available("openrouter_vision"):
            slog.warning("Vision OCR skipped — OpenRouter vision temporarily cooled down")
            return ""

        started = time.monotonic()
        b64_image = base64.b64encode(image_bytes).decode("ascii")

        try:
            response = self.or_client.chat.completions.create(
                model=VISION_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{b64_image}"
                            },
                        },
                    ],
                }],
                max_tokens=MAX_TOKENS,
                temperature=max(float(TEMPERATURE), 0.01),
                stream=False,
                timeout=OPENROUTER_TIMEOUT,
            )

            text = (
                response.choices[0].message.content
                if response.choices
                else ""
            ) or ""
            text = text.strip()

            if text:
                _mark_provider_success("openrouter_vision")
                slog.info(
                    "Vision OCR complete — model=%s chars=%d elapsed=%.1fs",
                    VISION_MODEL,
                    len(text),
                    time.monotonic() - started,
                )
            else:
                slog.warning(
                    "Vision OCR returned empty content — model=%s elapsed=%.1fs",
                    VISION_MODEL,
                    time.monotonic() - started,
                )

            return text

        except Exception as exc:
            status = _http_status(exc)
            _mark_provider_failure("openrouter_vision", status=status)
            slog.warning(
                "Vision OCR failed — model=%s status=%s elapsed=%.1fs: %s",
                VISION_MODEL,
                status or "network",
                time.monotonic() - started,
                _error_body(exc),
            )
            return ""

    def get_provider_status(self) -> dict:
        now = time.monotonic()

        def state(provider: str) -> dict:
            with _PROVIDER_STATE_LOCK:
                until = _PROVIDER_UNAVAILABLE_UNTIL.get(provider, 0.0)
                failures = _PROVIDER_FAILURES.get(provider, 0)

            return {
                "healthy": now >= until,
                "failures": failures,
                "cooldown_remaining_s": round(max(0.0, until - now), 1),
            }

        return {
            "openrouter": {
                "configured": bool(OPENROUTER_API_KEY),
                "model": self._or_model,
                "task_overrides": {
                    k: v for k, v in _TASK_MODEL_OVERRIDES.items() if v
                },
                **state("openrouter"),
            },
            "groq": {
                "configured": bool(GROQ_API_KEY),
                "model": GROQ_MODEL,
                **state("groq"),
            },
            "huggingface": {
                "configured": bool(HUGGINGFACE_API_KEY),
                "model": HUGGINGFACE_MODEL,
                **state("huggingface"),
            },
            "vision": {
                "configured": bool(OPENROUTER_API_KEY),
                "model": VISION_MODEL,
                **state("openrouter_vision"),
            },
        }

    # ── Streaming ─────────────────────────────────────────────────────────────

    def _stream_with_fallback(
        self,
        messages: list[dict],
        slog: ServiceLogger,
        model: str,
    ) -> Generator[str, None, None]:
        """
        Stream from the first healthy provider that produces a real chunk.

        A provider is only considered successful after the first chunk arrives.
        That prevents an empty/failed stream from looking like a successful
        response and gives the next provider a chance.
        """
        providers = []

        if OPENROUTER_API_KEY and _provider_is_available("openrouter"):
            providers.append(
                ("OpenRouter", lambda: self._stream_openrouter(messages, slog, model))
            )

        if GROQ_API_KEY and _provider_is_available("groq"):
            providers.append(
                ("Groq", lambda: self._stream_groq(messages, slog))
            )

        if HUGGINGFACE_API_KEY and _provider_is_available("huggingface"):
            providers.append(
                ("HuggingFace", lambda: self._stream_huggingface(messages, slog))
            )

        if not providers:
            slog.error("No healthy LLM providers available")
            yield self._unavailable_message()
            return

        for provider_name, factory in providers:
            try:
                slog.info("Streaming via %s …", provider_name)
                gen = factory()

                first_chunk = next(gen, None)
                if first_chunk:
                    _mark_provider_success(provider_name.lower())
                    yield first_chunk
                    yield from gen
                    return

                slog.warning("%s returned an empty stream — trying next provider", provider_name)
                _mark_provider_failure(provider_name.lower())

            except Exception as exc:
                status = _http_status(exc)
                _mark_provider_failure(provider_name.lower(), status=status)
                _log_error(provider_name, exc, slog)

        yield self._unavailable_message()

    @staticmethod
    def _unavailable_message() -> str:
        return (
            "⚠️ I couldn't reach the study AI right now. "
            "Please try again in a moment."
        )

    def _stream_openrouter(
        self,
        messages: list[dict],
        slog: ServiceLogger,
        model: str,
    ) -> Iterator[str]:
        for attempt in range(1, RETRY_MAX_ATTEMPTS + 1):
            try:
                resp = self.or_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=MAX_TOKENS,
                    temperature=max(float(TEMPERATURE), 0.01),
                    stream=True,
                )

                count = 0
                for chunk in resp:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    content = delta.content if delta else None
                    if content:
                        count += 1
                        yield content

                slog.info("OpenRouter stream done — %d chunks", count)
                if count:
                    _mark_provider_success("openrouter")
                return

            except Exception as exc:
                status = _http_status(exc)
                if status in _PERMANENT_HTTP_ERRORS:
                    raise

                if attempt >= RETRY_MAX_ATTEMPTS:
                    raise

                delay = _retry_delay(attempt, base=1.0)
                slog.warning(
                    "OpenRouter transient error attempt %d/%d: %s — retry in %.1fs",
                    attempt, RETRY_MAX_ATTEMPTS, _error_body(exc), delay,
                )
                time.sleep(delay)

    def _stream_groq(
        self,
        messages: list[dict],
        slog: ServiceLogger,
    ) -> Iterator[str]:
        for attempt in range(1, RETRY_MAX_ATTEMPTS + 1):
            try:
                resp = self.groq_client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=messages,
                    max_tokens=MAX_TOKENS,
                    temperature=max(float(TEMPERATURE), 0.01),
                    stream=True,
                )

                count = 0
                for chunk in resp:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    content = delta.content if delta else None
                    if content:
                        count += 1
                        yield content

                slog.info("Groq stream done — %d chunks", count)
                if count:
                    _mark_provider_success("groq")
                return

            except Exception as exc:
                status = _http_status(exc)
                if status in _PERMANENT_HTTP_ERRORS:
                    raise

                if attempt >= RETRY_MAX_ATTEMPTS:
                    raise

                delay = _retry_delay(attempt, base=1.0)
                slog.warning(
                    "Groq transient error attempt %d/%d: %s — retry in %.1fs",
                    attempt, RETRY_MAX_ATTEMPTS, _error_body(exc), delay,
                )
                time.sleep(delay)

    def _stream_huggingface(
        self,
        messages: list[dict],
        slog: ServiceLogger,
    ) -> Iterator[str]:
        for attempt in range(1, RETRY_MAX_ATTEMPTS + 1):
            try:
                resp = self.hf_client.chat.completions.create(
                    model=HUGGINGFACE_MODEL,
                    messages=messages,
                    max_tokens=MAX_TOKENS,
                    temperature=max(float(TEMPERATURE), 0.01),
                    stream=True,
                )

                count = 0
                for chunk in resp:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    content = delta.content if delta else None
                    if content:
                        count += 1
                        yield content

                slog.info("HuggingFace stream done — %d chunks", count)
                if count:
                    _mark_provider_success("huggingface")
                return

            except Exception as exc:
                status = _http_status(exc)

                if status in _PERMANENT_HTTP_ERRORS:
                    raise

                if attempt >= RETRY_MAX_ATTEMPTS:
                    raise

                delay = _retry_delay(attempt, base=1.5)
                slog.warning(
                    "HuggingFace transient error attempt %d/%d: %s — retry in %.1fs",
                    attempt, RETRY_MAX_ATTEMPTS, _error_body(exc), delay,
                )
                time.sleep(delay)

    def _complete_with_fallback(
        self,
        messages: list[dict],
        question: str,
        doc_id: str,
        slog: ServiceLogger,
        model: str,
    ) -> ChatResponse:
        start = time.monotonic()

        candidates = []

        if OPENROUTER_API_KEY and _provider_is_available("openrouter"):
            candidates.append(
                ("openrouter", LLMProvider.OPENROUTER, model, self._complete_openrouter)
            )

        if GROQ_API_KEY and _provider_is_available("groq"):
            candidates.append(
                ("groq", LLMProvider.GROQ, GROQ_MODEL, self._complete_groq)
            )

        if HUGGINGFACE_API_KEY and _provider_is_available("huggingface"):
            candidates.append(
                ("huggingface", LLMProvider.HUGGINGFACE, HUGGINGFACE_MODEL, self._complete_huggingface)
            )

        if not candidates:
            return ChatResponse(
                answer=self._unavailable_message(),
                doc_id=doc_id,
                question=question,
                provider=LLMProvider.OPENROUTER,
                model=model,
                response_time_ms=round((time.monotonic() - start) * 1000, 2),
            )

        for provider_name, provider_enum, provider_model, call in candidates:
            provider_started = time.monotonic()
            try:
                answer = (call(messages, slog) or "").strip()

                if answer:
                    _mark_provider_success(provider_name)
                    slog.info(
                        "%s selected — chars=%d elapsed=%.1fs",
                        provider_name,
                        len(answer),
                        time.monotonic() - provider_started,
                    )
                    return ChatResponse(
                        answer=answer,
                        doc_id=doc_id,
                        question=question,
                        provider=provider_enum,
                        model=provider_model,
                        response_time_ms=round(
                            (time.monotonic() - start) * 1000, 2
                        ),
                    )

                slog.warning(
                    "%s returned empty content — trying next provider",
                    provider_name,
                )
                _mark_provider_failure(provider_name)

            except Exception as exc:
                status = _http_status(exc)
                _mark_provider_failure(provider_name, status=status)
                _log_error(provider_name, exc, slog)

        return ChatResponse(
            answer=self._unavailable_message(),
            doc_id=doc_id,
            question=question,
            provider=LLMProvider.OPENROUTER,
            model=model,
            response_time_ms=round((time.monotonic() - start) * 1000, 2),
        )

    def _complete_openrouter(
        self, messages: list[dict], slog: ServiceLogger, model: str
    ) -> str:
        resp = self.or_client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=MAX_TOKENS,
            temperature=max(float(TEMPERATURE), 0.01),
            stream=False,
            timeout=OPENROUTER_TIMEOUT,
        )
        answer = resp.choices[0].message.content or ""
        slog.info("OpenRouter complete ✓ — %d chars", len(answer))
        return answer

    def _complete_groq(
        self, messages: list[dict], slog: ServiceLogger
    ) -> str:
        resp = self.groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=MAX_TOKENS,
            temperature=max(float(TEMPERATURE), 0.01),
            stream=False,
            timeout=GROQ_TIMEOUT,
        )
        answer = resp.choices[0].message.content or ""
        slog.info("Groq complete ✓ — %d chars", len(answer))
        return answer

    def _complete_huggingface(
        self, messages: list[dict], slog: ServiceLogger
    ) -> str:
        resp = self.hf_client.chat.completions.create(
            model=HUGGINGFACE_MODEL,
            messages=messages,
            max_tokens=MAX_TOKENS,
            temperature=max(float(TEMPERATURE), 0.01),
            stream=False,
            timeout=HUGGINGFACE_TIMEOUT,
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
    history: list[ChatMessage],
    max_chars: int = CONTEXT_WINDOW_TOKENS * 3,
) -> list[ChatMessage]:
    """Keep the newest conversational context without blowing the prompt budget."""
    if not history:
        return []

    trimmed: list[ChatMessage] = []
    total_chars = 0

    # Walk backwards so recent turns always survive.
    for msg in reversed(history):
        content_len = len(msg.content or "")
        if trimmed and total_chars + content_len > max_chars:
            break
        trimmed.append(msg)
        total_chars += content_len

    trimmed.reverse()
    return trimmed


def _http_status(exc: Exception) -> int | None:
    try:
        status = getattr(exc, "status_code", None)
        if status is not None:
            return int(status)
    except (TypeError, ValueError):
        pass

    try:
        response = getattr(exc, "response", None)
        status = getattr(response, "status_code", None)
        if status is not None:
            return int(status)
    except (TypeError, ValueError):
        pass

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
