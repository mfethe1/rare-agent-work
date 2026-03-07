# Report Pipeline Critique + V2 Design

## Brutal critique of the proposed sequence
Proposed: implementation researcher -> use-case expert -> AI editor-in-chief -> final editor-in-chief + citation verifier.

### What is strong
- Clear role specialization.
- Editorial quality gate before publish.
- Citation verifier is absolutely mandatory.

### What will fail without added controls
1. **No explicit evidence schema**
   - If stages pass prose only, hallucinations get laundered into polished copy.
2. **No independent adversarial gate until too late**
   - Critique should happen before final packaging, not only at the end.
3. **No pricing/value rubric**
   - “Worth the price” needs measurable criteria (novelty, actionability, reproducibility, confidence).
4. **No reject reasons taxonomy**
   - Teams repeat mistakes without structured rejection data.
5. **No citation extraction constraints**
   - Every claim needs machine-checkable citation IDs, not free-text references.

## V2 Pipeline (recommended)
1. **Scope Architect**
   - Defines report question, audience, expected outcome, and pricing tier target.
2. **Evidence Researcher (agentic implementation researcher)**
   - Collects raw evidence with claim-level source mapping.
3. **Use-Case Expert**
   - Converts evidence into operational recommendations and implementation paths.
4. **Adversarial Reviewer (brutal value critic)**
   - Scores against paid-value rubric; can hard reject for weak novelty/actionability.
5. **Citation Verifier (hard gate)**
   - Verifies every claim has valid source support; blocks unverifiable claims.
6. **Editor-in-Chief**
   - Produces coherent final narrative only after all gate passes.
7. **Owner Review (Michael only)**
   - Required for publish: approved_by + timestamp.

## Required hard gates
- **Gate A: Recency policy** (for fast-moving domains)
- **Gate B: Evidence coverage** (>=95% substantive claims cited)
- **Gate C: Citation verification pass** (100% for critical claims)
- **Gate D: Value score threshold** (e.g., >=80/100)
- **Gate E: Owner approval** (michael.fethe@protelynx.ai)

## Value rubric (for price-worthiness)
- Novel insight: 0-25
- Actionability (next 7 days): 0-25
- Evidence depth/quality: 0-20
- Competitive differentiation: 0-15
- Clarity and executive usefulness: 0-15

Minimum publish recommendation: 80/100.

## Immediate implementation tasks
- Add structured stage outputs under `data/reports/pipeline/<report-id>/`.
- Add `citation_verification.json` with pass/fail per claim.
- Add `value_scorecard.json` and block publish below threshold.
- Add reject taxonomy logs for iterative improvement.
