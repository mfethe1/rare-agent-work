# Report Synthesis Pipeline — Rare Agent Work

## Current vs Proposed

The existing `research-pipeline.ts` has 5 stages. This proposal adds 2 critical missing stages
and strengthens the existing ones based on Michael's feedback.

### What's Missing in Current Pipeline
1. **No Competitive Scanner** — we don't check if free content covers the same ground
2. **No Devil's Advocate** — the value critic asks "is it worth the price" but nobody asks "is the thesis WRONG?"
3. **Researcher is single-pass** — first pass is always shallow; needs a broad→deep two-pass approach
4. **Citation Verifier runs last** — should run earlier (Stage 2) so bad sources don't waste downstream agents' time

## Proposed 7-Stage Pipeline (+ Owner Approval)

### Stage 1: Deep Researcher (2-pass)
- **Pass 1:** Broad scan — web search, arxiv, GitHub, official docs. Collect 30+ sources.
- **Pass 2:** Deep dive — read top 10 sources fully, extract specific data points, code examples, benchmark numbers.
- **Output:** Raw research document with all sources, quotes, and data points.
- **Hard rule:** Every factual claim must have a source URL attached.

### Stage 2: Citation Verifier (HARD GATE — moved up from Stage 5)
- **Job:** Verify every citation by fetching the source URL and confirming the claim exists.
- **Rules:**
  - PRIMARY sources only (papers, official docs, benchmark repos). Blog-citing-blog gets flagged.
  - Benchmark/data citations older than 90 days rejected unless marked "[Historical Context]".
  - Any claim that can't be verified → REJECTED. No exceptions.
  - Verify title, author, and key claim matches the source.
- **Output:** Verified research doc with citation status (✅ verified / ❌ rejected / ⚠️ historical).
- **Kill condition:** If >30% of citations fail verification, send back to Stage 1.

### Stage 3: Implementation Use Case Expert (existing Stage 2, unchanged)

### Stage 4: Competitive Scanner (NEW)
- **Job:** Search for free content covering the same topic.
- **Process:**
  - Search top 20 results for the report's core keywords.
  - Read top 5 free articles/guides on the same topic.
  - Score overlap: what % of our report's value is available for free?
- **Rules:**
  - If >70% overlap with free content → KILL the report or pivot angle.
  - If 40-70% overlap → must clearly identify unique value-add.
  - Document: "Free content covers X, we uniquely provide Y."

### Stage 5: Devil's Advocate (NEW)
- **Job:** Find reasons the report is wrong, overpriced, or worthless.
- **Rules:**
  - Must identify at least 3 serious flaws, blind spots, or weak arguments.
  - Challenge the core thesis: "Is this report's premise actually correct?"
  - Assess: "Would a senior engineer learn anything they couldn't find in 30 min of Googling?"
  - If can't find 3+ flaws, the critique isn't hard enough — try again.

### Stage 6: Editor in Chief (existing Stage 3, unchanged)

### Stage 7: Value Critic (existing Stage 4, unchanged)

### Stage 8: Owner Approval (Michael — Human Gate)
- Report appears in admin dashboard at `/review`.
- Only `michael.fethe@protelynx.ai` can approve/reject.

## Pipeline Error Handling
- Citation Verifier failure (>30% rejection) → restart from Stage 1
- Value Critic score < 7 → send back to Stage 3 with notes
- Max 2 revision cycles before human review of the topic itself

## Implementation Notes
- Stages map to `research-pipeline.ts` PipelineStage entries
- Each stage uses Anthropic API (claude-sonnet-4 for speed, opus-4 for value critic)
- Citation verifier uses `web_fetch` to confirm every URL
- Competitive scanner uses `web_search` for market comparison
