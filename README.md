# spoudazo-api — seed backend

Ported from `PDF-RESEARCHER-ANALYSER`. Streamlit and Google Drive sync were
dropped entirely — everything here is UI-framework-agnostic service code
that was already decoupled from Streamlit (verified: no `st.` calls outside
try/except blocks in any file below).

## What's in this seed

| File | Status | Notes |
|---|---|---|
| `app/services/embedding_service.py` | ported, unchanged | local sentence-transformers, auto batch sizing |
| `app/services/extraction_service.py` | ported, unchanged | PDF text + OCR extraction, chunking |
| `app/services/rag_service.py` | ported, unchanged | FAISS index, multi-query + MMR retrieval |
| `app/services/pdf_service.py` | ported, unchanged | dependency of batch_service |
| `app/services/batch_service.py` | ported, unchanged | parallel multi-file ingestion |
| `app/services/ingestion_service.py` | ported, unchanged | job queue processing |
| `app/services/ai_router.py` | ported, unchanged | OpenRouter free-router + HF fallback |
| `app/db/models.py` | ported, unchanged | `Document`, `DocumentChunk`, etc. — course/topic/question/attempt tables NOT added yet |
| `app/db/repository.py` | ported, unchanged | CRUD for the models above |
| `app/models/schemas.py` | ported, unchanged | Pydantic schemas used by the services |
| `app/config.py` | ported, unchanged | Streamlit-secrets loader is a no-op without Streamlit installed, safe to leave |
| `app/utils/logger.py`, `app/utils/retry.py` | ported, unchanged | |
| `app/main.py` | **new** | real FastAPI app, all routers mounted |
| `app/db/models.py` | **extended** | added `Course`, `Topic`, `Question`, `Attempt`, `TopicMastery` + a `course_id` FK on `Document` |
| `app/db/repository.py` | **extended** | added CRUD for the 5 new models, incl. `get_weak_areas()` |
| `app/services/ai_router.py` | **extended** | added `complete_custom(system_prompt, user_prompt)` — same OpenRouter→HF fallback as `chat()`, but with a caller-supplied system prompt instead of the hardcoded research-assistant one, since the 3 agents each need their own |
| `app/agents/topic_extraction.py` | **new** | pulls all ready chunks for a course, one-shot LLM call → JSON topic list, persisted |
| `app/agents/question_generation.py` | **new** | per-topic theory question + rubric generation, and CBT batch generation — both grounded via `rag_service.get_library_context()` scoped to the course's documents |
| `app/agents/grading.py` | **new** | rubric-based theory grading (point-by-point met/partial/missing, not a single 0-10 ask) + CBT scoring, both update `TopicMastery` |
| `app/api/*.py` | **new** | 13 endpoints total: courses, materials upload/list, topic extraction/list, theory+CBT question generation/list, theory+CBT attempt submission, weak-areas query |

All of the above has been smoke-tested in this sandbox: the extended models build cleanly against SQLAlchemy (including the new `Document.course_id` cascade), the full repository CRUD path was exercised end-to-end against a real DB (course → topics → question → attempt → mastery → weak-area ranking), and the FastAPI app boots with all 13 routes registered — confirmed via the OpenAPI schema, not just import success.

**Not yet tested:** the LLM calls themselves (`ai_router.complete_custom`) and the OCR/embedding pipeline, since that needs `OPENROUTER_API_KEY` and the heavy ML deps (`faiss`, `torch`, `sentence-transformers`) which weren't installed in this sandbox. That's the first thing to run once you've got the env set up — upload a real PDF and watch it come out the other end as chunks + embeddings before touching the agents.

## What was deliberately left out of the old repo

- `app/ui/`, `streamlit_app.py`, `run.py`, `streamlit/` — Streamlit UI, replaced by the Next.js frontend
- `app/services/drive_service.py`, `app/services/multi_drive_service.py` — Google Drive sync, not needed for MVP week
- `app/services/analysis_service.py` — orchestration layer written for chat-with-a-paper; its *pattern* (retrieve via `rag_service` → call `ai_router` with a task prompt) is what `app/agents/*.py` should follow, but the file itself mixes in Drive/export calls you don't need. Write the three new agent files fresh using it as a reference, don't port it directly.
- `app/services/export_service.py` — DOCX/XLSX export, not in MVP scope

## Branch workflow (single repo)

```
main                      ← protected, only merge from feature branches
├── feat/db-schema         ← add Course, Topic, Question, Attempt models + migration
├── feat/materials-upload  ← app/api/materials.py + app/api/courses.py
├── feat/topic-extraction  ← app/agents/topic_extraction.py + app/api/topics.py
├── feat/question-gen      ← app/agents/question_generation.py
├── feat/grading           ← app/agents/grading.py + app/api/attempts.py
└── feat/cbt                ← CBT generation + weak-area query endpoint
```

Suggested order: `feat/db-schema` first (everything else needs the new tables),
then `feat/materials-upload` (proves the ingestion pipe end to end), then the
three agent branches in the sequence from the build plan (topic extraction →
question generation → grading → CBT). Merge each into `main` as it passes a
manual smoke test — don't let branches stack on top of each other unmerged,
you don't have slack this week to untangle a rebase.

## Setup

```bash
pip install -r requirements.txt --break-system-packages   # if on the Anthropic sandbox / similar
cp .env.example .env   # fill in OPENROUTER_API_KEY at minimum
uvicorn app.main:app --reload
```

No Alembic migration is included — `init_db()` in `app/main.py`'s startup hook calls
`Base.metadata.create_all()`, which creates every table (old + new) against a fresh
Postgres DB. Wire up Alembic yourself when you're ready for real migrations.

`GET /health` should return `{"status": "ok"}` once Postgres is reachable. Full endpoint
list is at `GET /docs` once the server's running.

## Endpoints (13 total)

```
POST   /courses
GET    /courses?user_id=...
GET    /courses/{course_id}
POST   /courses/{course_id}/materials              (multipart upload)
GET    /courses/{course_id}/materials
POST   /courses/{course_id}/topics/extract
GET    /courses/{course_id}/topics
POST   /topics/{topic_id}/questions/theory/generate
GET    /topics/{topic_id}/questions/theory
POST   /topics/{topic_id}/questions/cbt/generate?n=5
GET    /topics/{topic_id}/questions/cbt
POST   /questions/{question_id}/theory-attempts
POST   /questions/{question_id}/cbt-attempts
GET    /courses/{course_id}/weak-areas?user_id=...
```

## First run, in order

1. `POST /courses` → get a `course_id`
2. `POST /courses/{course_id}/materials` with a real PDF → confirm `status: "ready"` and a non-zero `chunk_count`. This is the pipe from Day 1 of the build plan — don't move on until this works with a real file.
3. `POST /courses/{course_id}/topics/extract` → eyeball the returned topics against the actual PDF content before trusting anything downstream.
4. `POST /topics/{topic_id}/questions/theory/generate` → check the rubric is sane (3-6 specific, checkable points).
5. `POST /questions/{question_id}/theory-attempts` with a deliberately incomplete answer → confirm `gaps` correctly lists what you left out.
