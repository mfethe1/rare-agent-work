# RareAgent Intel Ingest + Deep Report System

## Objective
Build a single intelligence pipeline that continuously ingests high-signal AI information, then synthesizes robust 50–100 page reports with strict citation and value gates.

## Source Lanes
1. Social signals
   - X/Twitter scraping (accounts, keywords, threads)
   - Reddit scraping (target subreddits + intent clusters)
   - Community forums (HF, OpenAI/Anthropic communities, key niche forums)
2. Research signals
   - arXiv / paper announcements
   - Lab blogs + model release notes
   - Benchmark/result trackers
3. Video signals
   - YouTube channel ingest + transcript extraction + claim extraction
4. Web deep crawl
   - Firecrawl for deep multi-page extraction
   - Brave Search + Perplexity/OpenRouter search for discovery and synthesis

## Agent Pipeline (required)
1. Source Collector Agent
2. Relevance + Novelty Ranker Agent
3. Claim Extractor Agent
4. Citation Verifier Agent (hard gate)
5. Use-Case Expert Agent
6. Forecast Agent (2-week, 1-month, 2-month windows)
7. Brutal Value Critic Agent
8. Editor-in-Chief Agent
9. Owner Approval Gate (Michael only)

## Hard Gates
- Recency gate: source date <= 14 days for digest layer
- Evidence gate: claim-to-citation coverage >= 95%
- Citation gate: critical claims must verify at 100%
- Value gate: score >= 80/100 for paid report
- Approval gate: owner approved before publish

## Deliverables per report run
- `raw_sources.jsonl`
- `normalized_claims.json`
- `citation_verification.json`
- `use_case_matrix.json`
- `forecast_2w_2m.json`
- `value_scorecard.json`
- `report_draft.md`
- `owner_review_packet.md`

## Cadence
- Daily ingest refresh (all source lanes)
- 3x weekly synthesis brief
- Weekly deep report draft
- Owner review + publish window after pass of all gates
