# RareAgent.work

Production-focused Next.js app for AI news digest, model ranking intelligence, and premium report publishing with owner review gates.

## What is implemented

- **News freshness enforcement (14 days hard filter)**
  - Source file: `data/news/news.json`
  - Runtime filter in `src/lib/content.ts` (`getFreshNews(14)`)
  - Automated ingest script pulls Reddit (AI subs) + Hacker News stories and rewrites both the feed + free summary (`npm run news:refresh`)
  - Verification script (`npm run news:verify`) fails the pipeline if the latest story is older than 6h or if the feed drops below 8 items
- **Free condensed summary**
  - Route: `/free-summary`
  - Source: fresh news only, max 8 items.
- **Model capabilities + ranking page**
  - Route: `/models`
  - Source: `data/models/models.json`
- **Report route fixed (no 404 for configured report slugs)**
  - Route: `/reports/[slug]`
  - Includes `empirical-architecture` via `data/reports/reports.json`
- **Owner-only review queue scaffold**
  - Route: `/admin/review`
  - Owner check via `x-user-email` header and `OWNER_EMAILS` env
  - API: `POST /api/reports/review` supports approve/reject/publish state transitions
  - Enforces: cannot publish unless approved
- **Signup scaffold for subscriptions/reports access**
  - Route: `/signup`
  - API: `POST /api/signup`
  - Stores to `data/reports/subscribers.json`

## Important env config

Create `.env.local` with at minimum:

```env
OWNER_EMAILS=michael.fethe@protelynx.ai
ANTHROPIC_API_KEY=YOUR_KEY_HERE
TVLY_API_KEY=YOUR_TAVILIY_KEY
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> `x-user-email` must be populated by your auth layer/proxy for owner enforcement. See `docs/taviliy-agentic-framework.md` for the end-to-end checklist and pipeline steps.

## Commands

```bash
npm install
npm run news:refresh
npm run dev
npm run build
```

## Core routes

- `/` home + navigation hub
- `/news` fresh digest (14-day policy)
- `/free-summary` condensed brief
- `/models` ranked model list
- `/reports/empirical-architecture` report page
- `/admin/review` owner-only review queue
- `/signup` user signup
- `/agentic-framework` (new) — Taviliy-powered agentic kit + checkout CTA

## New Taviliy Agentic Offering
- Architecture + rollout checklist lives in `docs/taviliy-agentic-framework.md`.
- `npm run taviliy:seed` (to be added) will fetch 10 benchmark searches and cache them.
- `npm run taviliy:loop` will execute the autoresearch loop, log improvement metrics, and publish them to the new site section.
- Stripe Checkout + subscription APIs will live under `/api/payments/*` with test keys until prod rotation is cleared (BACKLOG task AO-2026-03-10-04).
