# rareagent.work SEO + Content Authority Plan (Agentic Systems)

## 0) Executive Objective
Establish **rareagent.work** as a top-tier authority on **agentic systems** by compounding:
1. technical SEO excellence,
2. a clear hub-and-spoke topical architecture,
3. intent-aligned keyword clusters,
4. strategic internal linking,
5. consistent publishing cadence, and
6. higher SERP click-through rates (CTR).

Primary 12‑month outcomes:
- Grow non-branded organic sessions month-over-month.
- Rank on page 1 for high-intent “agentic systems” commercial + thought-leadership terms.
- Build topical authority with deep supporting content and strong internal graph.
- Convert organic traffic into newsletter/demo/consulting leads.

---

## 1) Technical SEO Checklist (Next.js)

### 1.1 Indexation, crawlability, canonicalization
- [ ] Use **server-rendered metadata** via Next.js App Router `generateMetadata` for all indexable pages.
- [ ] Ensure one canonical URL per page (`alternates.canonical`).
- [ ] Force one site version (HTTPS + preferred host, e.g., `https://rareagent.work`).
- [ ] 301 redirect: non-www ↔ www (pick one), trailing slash policy, lowercase paths.
- [ ] Avoid indexing parameterized duplicates (`?utm=`, sort/filter pages unless intentionally indexable).
- [ ] Add `robots.txt` with explicit allow/disallow and sitemap reference.
- [ ] Add XML sitemap index + segmented sitemaps (`/sitemaps/articles.xml`, `/sitemaps/pages.xml`, `/sitemaps/topics.xml`).
- [ ] Return proper 404/410 for removed pages; avoid soft-404s.
- [ ] Use `noindex,follow` on thin utility pages (if any).

### 1.2 Structured data (JSON-LD)
- [ ] Sitewide: `Organization`, `WebSite` (+ SearchAction if on-site search exists).
- [ ] Article pages: `Article` / `BlogPosting`, `Author`, `datePublished`, `dateModified`, `image`.
- [ ] Hub pages: `CollectionPage` or `ItemList` with spokes.
- [ ] FAQ sections (only where visible and useful): `FAQPage` schema.
- [ ] Breadcrumbs: `BreadcrumbList` on all hierarchical pages.
- [ ] Validate with Rich Results Test and fix warnings.

### 1.3 Performance + Core Web Vitals
- [ ] Target CWV thresholds (mobile first): LCP < 2.5s, INP < 200ms, CLS < 0.1.
- [ ] Use Next.js `next/image`, responsive sizes, modern formats (AVIF/WebP).
- [ ] Prioritize hero content; limit JS on content pages.
- [ ] Use route segment-level code splitting; minimize client components.
- [ ] Optimize fonts (`next/font`), preconnect critical origins, avoid render-blocking CSS.
- [ ] CDN caching headers for static assets; short TTFB via edge/runtime tuning.
- [ ] Lazy-load non-critical embeds/components.

### 1.4 Content rendering and discovery
- [ ] Ensure content is present in initial HTML for key pages (SSR/SSG where appropriate).
- [ ] Keep clean semantic structure: one H1, logical H2/H3 hierarchy.
- [ ] Include descriptive alt text and captioning for diagrams/charts.
- [ ] Add author bylines + expertise credentials for trust.
- [ ] Add “last updated” dates for evergreen pieces.

### 1.5 International and duplicates (if applicable)
- [ ] If multiple locales are added, implement `hreflang` correctly.
- [ ] Avoid near-duplicate posts by consolidating into canonical pillars.

### 1.6 Monitoring and governance
- [ ] Google Search Console + Bing Webmaster set up and verified.
- [ ] GA4 configured with conversion events:
  - newsletter subscribe
  - contact/demo submit
  - CTA clicks
- [ ] Weekly crawl audit (Screaming Frog/Sitebulb equivalent).
- [ ] Monthly index coverage + CWV review.
- [ ] Broken link monitor + auto-report.

---

## 2) Information Architecture: Hub-and-Spoke for Agentic Systems Authority

### 2.1 IA principles
- 3-click discoverability to any strategic article.
- Every spoke links to a parent hub and 2–4 relevant sibling spokes.
- Every hub links to all spokes with clear progression (beginner → advanced → implementation).
- URL consistency: `/topics/<hub>/` and `/insights/<spoke-slug>/` (or equivalent).

### 2.2 Proposed hubs (core authority pillars)

1. **Agentic Systems Fundamentals** (Hub)
   - What are agentic systems
   - Agent architectures (single vs multi-agent)
   - Planning, memory, tools, feedback loops
   - Evaluation principles

2. **Production Agent Engineering** (Hub)
   - Reliability, guardrails, observability
   - Cost/performance optimization
   - Tooling and orchestration frameworks
   - Failure modes and mitigation

3. **Multi-Agent Workflows & Orchestration** (Hub)
   - Role-based agents and handoffs
   - Workflow graphs and state management
   - Human-in-the-loop governance
   - Coordination patterns and anti-patterns

4. **Agentic Systems for Business Outcomes** (Hub)
   - Use-case playbooks by function (ops, support, GTM, dev)
   - ROI models and implementation roadmaps
   - Buy vs build decisions
   - Change management and adoption

5. **Governance, Safety, and Compliance** (Hub)
   - Security threat model for agents
   - Data boundaries and policy controls
   - Auditability and incident response
   - Compliance mapping

### 2.3 Page templates
- **Hub template:**
  - Definition + scope
  - TL;DR framework diagram
  - Spoke directory grouped by stage/intent
  - “Start here” journey links
  - CTA: subscribe, consultation, implementation guide
- **Spoke template:**
  - Clear problem statement
  - Practical framework/checklist
  - Real-world example or benchmark
  - Internal links (hub + sibling + conversion page)
  - FAQ + next-step CTA

---

## 3) Keyword Cluster Strategy (Intent + Topic Depth)

> Focus on topical authority clusters around “agentic systems,” balancing TOFU/MOFU/BOFU.

### Cluster A: Definitions + Concepts (TOFU)
- what are agentic systems
- agentic ai vs ai agents
- agent architecture patterns
- single agent vs multi agent systems
- agent planning and memory explained
- agent feedback loops

Content types: explainer guides, diagrams, glossaries, “X vs Y.”

### Cluster B: Build + Implementation (MOFU)
- how to build agentic systems
- production-ready ai agents
- agent orchestration framework comparison
- agent observability best practices
- agent reliability engineering
- evaluation framework for ai agents

Content types: implementation checklists, architecture deep-dives, tool comparisons.

### Cluster C: Use Cases + ROI (MOFU/BOFU)
- agentic workflows for customer support
- ai agents for revenue operations
- multi-agent systems for software teams
- agent automation roi model
- enterprise agent adoption roadmap

Content types: playbooks, case-style walkthroughs, ROI calculators.

### Cluster D: Safety + Governance (MOFU)
- ai agent security risks
- governance framework for agentic systems
- compliant agent workflows
- human in the loop agent design
- agent audit logging best practices

Content types: risk matrices, policy templates, control frameworks.

### Cluster E: Comparative + Commercial Intent (BOFU)
- best agent orchestration platforms
- [tool A] vs [tool B] for multi-agent workflows
- custom agentic system consulting
- enterprise agent implementation partner

Content types: comparisons, decision guides, service pages, migration guides.

### Keyword prioritization model
Prioritize topics by weighted score:
- Business value / conversion proximity (35%)
- Topical authority fit (25%)
- Ranking feasibility / SERP competitiveness (20%)
- Demand trend velocity (10%)
- Content differentiation potential (10%)

---

## 4) Internal Linking Plan (Authority Flow)

### 4.1 Linking rules
- Each new spoke must include:
  - 1 link to parent hub (early in article)
  - 2–4 links to sibling spokes
  - 1 link to a BOFU page (service/playbook/contact)
- Each hub links to all active spokes in that cluster.
- Add “Related reading” blocks driven by semantic similarity.
- Maintain descriptive anchor text (avoid generic “click here”).

### 4.2 Link architecture map
- **Top-level nav** links to all hubs.
- **Homepage** links to each hub + 3 newest strategic spokes.
- **Hub pages** pass authority down to spoke nodes.
- **Spoke pages** pass relevance laterally (sibling links) and upward (hub link).
- **Conversion pages** receive links from high-traffic spokes.

### 4.3 Anchor strategy
Use mixed anchors:
- Exact/close match: “agent reliability engineering”
- Partial match: “improve reliability in production agents”
- Contextual action anchors: “use this agent evaluation checklist”

### 4.4 Link maintenance process
- Monthly internal link audit:
  - orphan pages = 0
  - pages with <2 internal inlinks flagged
  - broken links fixed within 7 days
- Refresh top 20 pages quarterly with new contextual links.

---

## 5) Publishing Cadence (90-Day Launch + Ongoing)

### 5.1 First 90 days (authority sprint)
- **Frequency:** 2 high-quality pieces/week (8/month)
- **Mix:**
  - 1 foundational/hub-support piece
  - 1 implementation/use-case/comparison piece
- **Output target:** 24 pieces in 90 days

Breakdown:
- Month 1: publish 5 cornerstone pages (hubs + flagship spokes)
- Month 2: fill priority keyword gaps (8 spokes)
- Month 3: publish BOFU comparisons + update initial winners (8–10 pieces including refreshes)

### 5.2 Ongoing cadence (months 4–12)
- 4–6 new pieces/month
- 4 refreshes/month (existing content updates)
- Quarterly “state of agentic systems” flagship report for backlinks + authority

### 5.3 Editorial workflow
1. Brief: target query, intent, SERP gap, outline
2. Draft: practical depth + examples + visuals
3. SEO QA: metadata, schema, links, headings
4. Publish: sitemap ping + social/email distribution
5. 30-day review: CTR, rankings, engagement, conversions
6. Optimize: title/meta intro/anchors based on data

---

## 6) CTR Optimization Framework (SERP Click Lift)

### 6.1 Title tag system
Use one of these formulas:
- **How-to + outcome:** “How to Build Agentic Systems That Don’t Break in Production (2026 Guide)”
- **Comparison + decision:** “[Tool A] vs [Tool B] for Multi-Agent Workflows: Which Scales Better?”
- **Checklist + specificity:** “Agent Reliability Checklist: 17 Controls for Production-Grade Systems”
- **Myth busting:** “Most Agentic Systems Fail Here — Fix These 5 Failure Modes”

Guidelines:
- 50–60 chars when possible
- primary keyword near start
- include specificity (year, number, framework)
- avoid clickbait; promise must match content

### 6.2 Meta description system
- 140–160 chars
- include pain point + value + CTA
- example: “Design reliable agentic workflows with this practical architecture, evaluation, and guardrail framework. Includes implementation checklist.”

### 6.3 Snippet enhancement
- Add concise definitions in first 120 words.
- Use list/table formats to increase featured snippet eligibility.
- Include FAQ blocks for long-tail query capture.

### 6.4 Experiment cadence
- Weekly: identify pages with high impressions + low CTR (GSC).
- A/B test title/meta variants every 14–21 days.
- Promote winning variants across similar page types.

CTR KPI targets:
- +1.5 to +3.0 percentage points on tested pages within 6 weeks.
- Top-10 ranking pages should exceed query-class benchmark CTR.

---

## 7) Content Quality Standards (Authority Signals)
- Publish opinionated frameworks, not generic summaries.
- Include original artifacts:
  - architecture diagrams
  - decision matrices
  - checklists/templates
  - benchmark mini-studies
- Demonstrate operational credibility (real constraints, tradeoffs, failure cases).
- Cite credible external sources and first-party experience.
- Keep every article mapped to one primary intent and one conversion CTA.

---

## 8) KPI Dashboard and Targets

### Traffic + visibility
- Non-branded organic clicks
- Impressions by cluster
- Share of voice for “agentic systems” topic set
- Number of top-3 / top-10 keyword rankings

### Engagement + conversion
- Organic conversion rate (newsletter/demo/contact)
- Assisted conversions from content pages
- Time on page / scroll depth for cornerstone content

### Technical health
- Indexed pages vs submitted pages
- CWV pass rate (mobile)
- Crawl errors, redirect chains, broken links

### Suggested milestones
- **90 days:** first top-10 cluster terms, positive non-branded trend
- **6 months:** multiple cluster pages in top 10; repeat organic conversions
- **12 months:** recognized topical authority; durable page-1 coverage in strategic clusters

---

## 9) 30-60-90 Day Action Plan

### Days 1–30
- Implement technical checklist baseline (robots/sitemaps/canonicals/schema/CWV quick wins).
- Publish hubs + 4 flagship spokes.
- Build internal link scaffolding and templates.
- Configure KPI dashboard + weekly reporting cadence.

### Days 31–60
- Publish 8 spoke articles across clusters B/C/D.
- Add comparison content for BOFU intent.
- Start CTR testing cycle on high-impression pages.
- First content refresh batch (top impressions, low CTR).

### Days 61–90
- Publish 8 more pieces, including conversion-oriented assets.
- Expand internal link depth and related-reading modules.
- Optimize underperforming pages via intent realignment.
- Release “state of agentic systems” linkable asset.

---

## 10) Implementation Notes for rareagent.work
- Keep the brand voice: authoritative, practical, systems-level.
- Treat each hub as a product surface (not just a blog category).
- Align CTA paths to service offerings (assessment, implementation, advisory).
- Maintain a living keyword/content map to avoid cannibalization.

---

## 11) Quick Start Backlog (First 12 Pieces)
1. What Are Agentic Systems? Architecture, Components, and Real-World Constraints
2. Agentic AI vs AI Agents: What Actually Matters in Production
3. Single-Agent vs Multi-Agent Systems: Decision Framework
4. How to Build Production-Ready Agentic Systems (Step-by-Step)
5. Agent Reliability Engineering: 17 Failure Modes and Mitigations
6. Agent Observability Stack: Metrics, Traces, and Evaluation Loops
7. Human-in-the-Loop Design for Agentic Workflows
8. Security Threat Model for Agentic Systems
9. Agentic Workflows for Customer Support: Playbook + KPI Model
10. Agentic Systems ROI Calculator: Estimating Business Impact
11. Best Agent Orchestration Platforms in 2026: Comparison Framework
12. Enterprise Agent Adoption Roadmap: 0→1→Scale

These 12 pieces establish breadth + depth + conversion paths quickly.
