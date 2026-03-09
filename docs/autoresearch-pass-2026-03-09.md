# Autoresearch-Style Improvement Pass (2026-03-09)

Scope: short pass on homepage professionalism, newsletter/report delivery setup surfaces, and QA/reliability.

## What I changed (low-risk fixes shipped)

### P0 — Subscription entitlement correctness
1. **Fixed newsletter checkout tier mapping**
   - File: `src/app/api/stripe/checkout/route.ts`
   - Change: `newsletter` plan metadata tier changed from `starter` → `newsletter`.
   - Why: previous mapping risked over-granting Starter-tier access/budgets to newsletter subscribers.

2. **Added explicit newsletter token budget in webhook provisioning**
   - File: `src/app/api/stripe/webhook/route.ts`
   - Change: added `newsletter: 15_000` to `TIER_BUDGETS`.
   - Why: ensures deterministic post-checkout provisioning for newsletter users.

3. **Added newsletter tier limits in cost gate**
   - File: `src/lib/cost-gate.ts`
   - Change: added `newsletter` limits (`$6/week`, `$20/month`, `40/day`, `200/week`).
   - Why: prevents newsletter from falling back to free-tier defaults or inheriting unintended limits.

4. **Enabled newsletter users for chat model access**
   - File: `src/app/api/chat/route.ts`
   - Change: model tier allowlists now include `newsletter`.
   - Why: matches product promise of newsletter-side context/copilot access.

### P1 — Analytics/professionalism consistency
5. **Fixed subscription conversion value mismatch in account page**
   - File: `src/app/account/page.tsx`
   - Change: conversion value mapping corrected to `starter = 29`, `newsletter = 10`, `pro = 49`.
   - Why: previous mapping incorrectly tracked Starter as `$10`.

6. **Homepage copy cleanup for public professionalism**
   - File: `src/app/page.tsx`
   - Changes removed internal/team-specific phrasing in top-funnel sections:
     - “for people actually shipping agents” → “for teams shipping agents”
     - “A cleaner way for Michael to test…” → “A clearer way to evaluate the product in minutes”
     - internal references in test-path helper copy changed to visitor/customer language.

---

## Key findings (not all fixed in this pass)

### P0 — QA regression: unit tests for `/api/chat` are stale
- `npm run test` failed (`4 failed`) in `src/__tests__/chat-api.test.ts`.
- Failures indicate tests still target old auth behavior and outdated Anthropic mocking strategy (`is not a constructor`), while route now uses cookie/session + cost-gate + multi-provider streaming and returns `503` for missing provider key.
- Impact: CI confidence gap; real route behavior not covered by current tests.

### P0 — Production smoke e2e drift vs live site
- `npx playwright test e2e/homepage.spec.ts --project=chromium` failed 4 checks against `https://rareagent.work`:
  - missing expected `/start-here` nav and hero test IDs,
  - pricing assertion expects “Starter” but live page differs,
  - `/docs` returned `404` on live target.
- Impact: either deployment lag/drift from repo, or e2e assertions no longer aligned with production.

### P1 — Lint debt is high (21 errors)
- `npm run lint` fails with broad issues (link usage, purity rules, static component rules, etc.).
- Not all are release blockers (build still passes), but this weakens reliability and prevents lint-as-gate quality checks.

---

## Verification evidence

- `npm run build` ✅ passes after edits (Next.js 16.1.6 build successful).
- `npm run test` ❌ fails in `chat-api.test.ts` (4 failures; stale assumptions + Anthropic mock mismatch).
- `npm run lint` ❌ fails (21 errors, 5 warnings; pre-existing debt beyond this pass scope).
- `npx playwright test e2e/homepage.spec.ts --project=chromium` ❌ fails 4/11 against production base URL.

---

## Recommended next fixes (priority order)

1. **Rewrite `chat-api.test.ts` to current route contract** (cookie-based user resolution, cost-gate responses, provider-key behavior, constructor-compatible Anthropic mock).
2. **Split e2e into two suites**:
   - repo/local assertions (against local preview),
   - production smoke assertions (only invariants stable in prod).
3. **Address highest-signal lint failures in customer-critical paths** (`digest`, `reports/[slug]`, `account`, `models table`) and then enforce lint in CI.
4. **Document subscription tier matrix** (newsletter/starter/pro feature + budget + limits) to prevent future drift between pricing copy and backend entitlements.
