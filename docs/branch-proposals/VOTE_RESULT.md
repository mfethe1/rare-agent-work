# Branch Vote Result (RareAgent)

## Candidates
- Setup A: minimal next+json
- Setup B: auth+owner-rbac first
- Setup C: research pipeline hard gates

## Scoring (1-10)
- Speed to value: A=9, B=6, C=5
- Revenue safety / trust: A=4, B=9, C=10
- Premium report quality: A=5, B=7, C=10
- Operational risk: A=6, B=8, C=7

## Winner
**Hybrid B + C**
- B first for immediate auth/login/forgot-password and owner control.
- C second for citation verifier + value scoring + editorial hard gates.

## Implementation order (approved)
1) Auth foundation (signup, login, forgot password, owner RBAC).
2) Report publish hard gate (must be owner-approved).
3) Citation verifier stage (claim-level evidence checks).
4) Brutal value critic stage (value-vs-price threshold).
5) Editor-in-chief finalization only after all passes.
