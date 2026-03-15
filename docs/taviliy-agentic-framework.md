# Taviliy Agentic Framework Offering

## Objective
Launch a paid RareAgent.work offering that bundles Taviliy-powered research feeds, an agentic framework starter kit, and a managed job queue so customers can submit coding/research tasks and receive vetted outputs. The deliverable must include:

1. **Product surface** on the marketing site with a clear CTA and feature list.
2. **Stripe-powered checkout + subscription management** so customers can pay for access.
3. **Execution pipeline** that runs Taviliy searches, applies our multi-agent refinement loop, and stores/caches results for reuse.
4. **Outcome reporting** that proves our pipeline beats raw Taviliy results across at least 10 starter searches.

## Architecture Overview
| Layer | Purpose | Key Components |
|-------|---------|----------------|
| Ingestion | Pull fresh Taviliy search results on a schedule and normalize into our schema. | `scripts/taviliy-ingest.mjs` (new) + `TVLY_API_KEY` secret + memU/qmd storage hooks |
| Cache & Cost Tracking | Deduplicate queries, persist normalized responses, and log Taviliy/API/model spend per job. | `data/search-cache/*.json`, `data/metrics/cost-ledger.json`, job_id + query_hash + cost fields |
| Agentic Refinement | Run large-context + specialist agents (researcher → synthesizer → coder) to improve the raw hits. | `autoresearch` workflow, multi-model routing (Gemini for synthesis, Claude/Codex for code) |
| Delivery | Publish results via API + site landing page + downloadable briefs. | `/api/agentic/search`, `/agentic-framework` route, managed job queue |

## Implementation Tasks
1. **Secrets + Client**
   - Move `TVLY_API.env` -> `shared_variables/search.env` and expose `TVLY_API_KEY` to the Next.js runtime (edge-safe). 
   - Add a typed client (`src/lib/taviliy.ts`) with retries/backoff + request metrics logging.

2. **Website Surface**
   - Add `/agentic-framework` route describing tiers, architecture diagram, and CTA button wired to Stripe Checkout.
   - Update navigation (header + footer) to link to the new page.

3. **Stripe Subscription Flow**
   - Install `stripe` SDK and create `/api/payments/checkout` and `/api/payments/webhook` routes.
   - Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
   - Store subscription state in `data/customers/subscriptions.json` until we move to a DB.

4. **Search Pipeline Scripts**
   - `npm run taviliy:seed` → fetch 10 canonical searches (e.g., "open-source agentic framework", "multi-agent workflow reliability") and cache responses.
   - `npm run taviliy:loop` → run the autoresearch workflow per cached query, produce improved summaries/code, and score improvement vs. raw Taviliy results.
   - Persist per-query metrics to `data/research/taviliy-benchmarks.json` (fields: query, raw_score, improved_score, delta, agents_used, runtime_seconds).

5. **Autoresearch Loop Definition**
   - Use the existing `autoresearch` skill wrapper to define a 3-agent relay: Researcher → Evaluator → Builder.
   - Each turn consumes cached Taviliy snippets plus prior agent notes, producing refined context or code.
   - Stop when improvement delta plateaus or after 4 turns.

6. **Testing & Reporting**
   - For each of the 10 starter searches, produce before/after artifacts and store them under `data/research/examples/<slug>/`.
   - Add a `/agentic-framework/results` section on the site summarizing the aggregate improvement and listing anonymized sample outputs.
   - Add a QA checklist ensuring Taviliy API usage stays within quota, autop loop latency < 2 minutes, and Stripe webhooks succeed locally.

## Metrics & Cost Controls
- **Cost Ledger:** Append every Taviliy call + LLM run to `data/metrics/cost-ledger.json` with timestamps, model, unit cost, and cached-hit boolean.
- **Cache Policy:** dedupe queries by `sha256(lower(query) + params)`; auto-serve cached results if identical within 24h unless user forces refresh.
- **Trend Tracking:** Run a nightly script to aggregate query frequencies and store `data/metrics/search-trends.json` for the dashboard + customer insights.

## Rollout Checklist
- [ ] Secrets migrated + verified.
- [ ] `stripe` dependency installed and env docs updated.
- [ ] `/agentic-framework` page live with CTA.
- [ ] Checkout/webhook smoke-tested (Stripe CLI or test keys).
- [ ] `taviliy:seed` + `taviliy:loop` scripts produce 10-run benchmark JSON.
- [ ] Reporting section shows measured improvement deltas.
- [ ] Backlog + status files updated with owners + blockers.
