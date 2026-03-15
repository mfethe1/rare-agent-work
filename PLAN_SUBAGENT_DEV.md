# RareAgent.work — Next Phase Execution Packet

_Last verified: 2026-03-11_

## Executive summary

The app is in a solid scaffold state, not a finished commercial launch state.

**Verified working now**
- `npm run build` passes.
- `npm run news:test` passes.
- These routes exist and build: `/`, `/news`, `/free-summary`, `/models`, `/reports/[slug]`, `/admin/review`, `/signup`, `/agentic-framework`, `/api/reports/review`, `/api/signup`.

**Highest-priority gap**
The new Taviliy/agentic offering is marketed on-site, but the revenue path is still broken:
- CTA points to `/api/payments/checkout`, which does not exist.
- “Download architecture brief” points to `/docs/taviliy-agentic-framework.pdf`, which does not exist.
- benchmark/results data is placeholder-only.
- promised scripts `taviliy:seed` and `taviliy:loop` do not exist.

That means the next phase should be: **convert the Taviliy offering from marketing scaffold to minimally sellable + demonstrable product surface**.

---

## 1) Verified implementation state

### A. Core app state
- Next.js app-router app compiles successfully in production mode.
- Home page is a route hub, but it does **not** currently link to `/agentic-framework`.
- There is no shared header/footer/navigation shell in `layout.tsx`; pages render standalone.

### B. Content surfaces that exist
- `/news` uses `getFreshNews(14)` from `src/lib/content.ts`.
- `/free-summary` derives from fresh news.
- `/models` renders rankings from `data/models/models.json`.
- `/reports/[slug]` renders configured report slugs from `data/reports/reports.json`.
- `/admin/review` is owner-gated via `x-user-email` + `OWNER_EMAILS`.
- `/api/reports/review` supports `approve`, `reject`, `publish` with approval gate enforcement.
- `/signup` and `/api/signup` exist as a scaffold.
- `/agentic-framework` exists and reads benchmark seed rows from `data/research/taviliy-benchmarks.json`.

### C. News automation state
Implemented and working:
- `scripts/news-refresh.mjs`
- `scripts/news-update.mjs`
- `scripts/news-verify.mjs`
- `npm run news:test` passes on current dataset.

### D. Taviliy/agentic state
Partially implemented:
- `src/lib/taviliy.ts` exists.
- `data/research/taviliy-benchmarks.json` exists with 10 seeded queries.
- `data/metrics/cost-ledger.json` exists but is empty.
- `data/metrics/search-trends.json` exists but is unpopulated.
- `data/customers/subscriptions.json` exists but is unused by current routes.

Not implemented:
- `/api/payments/checkout`
- `/api/payments/webhook`
- `/api/agentic/search`
- `/agentic-framework/results`
- `scripts/taviliy-seed.mjs`
- `scripts/taviliy-loop.mjs`
- `scripts/taviliy-ingest.mjs`
- benchmark example artifact directories under `data/research/examples/*`
- real subscription persistence flow
- real cost logging / caching / hash-based reuse

---

## 2) Gap audit: README/docs vs real implementation

## 2.1 Revenue CTA is broken
**Doc promise**
- README and `docs/taviliy-agentic-framework.md` position Stripe checkout as the new offering path.

**Actual state**
- `src/app/agentic-framework/page.tsx` links to `/api/payments/checkout`.
- That route does not exist.

**Impact**
- Primary conversion path hard-fails.

**Files involved**
- `src/app/agentic-framework/page.tsx`
- `src/app/api/payments/checkout/route.ts` **(new)**
- `src/app/api/payments/webhook/route.ts` **(new)**

## 2.2 Architecture brief link is broken
**Actual state**
- CTA points to `/docs/taviliy-agentic-framework.pdf`.
- Only `public/docs/taviliy-agentic-framework.md` exists, not the PDF.

**Impact**
- Secondary CTA 404s.

**Files involved**
- `src/app/agentic-framework/page.tsx`
- `public/docs/taviliy-agentic-framework.pdf` **(new asset)** or change link target to existing markdown/doc route

## 2.3 Missing scripts promised in README
**Doc promise**
- `npm run taviliy:seed`
- `npm run taviliy:loop`

**Actual state**
- `package.json` has no such scripts.
- Running `npm run taviliy:seed` fails with “Missing script”.

**Files involved**
- `package.json`
- `scripts/taviliy-seed.mjs` **(new)**
- `scripts/taviliy-loop.mjs` **(new)**
- optionally `scripts/taviliy-ingest.mjs` **(new)**

## 2.4 Benchmark section is present but not credible yet
**Actual state**
- `/agentic-framework` renders a benchmark table.
- All 10 entries in `data/research/taviliy-benchmarks.json` are `pending` with null scores.
- No before/after artifacts exist.

**Impact**
- Sales proof is incomplete.

**Files involved**
- `data/research/taviliy-benchmarks.json`
- `data/research/examples/*` **(new generated content)**
- `src/app/agentic-framework/results/page.tsx` **(new)**
- `src/app/agentic-framework/page.tsx`

## 2.5 Taviliy client is too thin for production claims
**Docs promise**
- retries/backoff
- request metrics logging
- cache + cost controls

**Actual state**
- `src/lib/taviliy.ts` only does a direct fetch + returns JSON.
- no retry/backoff
- no query hashing
- no cache file writes
- no cost ledger writes
- no trend tracking writes
- no typed normalization beyond minimal result typing

**Files involved**
- `src/lib/taviliy.ts`
- `data/search-cache/` **(new dir)**
- `data/metrics/cost-ledger.json`
- `data/metrics/search-trends.json`

## 2.6 Navigation gap
**Docs promise**
- update header + footer to link new page

**Actual state**
- `src/app/layout.tsx` has no shared navigation/footer.
- home page cards do not include `/agentic-framework`.

**Impact**
- new offering is discoverable only if someone knows the route.

**Files involved**
- `src/app/layout.tsx`
- `src/app/page.tsx`

## 2.7 Signup/subscription data model is inconsistent
**Actual state**
- README says signup stores to `data/reports/subscribers.json`.
- `/api/signup` writes to `data/reports/subscribers.json`.
- Product docs say subscription state should live in `data/customers/subscriptions.json`.
- `data/customers/subscriptions.json` exists but is unused.

**Impact**
- two separate customer stores are implied.
- next payment work will drift unless unified first.

**Files involved**
- `src/app/api/signup/route.ts`
- `README.md`
- `docs/taviliy-agentic-framework.md`
- `data/customers/subscriptions.json`
- optionally `src/lib/customers.ts` **(new)**

## 2.8 Missing managed job queue/API surface
**Docs promise**
- managed job queue
- `/api/agentic/search`

**Actual state**
- marketing copy claims the capability, but no route or queue implementation exists.

**Files involved**
- `src/app/api/agentic/search/route.ts` **(new)**
- `data/jobs/` **(new)** or equivalent queue backing store
- `src/lib/taviliy.ts`

---

## 3) Exact files to edit next

## P0 — Must ship before public launch claim

### 1. `src/app/agentic-framework/page.tsx`
Edit to:
- replace broken checkout CTA behavior with real POST/redirect flow
- replace broken PDF link with working asset/route
- add explicit “results” link to future `/agentic-framework/results`
- add status messaging if benchmarks are still pending

### 2. `src/app/api/payments/checkout/route.ts` **new**
Create to:
- instantiate Stripe
- create Checkout Session from `STRIPE_PRICE_ID`
- redirect user to hosted checkout URL
- include success/cancel URLs
- write provisional customer/subscription intent record

### 3. `src/app/api/payments/webhook/route.ts` **new**
Create to:
- verify `STRIPE_WEBHOOK_SECRET`
- handle `checkout.session.completed`
- handle subscription lifecycle events
- persist state to `data/customers/subscriptions.json`

### 4. `src/app/layout.tsx`
Edit to:
- add persistent header nav
- link `/agentic-framework`
- optionally add footer docs link and signup link

### 5. `src/app/page.tsx`
Edit to:
- add `/agentic-framework` card on homepage
- position it as primary offer or featured launch card

### 6. `public/docs/taviliy-agentic-framework.pdf` **new asset**
Either:
- generate and ship the real PDF, or
- change page link to `/docs/taviliy-agentic-framework.md` if PDF is not ready

### 7. `src/app/api/signup/route.ts`
Edit to:
- stop writing to `data/reports/subscribers.json`
- write to a unified customer/subscription store or a clearly named lead file
- ideally move persistence to `data/customers/subscriptions.json` or `data/customers/leads.json`

## P1 — Must ship for believable product proof

### 8. `package.json`
Add scripts:
- `taviliy:seed`
- `taviliy:loop`
- optionally `taviliy:ingest`

### 9. `scripts/taviliy-seed.mjs` **new**
Create to:
- run 10 canonical queries
- store normalized raw results
- initialize benchmark rows with timestamps and source stats

### 10. `scripts/taviliy-loop.mjs` **new**
Create to:
- read cached queries
- run improvement loop
- score raw vs improved output
- write `data/research/taviliy-benchmarks.json`
- emit example artifacts under `data/research/examples/<slug>/`

### 11. `src/lib/taviliy.ts`
Expand to include:
- retries/backoff
- query hash generation
- 24h cache reads/writes
- request metrics logging
- cost ledger append helper
- optional search trend aggregation hooks

### 12. `src/app/agentic-framework/results/page.tsx` **new**
Create to:
- summarize aggregate improvement across the 10 benchmarks
- list examples with before/after links
- show completion count and average delta

### 13. `data/research/examples/` **new generated tree**
Generate per query:
- `raw.md`
- `improved.md`
- `metadata.json`

## P2 — Needed to match architecture doc claims

### 14. `src/app/api/agentic/search/route.ts` **new**
Create to:
- accept query submissions
- call cached Taviliy search pipeline
- return job/request id + results or queued state

### 15. `data/search-cache/` **new**
Use for:
- normalized cached search results keyed by query hash

### 16. `data/metrics/cost-ledger.json`
Populate with entries from Taviliy + model calls.

### 17. `data/metrics/search-trends.json`
Populate from query frequencies and recent search activity.

### 18. `README.md`
Update so commands/routes/storage claims match reality.

### 19. `docs/taviliy-agentic-framework.md`
Update once implementation is real, especially:
- checkout status
- storage path
- results page status
- job queue status

---

## 4) Recommended implementation order

## Phase 1 — Unbreak the commercial path
1. Build `/api/payments/checkout`
2. Build `/api/payments/webhook`
3. unify customer/subscription persistence
4. fix `/agentic-framework` CTA + docs asset link
5. add nav/home discoverability

**Outcome:** user can land on the offer and complete test checkout without dead links.

## Phase 2 — Make the proof section real
6. add `taviliy:seed`
7. add `taviliy:loop`
8. upgrade `src/lib/taviliy.ts` with cache/ledger logging
9. generate real benchmark data + example artifacts
10. add `/agentic-framework/results`

**Outcome:** offering has measurable evidence, not placeholder claims.

## Phase 3 — Deliver the first API/job entry point
11. create `/api/agentic/search`
12. persist request/cached result records
13. optionally stub queue status + response schema

**Outcome:** product becomes usable beyond static marketing copy.

---

## 5) Concrete acceptance criteria for next phase

The next phase should not be considered shipped until all are true:

- [ ] `/agentic-framework` has no broken CTA links.
- [ ] Stripe checkout route works with test keys.
- [ ] Stripe webhook updates local subscription state.
- [ ] homepage and shared nav link to `/agentic-framework`.
- [ ] `npm run taviliy:seed` exists and completes.
- [ ] `npm run taviliy:loop` exists and writes benchmark deltas.
- [ ] `data/research/taviliy-benchmarks.json` contains non-null scores for all 10 starter queries.
- [ ] `/agentic-framework/results` exists and renders aggregate metrics.
- [ ] customer/subscription persistence uses one coherent data location.
- [ ] README command list and storage descriptions match actual behavior.

---

## 6) Deployment verification checklist

## A. Build and static verification
Run:
```bash
npm install
npm run build
npm run news:test
npm run taviliy:seed
npm run taviliy:loop
```

Verify:
- build succeeds
- no missing script errors
- benchmark JSON is populated
- example artifacts were written

## B. Route verification
Manually verify these paths:
- `/`
- `/news`
- `/free-summary`
- `/models`
- `/reports/empirical-architecture`
- `/admin/review`
- `/signup`
- `/agentic-framework`
- `/agentic-framework/results`

Confirm specifically:
- `/agentic-framework` CTA does not 404
- docs/brief link does not 404
- results page renders benchmark summary

## C. Payments verification
With Stripe test keys + Stripe CLI/webhook forwarding:
- hit `/api/payments/checkout`
- confirm redirect to Stripe hosted checkout
- complete test payment
- confirm webhook fires successfully
- confirm `data/customers/subscriptions.json` updates
- confirm success/cancel return URLs resolve cleanly

## D. Data verification
Check these files after a successful seed/loop/payment smoke test:
- `data/research/taviliy-benchmarks.json`
- `data/research/examples/*`
- `data/metrics/cost-ledger.json`
- `data/metrics/search-trends.json`
- `data/customers/subscriptions.json`

Expected:
- benchmark rows have timestamps/scores/status
- examples directory contains before/after artifacts
- cost ledger has appended rows
- search trends is no longer empty
- subscription file has at least one test customer state entry

## E. Regression verification
Re-run:
```bash
npm run build
npm run news:test
```

Then verify existing routes still work:
- report review page still owner-gated
- `/api/reports/review` still enforces approve-before-publish
- signup flow still records a lead/customer without errors

---

## 7) Specific implementation notes for the next developer pass

### Payments
- Since `stripe` is already installed in `package.json`, implement routes instead of delaying on dependencies.
- Prefer hosted checkout first; billing portal can wait.
- Keep persistence file-based for now, but centralize it.

### Taviliy client
- Add a helper like `getQueryHash(query, params)`.
- Cache files under `data/search-cache/<hash>.json`.
- Write a ledger row on both cache hit and API call, with `cached_hit: true|false`.
- Keep the API client server-only.

### Benchmarking
- Do not leave all rows pending after ship.
- Even if the full multi-agent loop is not complete, seed at least one end-to-end benchmark path and render aggregate counts honestly.
- If only some benchmarks are ready, UI copy should say “X of 10 complete” without implying full proof is done.

### UX integrity
- Broken links are worse than hidden features.
- If a PDF is not ready, link to the markdown doc or a rendered page.
- If checkout is not ready, swap CTA text to waitlist/signup until route exists.

---

## 8) Recommended minimal PR scope

If the goal is the fastest credible next shipment, the smallest high-value PR is:
1. add shared nav + homepage link to `/agentic-framework`
2. create working Stripe checkout + webhook routes
3. unify customer/subscription storage
4. fix broken docs link
5. add `taviliy:seed` + `taviliy:loop` scripts
6. populate benchmark JSON with real run output
7. add `/agentic-framework/results`
8. update README to match reality

That gets the site from **“demo scaffold”** to **“sellable beta with proof hooks.”**

---

## 9) Evidence captured during inspection

### Build
- `npm run build` completed successfully.

### News verification
- `npm run news:test` completed successfully:
  - `news:verify OK — 40 items, summary 8 items`

### Missing script proof
- `npm run taviliy:seed` failed because the script is not defined.

### Missing route/file proof
Not present in repo:
- `src/app/api/payments/checkout/route.ts`
- `src/app/api/payments/webhook/route.ts`
- `src/app/agentic-framework/results/page.tsx`
- `docs/taviliy-agentic-framework.pdf`

---

## Bottom line

**What exists:** strong scaffold, real content routes, working news pipeline, owner review gating, initial Taviliy landing page.

**What is missing for the next phase:** the actual monetization path, benchmark execution pipeline, proof/results route, and consistency between docs, storage, and live routes.

The next phase should focus on **closing the gap between sales copy and executable product behavior**.
