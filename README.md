# RareAgent.work

Production-focused Next.js app for AI news digest, model ranking intelligence, and premium report publishing with owner review gates.

## What is implemented

- **News freshness enforcement (14 days hard filter)**
  - Source file: `data/news/news.json`
  - Runtime filter in `src/lib/content.ts` (`getFreshNews(14)`)
  - Refresh/prune script: `npm run news:refresh` (`scripts/news-refresh.mjs`)
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
```

> `x-user-email` must be populated by your auth layer/proxy for owner enforcement.

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
