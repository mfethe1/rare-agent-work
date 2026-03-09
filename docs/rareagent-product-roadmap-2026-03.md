# RareAgent.work — Product Roadmap (March 2026)

## Objective
Build Rare Agent Work into the most actionable agentic news product for operators:
1. **Faster signal capture** (hot news ingestion)
2. **Higher subscriber conversion** (clear pricing + value)
3. **Higher trust and retention** (context + implications + consulting path)

## Competitor scan (what they do well)

### 1) The Rundown AI
- Strength: Massive audience + concise daily brief + practical “how to use this” angle.
- Lesson for RareAgent: Keep every story tied to an operator action, not just headline recap.

### 2) The Neuron
- Strength: Strong personality + high posting cadence + recurring format.
- Lesson: Build recognizable voice and recurring sections users expect each day.

### 3) TLDR AI
- Strength: Minimal friction signup + crisp promise (“keep up in minutes”).
- Lesson: Front-load value proposition and reduce CTA confusion.

### 4) Superhuman AI
- Strength: Fast digest format + broad trend coverage + growth loops.
- Lesson: Pair broad scans with user-specific interpretation to avoid commoditized content.

## Strategic differentiation for RareAgent
1. **Context panel + chat copilot inside news page** (done)
2. **Operator implications block per story** (next)
3. **Credibility layer**: freshness timestamp + source trace + confidence
4. **Execution layer**: consulting funnel for teams that need implementation help

## Feature work requested by Michael

### A. Side-panel news chat for subscribers
- Status: implemented (`NewsContextPanel` + `ReportChat` on `/news`).
- Next: lock premium context depth behind subscription check.

### B. Pricing rework with $10 newsletter
- Status: implemented (`/pricing`, `Newsletter $10/mo`, CTA in nav).
- Next: pricing copy tests for conversion lift.

### C. Hot news updates as events land
- Status: implemented auto-ingest endpoint `POST /api/news/hot`.
- Ops needed: scheduler call every 10–15 min with `HOT_NEWS_API_KEY`.

### D. Consulting offer + email routing
- Status: implemented (`ConsultingForm` + `/api/consulting` to `Michael.fethe@protelynx.ai`).
- Ops needed: `RESEND_API_KEY` and domain sender setup.

## Expert PM breakdown (Google-style execution)

### Track 1 — Acquisition (Week 1)
- Single primary CTA above the fold
- Newsletter conversion A/B test (headline + proof points)
- Add social proof bar (“Trusted by operators at …”)
- KPI: Visitor → subscriber conversion rate

### Track 2 — Activation (Week 1-2)
- First-session onboarding: “Pick your focus” (models, tooling, infra, policy)
- Personalize news feed and chat starter prompts by selected focus
- KPI: First-session engagement depth (stories read, chat messages)

### Track 3 — Retention (Week 2)
- Daily “Hot 5” digest + weekly strategic recap
- Save/bookmark stories + “brief me on saved” assistant command
- KPI: D7 and D30 retention

### Track 4 — Monetization (Week 2-3)
- Newsletter ($10) as entry plan
- Add mid-tier for team workflows + alerting
- Consulting intake qualification + SLA response automation
- KPI: Free→Paid, Paid→Consulting conversion

### Track 5 — Trust & Quality (continuous)
- Story-level freshness + source confidence badges
- Duplicate suppression and low-signal filtering
- “Why this matters” summary QA rubric
- KPI: User-rated usefulness score

## Immediate next actions (48h)
1. Set env vars in production: `HOT_NEWS_API_KEY`, `RESEND_API_KEY`, `CONSULTING_FROM_EMAIL`.
2. Add scheduler job to call `/api/news/hot` every 15 minutes.
3. Gate premium chat depth to active subscribers.
4. Add analytics events for consulting submissions and news-chat usage.
5. Run smoke test: ingest -> news page freshness -> chat context -> subscription checkout -> consulting email.

## North-star metric
**Weekly Active Operators (WAO)** = users who consume >=3 stories and ask >=1 context question per week.

Secondary metrics:
- Subscriber conversion rate
- D7 retention
- Consulting leads/week
- Hot-news publish latency (source publish -> rareagent feed)
