# AGENTS.md — Rare Agent Work

> Instructions for AI coding agents working on this codebase.

## Project Overview

**Rare Agent Work** is a Next.js 16 web application that publishes operator-grade research reports on AI agent systems, a curated news feed, and an agentic model leaderboard. It's deployed on Railway with Supabase as the database layer and Stripe for payments.

- **URL:** https://rareagent.work
- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase · Stripe
- **Node version:** 22.x
- **Package manager:** npm

## Getting Started

```bash
# Install dependencies
npm install

# Create local env file (see Environment Variables below)
cp .env.example .env.local

# Run development server
npm run dev
# → http://localhost:3000

# Run tests
npm test

# Run linter
npm run lint

# Production build
npm run build
```

## Environment Variables

Required for local development:

```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
ANTHROPIC_API_KEY=<anthropic-api-key>  # Powers the AI chat feature
```

Job Queue (Upstash Redis):
```
UPSTASH_REDIS_REST_URL=<upstash-redis-rest-url>
UPSTASH_REDIS_REST_TOKEN=<upstash-redis-rest-token>
REDIS_URL=<redis-connection-url>  # For BullMQ worker
USE_JOB_QUEUE=true  # Enable async job processing
SERVICE_API_KEY=<service-api-key>  # For /api/jobs endpoints
```

Optional:
```
NEXT_PUBLIC_GA4_MEASUREMENT_ID=<ga4-id>
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_SUBSCRIBE=<label>
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_REPORT=<label>
WORKER_CONCURRENCY=5
WORKER_MAX_JOBS_PER_SECOND=10
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/
│   │   ├── v1/             # Public agent-friendly API (no auth required)
│   │   │   ├── models/     # GET - Model leaderboard data
│   │   │   ├── news/       # GET - Curated news feed
│   │   │   ├── reports/    # GET - Report catalog + previews
│   │   │   └── openapi.json/ # GET - OpenAPI 3.1 spec
│   │   ├── articles/       # Internal article management (service auth)
│   │   ├── chat/           # AI chat endpoint (user auth)
│   │   ├── jobs/           # Job queue management API (service auth)
│   │   ├── news/           # Internal news store API
│   │   ├── stripe/         # Stripe checkout + webhooks
│   │   └── ...
│   ├── models/             # Model leaderboard pages
│   ├── news/               # News feed page
│   ├── reports/[slug]/     # Individual report pages
│   ├── feed.xml/           # RSS 2.0 feed
│   ├── robots.ts           # Robots.txt (allows /api/v1/)
│   ├── sitemap.ts          # XML sitemap
│   └── layout.tsx          # Root layout with metadata
├── components/             # React components
├── lib/                    # Shared utilities
│   ├── reports.ts          # Report definitions and catalog
│   ├── news-store.ts       # File-based news storage
│   ├── supabase/           # Supabase client helpers
│   ├── cost-gate.ts        # Token usage cost controls
│   ├── queue/              # Async job queue (Upstash Redis + BullMQ)
│   │   ├── types.ts        # Job type definitions
│   │   ├── client.ts       # Queue client for enqueuing jobs
│   │   ├── handlers.ts     # Job processing handlers
│   │   ├── worker.ts       # Background worker process
│   │   └── README.md       # Job queue documentation
│   └── analytics.ts        # GA4 event helpers
public/
├── llms.txt                # LLM/agent discovery file
├── .well-known/
│   ├── agent-card.json     # A2A-style agent discovery card
│   └── agent.json          # Legacy compatibility manifest
└── research/               # Static research assets
supabase/
└── migrations/             # Database migration SQL files
data/
└── news.json               # File-based news store (runtime)
```

## Architecture Decisions

- **App Router only** — no Pages Router. All routes use the `app/` directory.
- **Server Components by default** — only use `'use client'` when interactivity requires it.
- **Two API tiers:**
  - `/api/v1/*` — public, no auth, CORS-enabled, agent-friendly. These are the read-only endpoints for programmatic access.
  - `/api/*` (non-v1) — internal, require service auth or user session. Not for external consumption.
- **Reports are defined in code** (`src/lib/reports.ts`) as a typed Record, not in the database. Full report content is delivered as Supabase-stored markdown after purchase verification.
- **News has dual storage** — file-based (`data/news.json`) for the curated feed, Supabase `articles` table for the full article pipeline. Both are used.
- **Models** — stored in Supabase `models` table with seed data fallback in the page component.
- **Async job queue** — Upstash Redis + BullMQ for background processing. Stripe webhooks can optionally enqueue jobs instead of processing synchronously. Enable with `USE_JOB_QUEUE=true`.

## Coding Conventions

- **TypeScript strict mode** — no `any` types without justification.
- **Imports** — use `@/` path alias (maps to `src/`).
- **Components** — functional components only, named exports preferred.
- **API routes** — export named HTTP method handlers (`GET`, `POST`, etc.).
- **Styling** — Tailwind CSS utility classes. No CSS modules or styled-components.
- **Error handling** — API routes return `NextResponse.json({ error: '...' }, { status: N })`.
- **Cache headers** — public API routes should set `Cache-Control` and `Access-Control-Allow-Origin: *`.

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run src/__tests__/reports.test.ts
```

Tests use Vitest. Test files live in `src/__tests__/`. E2E tests use Playwright (config in `playwright.config.ts`).

## Database Migrations

Migrations are in `supabase/migrations/` and follow the naming convention `YYYYMMDD_description.sql`. Apply with Supabase CLI:

```bash
npx supabase db push
```

## Deployment

- **Platform:** Railway (linked to GitHub `main` branch)
- **Auto-deploy:** Push to `main` triggers build + deploy
- **Build command:** `npm run build`
- **Start command:** `npm start`
- **Worker process:** `npm run worker` (separate Railway service recommended)

### Railway Multi-Service Setup

For production, run two Railway services:

1. **Web service** - Next.js app (`npm start`)
2. **Worker service** - Background job processor (`npm run worker`)

Both services share the same environment variables. The worker service should have:
- Same codebase (linked to same GitHub repo)
- Same environment variables
- Start command: `npm run worker`

## Agent-Friendly Features

This site practices what it preaches — it's built to be consumed by AI agents:

- `/llms.txt` — plain-text site description for LLMs
- `/.well-known/agent-card.json` — A2A-style discovery card
- `/.well-known/agent.json` — legacy compatibility manifest for older consumers
- `/api/v1/openapi.json` — full OpenAPI 3.1 specification
- `/api/v1/models` — queryable model leaderboard
- `/api/v1/news` — filterable news feed
- `/api/v1/reports` — report catalog with preview content
- `/feed.xml` — RSS 2.0 feed
- Schema.org JSON-LD on all pages
- RSS `<link>` tag in `<head>` for auto-discovery

## Common Tasks

### Add a new report
1. Add the report definition to `src/lib/reports.ts`
2. The route `/reports/[slug]` will pick it up automatically
3. Update `llms.txt`, `agent-card.json`, and the legacy `agent.json` manifest if the report introduces new capabilities

### Add a new public API endpoint
1. Create route at `src/app/api/v1/<endpoint>/route.ts`
2. Include `Cache-Control` and `Access-Control-Allow-Origin: *` headers
3. Add to the OpenAPI spec in `src/app/api/v1/openapi.json/route.ts`
4. Update `/.well-known/agent-card.json` and the compatibility `/.well-known/agent.json` manifest
5. Update `/llms.txt`

### Update model leaderboard
Use the admin endpoint `POST /api/models/update` with service auth, or update seed data in `src/app/models/page.tsx` and `src/app/api/v1/models/route.ts`.

### Add a new background job type
1. Add job type and payload interface to `src/lib/queue/types.ts`
2. Add handler function to `src/lib/queue/handlers.ts`
3. Add case to the switch statement in `handleJob()`
4. Enqueue jobs using `enqueueJob()` from anywhere in the app
5. See `src/lib/queue/README.md` for detailed examples
