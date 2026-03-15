# RareAgent.work Implementation Plan

## Planning Assumptions
- Keep RareAgent positioned as a **high-signal AI intelligence + vetted execution** product, not a broad marketplace.
- Preserve the stronger live-site homepage direction, but make the repo the source of truth so deployment gaps stop creating inconsistent messaging across routes.
- Prioritize routes and assets already in flight: home, news, models, reports, free summary, agentic framework, signup/review flows.
- Add a **tightly scoped `/submit-work` beta** as a lead capture + intake workflow for curated execution requests.

---

## 1) Homepage Copy Changes

### Current repo homepage problem
`src/app/page.tsx` is still a lightweight link hub with generic copy:
- “Fast AI intelligence, curated model rankings, and robust reports...”
- card grid only
- no differentiated positioning
- no proof points
- no clear conversion path
- no continuity with `/agentic-framework`

That structure undersells the product and likely explains why the live homepage feels stronger than the deployed route set.

### Homepage positioning recommendation
Make the homepage clearly answer:
1. **What RareAgent is** — a curated AI intelligence and execution layer.
2. **Who it is for** — founders, operators, product teams, and technical buyers.
3. **What outcomes it delivers** — faster decisions, vetted research, tracked experiments, and implementation support.
4. **What to do next** — read signals, evaluate frameworks, or submit a scoped work request.

### Recommended homepage message hierarchy

#### Hero
**H1:**
RareAgent turns AI noise into deployable intelligence.

**Subhead:**
Curated model rankings, fresh agentic research, premium reports, and a tightly managed execution queue for teams that need signal—not hype.

**Primary CTA:**
Submit work request

**Secondary CTA:**
Explore agentic framework

**Tertiary text/proof row:**
- 14-day freshness policy on news
- Human-reviewed premium reports
- Benchmarked agentic workflows
- Curated, not open-marketplace

### Supporting homepage sections

#### Section A — What you can do here
Three tiles:
- **Track the landscape** — News Digest + Free Summary
- **Compare the stack** — Model Rankings + Agentic Framework
- **Get help shipping** — Submit Work beta for scoped research/coding tasks

#### Section B — Why RareAgent is different
Short bullets:
- Freshness-gated intelligence
- Human review before premium publication
- Measured framework benchmarking
- Managed intake instead of anonymous gig marketplace dynamics

#### Section C — Featured assets
Promote the in-flight assets already present in repo:
- `/news`
- `/free-summary`
- `/models`
- `/reports/empirical-architecture`
- `/agentic-framework`

#### Section D — Submit Work beta teaser
A small conversion block:
- “Need a research sprint, implementation plan, or scoped build?”
- Explain that requests are reviewed manually during beta.
- Stress limited capacity and curated fit.

### Homepage copy implementation notes
- Replace the current plain card-hub with a **real landing page structure** while keeping route cards lower on the page.
- Add a visible CTA to `/submit-work` in hero and nav/card area.
- Reframe `/signup` as secondary; don’t let it be the main conversion path until payments/subscriptions are actually production-ready.
- Keep the tone premium, selective, and operational—not “AI for everyone.”

---

## 2) SEO Plan

### Primary SEO objective
Win search intent around:
- agentic frameworks
- model rankings / model comparisons
- AI research workflows
- curated AI news / summaries
- AI implementation / scoped execution support

### Technical SEO fixes first
1. **Upgrade root metadata in `src/app/layout.tsx`**
   - current title/description are too generic
   - add stronger title template and page-level metadata
2. **Add route-specific metadata** for:
   - `/`
   - `/models`
   - `/news`
   - `/free-summary`
   - `/reports/[slug]`
   - `/agentic-framework`
   - `/submit-work`
3. **Add OG/Twitter metadata** for social sharing.
4. **Add sitemap + robots** if missing.
5. **Canonical URLs** for core pages.
6. **Structured data**:
   - `WebSite` / `Organization` for homepage
   - `Article` for reports
   - `CollectionPage` for models/news
   - `Service` for `/submit-work`

### Content SEO priorities

#### Homepage keywords
Target naturally in copy:
- agentic AI research
- AI model rankings
- AI implementation support
- vetted AI reports
- curated AI intelligence

#### `/agentic-framework`
This is the strongest SEO wedge in current repo.
Expand it to target:
- agentic framework
- Taviliy research workflow
- multi-agent research pipeline
- AI benchmark workflow
- managed agentic execution

Add sections for:
- who it is for
- benchmark methodology
- expected outputs
- implementation examples

#### `/models`
Position as a regularly updated comparison destination:
- best AI models for coding
- model ranking intelligence
- context window / cost / latency comparisons

#### `/news` and `/free-summary`
Use freshness and editorial framing:
- AI news digest
- weekly AI summary
- curated AI developments

#### Reports
Each report page should target one strong long-tail phrase.
For `empirical-architecture`, make sure the slug/page copy clearly supports a searchable thesis.

### Internal linking plan
- Homepage links to all core surfaces.
- `/agentic-framework` links to `/submit-work` and relevant report(s).
- `/models` links to framework/report pages where model selection matters.
- Reports link back to models/framework pages.
- `/submit-work` links back to proof assets instead of existing as a dead-end form.

### Content publishing cadence
Keep it simple and realistic:
- News refresh: ongoing
- Free summary: at least weekly cadence perception
- Model rankings: timestamp every update
- Reports: publish only when quality bar is met
- Framework page: update benchmark/result stats as artifacts land

---

## 3) Route Ship List

This list separates **ship now**, **ship after polish**, and **do not expand yet**.

### A. Ship now / keep live
These already align to the product and/or repo reality:
- `/` — homepage, but needs copy/layout rewrite
- `/news` — keep
- `/free-summary` — keep
- `/models` — keep
- `/reports/empirical-architecture` — keep
- `/agentic-framework` — keep, but tighten positioning
- `/signup` — keep only as supporting infrastructure, not primary CTA
- `/admin/review` — internal workflow, not marketing surface

### B. Add next
- `/submit-work` — **highest-priority new route**
- Optional thank-you/success state:
  - `/submit-work/success`
  - or inline success component after form submission

### C. Backend/API routes to support next phase
- `POST /api/submit-work`
- optional admin-facing storage target (JSON for now, DB later)
- optional notification hook for reviewed submissions

### D. Do not expand yet
Avoid building these until core conversion + operations are stable:
- public freelancer marketplace
- open job board
- browse-all-experts directory
- customer dashboards with heavy auth complexity
- generalized payments catalog beyond current in-flight Stripe work

### Route rationale
The site should read as:
1. **discover signal** (`/`, `/news`, `/models`, `/reports`, `/agentic-framework`)
2. **trust proof** (benchmarks, freshness, reports, human review)
3. **request help** (`/submit-work`)

Not:
1. discover
2. sign up randomly
3. browse an unfinished marketplace

---

## 4) Information Architecture for `/submit-work` Beta

### Product role
`/submit-work` is not a marketplace listing page.
It is a **curated intake form** for a manually reviewed beta queue.

### Core goal
Convert serious visitors who already trust the site into qualified inbound work requests.

### Audience
- founders needing research or implementation support
- product/engineering teams wanting scoped agentic workflow help
- operators wanting benchmark-driven evaluation or rapid execution on a narrow problem

### Offer framing
“Submit a scoped request for research, implementation planning, or targeted build support. We review each request manually and only accept work that fits our current beta capacity.”

### Recommended page structure

#### Section 1 — Hero
- H1: Submit work
- Subhead: Request a scoped research or implementation sprint. We review every submission manually during beta.
- Supporting line: Best for discrete, high-value tasks—not ongoing marketplace browsing.

#### Section 2 — What we accept
Accepted request types:
- research briefs
- implementation plans
- workflow design
- targeted coding tasks
- benchmark or tooling evaluations

Not accepted (for beta clarity):
- indefinite staff augmentation
- “build my whole startup” requests
- commodity task dumping
- open-ended marketplace matching

#### Section 3 — Intake form fields
Minimum viable form:
- Name
- Email
- Company / team
- Request type (research / plan / build / evaluation)
- Problem statement
- Desired outcome
- Deliverable type
- Deadline / urgency
- Budget range (or “exploring fit”)
- Links / repo / docs
- Consent checkbox for manual review follow-up

### Recommended submission schema
```ts
{
  id,
  created_at,
  status: "new" | "reviewing" | "accepted" | "rejected" | "needs_clarification",
  name,
  email,
  company,
  request_type,
  problem_statement,
  desired_outcome,
  deliverable_type,
  deadline,
  budget_range,
  links: string[],
  notes
}
```

#### Section 4 — Beta expectations
Set expectations clearly:
- Manual review
- Limited beta capacity
- Response window target (e.g. 1–3 business days)
- Some requests will be declined if not a fit

#### Section 5 — Proof / trust block
Link to:
- `/agentic-framework`
- `/models`
- premium report sample
- free summary/news digest

This keeps `/submit-work` anchored in product proof rather than feeling like a detached lead form.

### IA decisions
- Put `/submit-work` in top nav and homepage hero.
- Do **not** expose public listings, profiles, bids, or matching flows.
- Do **not** promise instant execution.
- Do **not** require login for submission during beta.

### Operations recommendation
For beta, store submissions in a simple durable path first:
- `data/submissions/submit-work.json`
- or a small DB table if already available

Then add:
- admin review view later, only if submission volume justifies it
- email/notification hooks after the intake is proven useful

---

## 5) Prioritized Backlog

### P0 — Must do next
1. **Rewrite homepage (`src/app/page.tsx`)**
   - Replace card hub with full landing page
   - Add stronger positioning, proof points, and CTA hierarchy
   - Add `/submit-work` CTA
2. **Create `/submit-work` page**
   - Static marketing + intake page first
   - Beta scope messaging
   - Form UI and success state
3. **Create `POST /api/submit-work`**
   - Persist submissions simply and safely
   - Validate required fields
4. **Tighten `/agentic-framework` positioning**
   - Reduce “managed job queue” language that implies a broad marketplace
   - Reframe as benchmarked framework + curated execution layer
5. **Improve metadata across core routes**
   - especially home, framework, models, reports, submit-work

### P1 — Important after core conversion path
6. **Add navigation/footer consistency across routes**
   - ensure homepage, framework, reports, and submit-work feel like one product
7. **Add sitemap/robots/canonical support**
8. **Add structured data** for homepage/reports/service
9. **Improve report page cross-linking**
   - reports → framework/models/submit-work
10. **Audit deployed routes vs repo routes**
   - confirm missing deploy gaps and fix route-level inconsistencies

### P2 — Valuable but not required for initial ship
11. **Benchmark/results section polish on `/agentic-framework`**
12. **Submission review dashboard** for `/submit-work` intake
13. **Email notification + follow-up automation** for accepted submissions
14. **Case study / proof pages** once first beta outcomes exist

### P3 — Explicitly deferred
15. **Open marketplace features**
16. **Public contributor/expert profiles**
17. **Complex customer dashboarding**
18. **Broad multi-tier pricing catalog** before the intake funnel converts

---

## 6) Suggested Execution Sequence

### Phase 1 — Align message and conversion
- Rewrite homepage
- Add `/submit-work`
- Add CTA links from homepage + framework page

### Phase 2 — Make it discoverable
- Route metadata
- sitemap/robots/canonical
- internal linking improvements

### Phase 3 — Strengthen proof
- tighten `/agentic-framework`
- improve benchmark/result presentation
- improve report interlinking

### Phase 4 — Operationalize beta intake
- submission persistence
- review workflow
- response templates / follow-up process

---

## 7) Recommended Product Narrative

RareAgent should present itself as:
- **an intelligence product first**,
- **a proof-backed framework layer second**,
- **a curated execution partner third**.

That means the core story is:
1. We track and structure the space.
2. We publish high-signal assets.
3. We selectively take on scoped work through `/submit-work`.

That is much stronger, more coherent, and far easier to ship than drifting into a thin, unfinished marketplace.
