# rareagent.work Product Spec
## Free Model Ranking Board + Trending AI Article Index

**Version:** v1.0 (MVP)
**Date:** 2026-03-05
**Owner:** rareagent.work
**Status:** Ready for build

---

## 1) Product Overview

Build two public, zero-paywall surfaces on rareagent.work:

1. **Model Board** — ranked list of AI models with transparent scoring and user upvotes.
2. **Trending AI Articles** — index of recent AI articles ranked by freshness + engagement + click/popularity analytics.

The goal is to create a daily destination for builders and decision-makers: “What models matter now?” and “What AI content is trending now?”.

### Primary Objectives
- Increase organic traffic (SEO + shareability).
- Increase return visits (daily ranking movement).
- Build first-party analytics dataset (model interest + article interest).
- Create monetization hooks (sponsored slots, affiliate clicks, premium filters later).

### Non-goals (MVP)
- No full personalization engine.
- No paid subscriptions/paywalls.
- No complex social graph (followers/comments).
- No custom ML recommender in first 2 weeks.

---

## 2) Users & Core Jobs

### Target Users
- AI builders choosing models/tools.
- AI-curious professionals monitoring trends.
- Content creators/researchers tracking what’s rising.

### Core Jobs-to-be-Done
- “Show me the best free/open models right now.”
- “Show me what AI articles are currently hot.”
- “Let me quickly vote and influence rankings.”
- “Let me open source links and continue browsing.”

---

## 3) MVP Feature Set (2 Weeks)

### A. Model Ranking Board (MVP)
- Public table/cards: model name, provider, category, context length (optional), last updated.
- Score breakdown displayed (e.g., popularity, momentum, quality signal).
- Upvote button (one vote per user fingerprint/account per model, with cooldown).
- Sorting tabs: `Top`, `Trending`, `New`.
- Basic filters: provider, type (LLM/image/code), open/free availability.

### B. Trending AI Articles (MVP)
- Aggregated feed (manual + RSS/API ingestion).
- Article cards: title, source, published time, topic tags.
- Popularity badges: `Rising`, `Hot`, `Fresh`.
- Click-out tracking on outbound links.
- Upvote on article entries.

### C. Analytics + Integrity (MVP)
- Event capture for impressions, clicks, upvotes.
- Unique visitor approximation (fingerprint + signed cookie).
- Anti-abuse protections (rate limits, anomaly flags, soft bans).
- Admin moderation actions for sources/articles/models.

---

## 4) Information Architecture

### Public Routes
- `/models` — Model board main page.
- `/models/:slug` — Model detail page (optional MVP-lite).
- `/trending` — Trending AI articles main page.
- `/articles/:slug` — Internal detail/redirect page (optional).

### Internal/Admin Routes
- `/admin/models`
- `/admin/articles`
- `/admin/sources`
- `/admin/abuse`

---

## 5) Data Model (SQL-oriented)

> Use Postgres-compatible schema. IDs can be UUIDs.

### 5.1 Core Entities

#### `users` (optional for MVP if anonymous-first)
- `id` (uuid, pk)
- `email` (text, unique, nullable for anon)
- `role` (text; default `user`)
- `created_at` (timestamptz)

#### `visitor_identities`
Tracks anonymous identity + abuse signals.
- `id` (uuid, pk)
- `fingerprint_hash` (text, indexed)
- `cookie_id` (text, indexed)
- `ip_hash` (text, indexed)
- `ua_hash` (text)
- `trust_score` (int, default 100)
- `is_suspended` (bool, default false)
- `created_at`, `last_seen_at` (timestamptz)

#### `model_providers`
- `id` (uuid, pk)
- `name` (text, unique)
- `slug` (text, unique)
- `website_url` (text)

#### `models`
- `id` (uuid, pk)
- `name` (text)
- `slug` (text, unique)
- `provider_id` (uuid, fk -> model_providers)
- `category` (text; `llm|image|code|audio|video|other`)
- `is_free` (bool)
- `is_open_source` (bool)
- `release_date` (date)
- `metadata_json` (jsonb)
- `status` (text; `active|hidden|deprecated`)
- `created_at`, `updated_at`

#### `model_votes`
- `id` (uuid, pk)
- `model_id` (uuid, fk -> models, indexed)
- `user_id` (uuid, nullable fk -> users)
- `visitor_identity_id` (uuid, nullable fk -> visitor_identities)
- `vote_value` (smallint; +1 only in MVP)
- `source` (text; `web|api`)
- `created_at` (timestamptz)

**Constraint:** unique composite for one active vote per identity per model within cooldown window (implemented via lock table or application logic + partial index).

#### `article_sources`
- `id` (uuid, pk)
- `name` (text)
- `slug` (text, unique)
- `feed_url` (text)
- `site_url` (text)
- `source_type` (text; `rss|api|manual`)
- `trust_tier` (smallint default 2)
- `is_active` (bool default true)
- `created_at`, `updated_at`

#### `articles`
- `id` (uuid, pk)
- `source_id` (uuid, fk -> article_sources)
- `title` (text)
- `slug` (text, unique)
- `canonical_url` (text, unique)
- `author` (text)
- `summary` (text)
- `content_snippet` (text)
- `published_at` (timestamptz, indexed)
- `ingested_at` (timestamptz)
- `language` (text default `en`)
- `topic_tags` (text[])
- `quality_score` (numeric(5,2) default 0)
- `status` (text; `active|hidden|duplicate|flagged`)
- `created_at`, `updated_at`

#### `article_votes`
- `id` (uuid, pk)
- `article_id` (uuid, fk -> articles)
- `user_id` (uuid, nullable)
- `visitor_identity_id` (uuid, nullable)
- `vote_value` (smallint; +1 only)
- `created_at`

#### `event_logs`
General analytics event stream.
- `id` (uuid, pk)
- `event_type` (text; `impression|click|upvote|downrank|report`)
- `entity_type` (text; `model|article|source|page`)
- `entity_id` (uuid or text)
- `visitor_identity_id` (uuid, nullable)
- `session_id` (text)
- `referrer` (text)
- `utm_json` (jsonb)
- `meta_json` (jsonb)
- `created_at` (timestamptz, indexed)

#### `daily_entity_metrics`
Pre-aggregated analytics for fast ranking.
- `id` (uuid, pk)
- `entity_type` (text)
- `entity_id` (uuid)
- `date` (date)
- `impressions` (int)
- `unique_views` (int)
- `clicks` (int)
- `upvotes` (int)
- `ctr` (numeric(6,4))
- `momentum` (numeric(8,4))
- `score` (numeric(10,4))

**Unique index:** `(entity_type, entity_id, date)`.

#### `abuse_flags`
- `id` (uuid, pk)
- `visitor_identity_id` (uuid)
- `flag_type` (text; `rate_limit|velocity|duplicate_pattern|bot_signature|ip_cluster`)
- `severity` (smallint 1-5)
- `evidence_json` (jsonb)
- `action_taken` (text; `none|throttled|shadow_banned|suspended`)
- `created_at`

---

## 6) API Endpoints (REST MVP)

Base path: `/api/v1`

### 6.1 Model Board
- `GET /models?sort=top|trending|new&provider=&category=&free=true&page=1`
  - Returns paginated models with score breakdown.
- `GET /models/:slug`
  - Returns model detail and recent trend sparkline values.
- `POST /models/:id/upvote`
  - Adds upvote; enforces identity + cooldown + anti-abuse checks.
- `GET /models/:id/stats?range=7d|30d`
  - Returns daily metrics for charting.

### 6.2 Articles
- `GET /articles/trending?range=24h|7d&topic=&source=&page=1`
- `GET /articles/:slug`
- `POST /articles/:id/upvote`
- `POST /articles/:id/click`
  - Called before outbound redirect (or server-side redirect endpoint).

### 6.3 Ingestion/Admin
- `POST /admin/sources`
- `POST /admin/ingest/run` (manual trigger)
- `POST /admin/articles/:id/moderate` (`hide|feature|flag_duplicate`)
- `POST /admin/models/:id/moderate` (`hide|feature|deprecate`)

### 6.4 Abuse & Integrity
- `POST /events/batch`
  - Ingest client-side events with signed token.
- `GET /admin/abuse/flags?status=open`
- `POST /admin/abuse/:flagId/action`

### Response Contract (baseline)
```json
{
  "data": {},
  "meta": {"page":1,"pageSize":20,"total":123},
  "error": null
}
```

---

## 7) Ranking Formulas

Goal: transparent, abuse-resistant, responsive to recency.

### 7.1 Model Board Score

For model `m` on day `d`:

- `U7` = unique upvoters in last 7 days
- `C7` = unique clicks in last 7 days
- `I7` = unique impressions in last 7 days
- `Vd` = upvotes in last 24h
- `Vprev` = upvotes in prior 24h window
- `Q` = optional editorial quality (0-1; default 0.5)

Derived:
- `CTR7 = C7 / max(I7,1)`
- `Momentum = (Vd - Vprev) / max(Vprev, 5)` (clamped -1 to +3)
- `Wilson = wilson_lower_bound(upvotes=U7, total=max(I7, U7+1), z=1.28)`

**Score (MVP):**

`ModelScore = 0.45*norm(log1p(U7)) + 0.20*norm(CTR7) + 0.25*norm(Momentum) + 0.10*Q`

For `Top` tab, replace Momentum weight with Wilson confidence:

`TopScore = 0.55*norm(log1p(U30)) + 0.25*Wilson + 0.10*norm(CTR30) + 0.10*Q`

### 7.2 Trending Article Score

Variables (last 48h window unless noted):
- `Clicks`, `UniqueClicks`, `Upvotes`, `Impressions`
- `AgeHours` since published
- `SourceTrust` from `article_sources.trust_tier` mapped to 0..1

Derived:
- `Engagement = (Upvotes*2 + UniqueClicks) / max(Impressions, 10)`
- `RecencyDecay = exp(-AgeHours / 18)`
- `Velocity = (Clicks_last_6h - Clicks_prev_6h) / max(Clicks_prev_6h, 5)` clamped -1..3

**Score (MVP):**

`ArticleScore = 0.35*norm(log1p(UniqueClicks)) + 0.30*norm(Engagement) + 0.20*norm(Velocity) + 0.10*RecencyDecay + 0.05*SourceTrust`

### 7.3 Abuse Penalty
Apply multiplier after raw score:
- `trust_score >= 80`: `x1.0`
- `60-79`: `x0.9`
- `40-59`: `x0.7`
- `<40`: `x0.4` or exclude from trending pending review.

---

## 8) Anti-Abuse Controls

### Identity & Rate Limiting
- Signed HTTP-only cookie + device fingerprint hash.
- IP hash + UA hash tracking (privacy-safe hashing).
- Upvote limit: max 30/day per identity, max 5/min burst.
- Click event limit: max 120/min per identity.

### Behavioral Detection
- Velocity anomalies (many votes in short windows).
- Correlated cluster detection (same IP subnet + user-agent + sequence patterns).
- Duplicate click loops on same article/model.
- Headless/browser automation signatures.

### Enforcement Ladder
1. Soft throttle (429 with cooldown).
2. Shadow counting (accept response, drop weight in ranking).
3. Temporary suspension of identity.
4. Source/content-level quarantine for suspicious ingestion.

### Moderation Tooling (MVP-light)
- Admin queue of flagged identities/events.
- One-click actions: `throttle`, `suspend`, `clear`.
- Manual override for model/article visibility.

---

## 9) Analytics & Instrumentation

### Events to Track
- Page impressions (`/models`, `/trending`, detail pages).
- Card impression position (for rank bias analysis).
- Upvote attempts + success/failure reason.
- Outbound click (article/model links).
- Filter/sort selections.

### KPIs (MVP)
- DAU/WAU to ranking pages.
- Upvote rate per unique visitor.
- CTR from ranking cards to outbound destinations.
- Repeat visitor rate (7-day).
- Abuse rate (% discarded events).

### Data Pipeline (MVP)
- Real-time write to `event_logs`.
- Hourly rollup job -> `daily_entity_metrics` (or hourly metrics table if needed).
- Rank recompute every 15 minutes (cron/worker).

---

## 10) MVP Delivery Plan (2 Weeks)

### Week 1
1. **Day 1-2:** DB schema + migrations + seed providers/sources/models.
2. **Day 2-3:** Public read APIs (`GET models`, `GET trending articles`).
3. **Day 3-4:** Upvote + click endpoints with basic rate limiting.
4. **Day 4-5:** Frontend pages `/models`, `/trending` with cards/tables, sorting, filters.

### Week 2
5. **Day 6-7:** Event tracking + metrics rollup jobs + score computation.
6. **Day 8:** Anti-abuse heuristics (velocity + duplicates) + trust score penalties.
7. **Day 9:** Admin moderation screens (basic tables/actions).
8. **Day 10:** QA hardening, SEO metadata, analytics dashboard, launch checklist.

### MVP Success Criteria
- Users can upvote models/articles with abuse controls in place.
- Rankings update at least every 15 minutes.
- Trending page reliably reflects recency + engagement.
- Metrics available for impressions/clicks/upvotes by entity.

---

## 11) Roadmap (Post-MVP)

### Phase 2 (Weeks 3-6)
- User accounts + reputation-based vote weighting.
- Topic pages (`/trending/agents`, `/trending/open-source`, etc.).
- Better ingestion: dedupe via canonical URL + semantic similarity.
- Newsletter digest: “Top 10 models + 20 trending articles weekly.”

### Phase 3 (Weeks 7-12)
- Personalized ranking (interest vectors from clicks/upvotes).
- “Why ranked” explainability panel with score component transparency.
- Creator/source profiles and source-quality leaderboards.
- API keys for public ranking API consumers.

### Monetization Options
- Sponsored placements clearly labeled.
- Affiliate outbound link programs for tools/services.
- Premium tier: advanced filters, alerting, private watchlists.

---

## 12) Risks & Mitigations

- **Vote gaming / botting** → layered anti-abuse + trust-weight penalties.
- **Source quality drift** → trust tiers + moderation + duplicate suppression.
- **Cold start for rankings** → seed baseline quality scores + editorial curation for first week.
- **Legal/privacy concerns** → hash IP/UA, publish privacy policy, data retention limits.

---

## 13) Open Questions (Decide before implementation)

1. Is login required for upvote, or keep anonymous-first with fingerprint controls?
2. Which ingestion sources are first-party approved for Day 1?
3. Should “free model” include freemium APIs, or only fully free/open-source?
4. What level of ranking explainability is shown publicly at launch?

---

## 14) Recommended Default Decisions (to avoid blocking)

- Start **anonymous-first** with strict anti-abuse + optional login.
- Define “free” as usable without mandatory payment card; mark freemium separately.
- Ship explainability as high-level score components, not raw formula constants.
- Begin with 20-40 curated model entries + 15 trusted article sources.

---

## 15) Launch Checklist (MVP)

- [ ] Schema migrated and seeded.
- [ ] `/models` + `/trending` pages responsive and indexable.
- [ ] Upvote/click events captured with dedupe + rate limits.
- [ ] Ranking jobs scheduled and observed.
- [ ] Abuse flags visible in admin.
- [ ] Basic observability (error logs + endpoint latency + job health).
- [ ] Privacy terms updated for analytics tracking.

