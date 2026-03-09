# Report + Newsletter Premium Quality Guard

## Why this exists
A prior delivery shipped markdown-looking output and generic filler into a user-visible newsletter/report surface. This guard makes that regression harder.

## What is now enforced

### 1) Premium structure is required
All review-send payloads (reports + weekly newsletter) must include:
- Executive summary
- Implications
- Action steps
- Risks
- Evidence/citations
- Freshness timestamp

### 2) Anti-generic QA gate blocks sends
`runPremiumQualityChecks()` blocks send when any of these are true:
- markdown artifacts are present (`**`, backticks, heading markers, markdown links)
- placeholder text appears (`TODO`, `TBD`, `placeholder`, `lorem ipsum`, `[Synthesis unavailable]`)
- generic filler phrases appear (`in today's rapidly evolving`, `this comprehensive report`, etc.)
- too few citations (<2)
- missing/invalid freshness timestamp
- missing implications/action/risk sections

### 3) Markdown sanitization for delivery
`stripMarkdown()` is applied to report/newsletter copy before rendering HTML/text email payloads.

### 4) Newsletter rendering path exists
`src/lib/newsletter-delivery.ts` now builds a branded HTML newsletter payload from curated news items and can be sent from:
- `POST /api/reports/review-send` (owner-only)

This route now sends report packets **plus** the weekly newsletter preview in one review pass.

## Tests added
- `src/__tests__/premium-content.test.ts`
- `src/__tests__/delivery-rendering.test.ts`

These tests verify:
- markdown stripping and artifact detection
- anti-generic rules trigger correctly
- report/newsletter payloads render expected premium sections
- no markdown-looking artifacts in final HTML
