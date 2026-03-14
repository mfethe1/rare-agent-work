# Continuous Improvement Council — Rare Agent Work

This document turns synthetic critique into a standing product review system.

## Goal

Keep Rare Agent Work under pressure from multiple serious buyer and ecosystem viewpoints so the product does not plateau at "pretty good."

## Inputs

- Live product walkthrough of homepage, news, reports, pricing, submit-work, network, docs, llms.txt, and public API
- `src/synthetic-interviews/council-review-v2.md`
- `src/synthetic-interviews/continuous-improvement-council.json`

## Review cadence

- Re-run after any meaningful launch touching messaging, pricing, reports, APIs, trust surfaces, or onboarding
- Re-run at least once every two weeks during active product iteration
- Use the same dimensions so score changes are comparable over time

## Scoring rules

Each persona scores these dimensions from 1-10:

- clarity_of_value_prop
- trust_and_credibility
- proof_and_differentiation
- api_agent_usability
- report_depth
- news_quality
- conversion_friction
- enterprise_readiness
- operator_signal_density
- repeat_visit_reason

Interpretation:

- 1-3 = weak / confusing / not trusted
- 4-6 = promising but incomplete
- 7 = solid
- 8 = strong
- 9 = category-leading with evidence
- 10 = nearly unreachable; requires overwhelming proof

## Criticality ratchet

When the product improves, the panel should become more demanding.

- Do not let repeated 8s drift upward automatically.
- Once baseline problems are fixed, shift critique toward depth, proof, speed, elegance, and defensibility.
- The standard is not "better than before." The standard is "hard to dismiss by the best builders in the world."

## Current cross-persona verdict

The live product is promising, but the dominant criticism is consistent:

1. It sounds premium faster than it proves premium.
2. It is agent-friendly, but not yet best-in-class for agents.
3. It has high-trust positioning, but trust controls are not visible enough.
4. It has multiple revenue surfaces, but the compounding product loop is not legible enough.
5. It is useful to individuals, but not yet packaged strongly enough for consultants and enterprise buyers.

## Current top priorities

### P0

1. Proof layer on homepage and report pages
2. Clear routing for "where do I start?"
3. Better developer-facing API trust package
4. Trust-controls page for submit-work / consulting / network
5. Enterprise + consultant packaging

### P1

6. Sharper operator commentary in news
7. Better integration stories for agent users
8. Bundle pricing and lower-friction buying paths
9. Human attribution and methodology disclosure
10. Visible product flywheel explanation

## Definition of review-ready

Rare Agent Work is ready for Michael review when:

- The council artifacts are updated
- The top repeated criticisms are converted into a prioritized worklist
- At least the proof layer and routing layer are concretely addressed in product copy, docs, or structure
- The next iteration plan is explicit

## Notes for future runs

- Avoid generic positive personas. Use buyers with taste and alternatives.
- Include at least 3 API/agent-native perspectives every run.
- Include at least 3 prominent-figure-inspired critiques every run, but frame them as style-inspired, not impersonation.
- Preserve longitudinal scoring so improvements can be measured without lowering standards.

## 2026-03-13 20-loop implementation run

1. Added shared proof/routing/trust copy primitives in `src/lib/site-copy.ts` so homepage, docs, pricing, and service pages stop inventing inconsistent language.
2. Reworked the homepage hero copy to state the real offer more plainly: research, public API surfaces, and human-reviewed service paths.
3. Added a homepage proof layer with counts for reports, API routes, trust-gated service paths, and machine-readable surfaces.
4. Added a homepage "choose the right first click" router to reduce start-path ambiguity across humans and agent users.
5. Added homepage trust-control and buyer-path sections so enterprise and consultant visitors see a visible operating model instead of premium-sounding claims.
6. Strengthened `/start-here` with proof stats and route cards so it actually behaves like an orientation layer.
7. Added integration-pattern content to `/start-here` to improve the workflow/embed story for agent consumers.
8. Improved `/reports` catalog copy and cards with methodology/proof framing and better "best for" guidance.
9. Expanded report metadata in `src/lib/reports.ts` with author, attribution, methodology, best-fit, and proof-point fields.
10. Reworked report pages to surface author attribution, methodology, proof points, and clearer package contents before purchase.
11. Added stronger buying paths on report pages: single report, pricing comparison, assessment, submit-work, and docs.
12. Updated report JSON-LD to expose author and modified date, improving human attribution and machine-readable provenance.
13. Added bundle and buyer-path framing to `/pricing`, including consultant and enterprise packaging instead of subscription-only framing.
14. Added a dedicated `/trust` page to make intake boundaries, review sequence, and per-surface controls explicit.
15. Extended `/submit-work` with a visible controls section and a direct link to the trust-controls page.
16. Hardened `ConsultingForm` with credential-removal and human-review confirmations plus clearer scoping guidance.
17. Expanded `/assessment` and `/network` with trust-control and package sections so service buyers can see how work routes.
18. Strengthened `/docs` with integration patterns and a public trust package so API consumers can validate the site faster.
19. Expanded public API responses and OpenAPI metadata with provenance, pricing/docs/trust links, and methodology caveats.
20. Updated the agent card, legacy manifest coverage tests, `llms.txt`, and news commentary framing so discovery surfaces better reflect the new critique-council standard.
