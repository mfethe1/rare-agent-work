# AGENTS.md — Rare Agent Work

Instructions for AI coding agents working on this codebase.

## Project Overview

**Rare Agent Work** (https://rareagent.work) is an operator-grade AI research platform that publishes deeply researched reports on multi-agent systems, low-code automation, and production deployment standards. It also provides a curated AI agent news feed, model leaderboard, weekly digest, and AI-powered implementation guide.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Database:** Supabase (PostgreSQL + Auth)
- **Payments:** Stripe
- **AI:** Anthropic Claude Sonnet 4.6 (chat/guide features)
- **Hosting:** Vercel
- **Testing:** Vitest (unit) + Playwright (e2e)

## Repository Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/               # API endpoints
│   │   ├── v1/            # Public versioned API (news, models, reports)
│   │   ├── chat/          # AI guide chat endpoint
│   │   ├── articles/      # News article management
│   │   ├── digest/        # Weekly digest generation
│   │   └── ...
│   ├── news/              # News feed page
│   ├── models/            # Model leaderboard page
│   ├── digest/            # Weekly digest page
│   ├── reports/           # Individual report pages
│   ├── auth/              # Authentication pages
│   ├── feed.xml/          # RSS feed route
│   ├── llms.txt/          # LLM-readable site description route
│   └── layout.tsx         # Root layout with metadata
├── components/            # React components
│   ├── JsonLd.tsx         # Schema.org structured data
│   ├── ReportChat.tsx     # AI guide chat widget
│   ├── NewsClient.tsx     # News feed client component
│   ├── ModelsTable.tsx    # Model leaderboard table
│   └── ...
├── lib/                   # Shared utilities
│   ├── news-store.ts      # News data access layer
│   ├── reports.ts         # Report catalog & content
│   ├── analytics.ts       # GA4 event tracking
│   ├── cost-gate.ts       # AI usage cost controls
│   └── supabase/          # Supabase client helpers
├── __tests__/             # Vitest unit tests
public/
├── llms.txt               # Static LLM content index
├── research/              # Static research assets
supabase/
├── migrations/            # Database migrations
e2e/                       # Playwright end-to-end tests
```

## Development

### Setup
```bash
npm install
cp .env.local.example .env.local  # Add Supabase + Stripe + Anthropic keys
npm run dev                        # http://localhost:3000
```

### Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `ANTHROPIC_API_KEY` — Anthropic API key for AI guide

### Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm run test     # Vitest unit tests
npx playwright test  # E2E tests
```

### Testing
- Unit tests live in `src/__tests__/` and use Vitest
- E2E tests live in `e2e/` and use Playwright
- Run `npm run test` before committing
- All tests must pass — no skipping, no `test.skip` without a tracking issue

## Public API

The site exposes agent-friendly JSON APIs at `/api/v1/`:

| Endpoint | Description | Params |
|----------|-------------|--------|
| `GET /api/v1/news` | Curated AI agent news | `?tag=`, `?days=`, `?limit=`, `?tags_only=true` |
| `GET /api/v1/models` | Agentic model leaderboard | `?sort=`, `?provider=`, `?min_score=` |
| `GET /api/v1/reports` | Report catalog with previews | — |
| `GET /api/openapi.json` | OpenAPI 3.1 spec | — |

All public APIs return JSON with CORS enabled (`Access-Control-Allow-Origin: *`).

## Agent-Friendly Features

- **`/llms.txt`** — LLM-readable site description (public)
- **`/.well-known/agent.json`** — Agent discovery card
- **`/feed.xml`** — RSS 2.0 feed of news items
- **`/sitemap.xml`** — XML sitemap
- **Schema.org JSON-LD** — Structured data on all pages (WebSite, WebAPI, Dataset, Product types)
- **`Link` HTTP headers** — All pages include `rel="ai-content-index"` and `rel="agent-card"` headers

## Coding Conventions

- **TypeScript strict mode** — no `any` types, no `@ts-ignore`
- **Server Components by default** — only use `'use client'` when interactivity is required
- **API routes return JSON** — always include `Cache-Control` and `Access-Control-Allow-Origin` headers on public endpoints
- **Data functions in `src/lib/`** — keep data access separate from UI components
- **Escape XML in feeds** — always use `escapeXml()` for RSS/Atom content
- **Cost controls** — AI features (chat) must go through `cost-gate.ts` to enforce token limits

## Commit Messages

Format: `[agent] verb: description`

Examples:
- `[macklemore] feat: add NLWeb /ask endpoint`
- `[lenny] fix: RSS link tag not rendering in head`
- `[rosie] docs: update AGENTS.md with new API endpoints`

## What NOT to Do

- Do not commit `.env.local` or any secrets
- Do not bypass `cost-gate.ts` token limits
- Do not add `'use client'` to components that can be Server Components
- Do not modify Supabase migrations without creating a new migration file
- Do not remove or weaken CORS headers on public API routes
- Do not use `dangerouslySetInnerHTML` without XSS sanitization
