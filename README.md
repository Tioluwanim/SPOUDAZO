# Spoudazõ — Web

Next.js frontend for the Spoudazõ academic OS. Talks to the FastAPI backend
in `spoudazo-api-seed` (all 13 endpoints, no auth layer yet — identity is a
`user_id` string generated on first visit and kept in `localStorage`).

## Setup

```bash
npm install
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at your running backend
npm run dev
```

Open http://localhost:3000. The backend must be running on the URL in
`NEXT_PUBLIC_API_URL` with CORS allowing `http://localhost:3000` (already
set in `app/main.py`).

## Structure

- `app/page.tsx` — cinematic marketing landing page
- `app/onboarding` — first-run flow: name, register/voice, first course
- `app/dashboard` — course list + create
- `app/courses/[courseId]` — materials upload, topic extraction, topic grid
- `app/courses/[courseId]/topics/[topicId]` — theory + CBT practice, grading
- `app/courses/[courseId]/weak-areas` — ranked mastery view
- `lib/api.ts` — typed fetch client for all 13 backend endpoints
- `lib/session.ts` — local identity + onboarding state (localStorage)
- `components/landing/*` — landing page sections incl. the frequency-pulse signature graphic
- `components/app/*` — dashboard/course/topic UI
- `components/ui/*` — shared primitives (button, card, modal, progress, toast)

## Design notes

Dark "reading-lamp-at-night" palette (ink navy + warm amber glow), because
the product's real moment is a student cramming the night before an exam.
The signature visual motif — a pulse/bar-frequency scanner — mirrors the
backend's actual differentiator: deterministic frequency-counting over past
exam questions, not vibes-based topic guessing.
