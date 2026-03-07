# RareAgent Work — Critical Buildout Plan (v1)

## Objectives from Michael
1. AI news pipeline with specialized agents.
2. `/models` page with latest model capabilities + rankings from multiple sources.
3. Enforce freshness: no news older than 14 days.
4. Free condensed summary of major recent events.
5. Human review gate for premium reports before publishing.

---

## System Design

### A) Agentized News Pipeline
- **collector-agent**: pulls candidate stories from approved sources.
- **ranker-agent**: scores relevance (agentic workflows, models, releases, benchmarks, pricing changes).
- **dedupe-agent**: removes duplicates/near-duplicates.
- **summary-agent**: writes concise free summary (public-safe, non-hype).
- **compliance-agent**: enforces freshness + required fields + source URL.

**Output target**
- `data/news/news.json` (full curated list)
- `data/news/free-summary.json` (public condensed brief)

### B) Models Intelligence Pipeline
- Source aggregation from multiple providers/rankings.
- Normalize into schema:
  - model_name
  - provider
  - context_window
  - modality
  - latency_tier
  - price_input/output
  - benchmark_snapshot
  - last_verified_at
  - source_urls
- Publish to `data/models/models.json`.
- Render at `/models`.

### C) Freshness Policy
- Hard filter: `published_at >= now - 14 days`.
- If stale items detected:
  - auto-remove from public list
  - log to pipeline report.

### D) Free Condensed Summary
- Build daily short-form digest:
  - Top 5-8 developments
  - Why it matters (1 line each)
  - "Action signal" tag (builders, founders, operators)

### E) Human Review Gate for Premium Reports
- Report lifecycle states:
  - `draft` -> `pending_review` -> `approved` -> `published`
- No publish unless `approved_by` + timestamp.
- Add `/admin/reports/review` queue for Michael.

---

## Initial Build Order
1. Data schemas + storage folders.
2. `/models` UI route + loading from normalized JSON.
3. News filter with 14-day freshness gate.
4. `/free-summary` page from condensed digest JSON.
5. Report review queue + state machine (block direct publish).
6. Scheduled routines for refresh + validation.

---

## Review Locations (current)
- Primary app repo: `E:\Projects\rareagent.work`
- Existing PDF/report artifacts seen in workspace:
  - `C:\Users\mfeth\.openclaw\workspace\agent-coordination\reports\`
  - `C:\Users\mfeth\.openclaw\workspace\agent-coordination\agent-inboxes\to_all\`

(These are not yet wired into rareagent.work review queue.)

---

## Acceptance Criteria
- `/models` shows multi-source curated, timestamped model data.
- News list contains no items older than 14 days.
- Free digest updates and is readable in <2 minutes.
- Premium reports cannot publish without Michael approval.
- All pipelines produce audit logs + last-run status.
