---
name: production-release-verifier
description: Verify a deployed web release end-to-end before or after production rollout. Use when checking that recent merges are live, pricing/offer changes landed correctly, core public routes and APIs respond, Playwright smoke tests pass against production, and Railway deployment state is healthy. Best for go/no-go checks and hotfix verification on Rare Agent Work or similar Next.js sites.
---

# Production Release Verifier

Use the bundled script first. It captures the release checks that matter most for this repo.

## Primary workflow

1. Run `scripts/run-prod-verification.sh <base-url>` from repo root.
2. Confirm recent git commits and latest Railway deploy look correct.
3. Confirm HTTP smoke for the canonical routes and public APIs.
4. Run Playwright against production.
5. Only run the broader Vitest suite when you want regression signal beyond production smoke.
6. Report GO/NO-GO with exact failing routes/specs if anything breaks.

## Commands

### Fast production verification
```bash
scripts/run-prod-verification.sh https://rareagent.work
```

### Include repo unit/integration tests too
```bash
RUN_UNIT=1 scripts/run-prod-verification.sh https://rareagent.work
```

### Alternate environment
```bash
PLAYWRIGHT_BASE_URL=https://staging.example.com scripts/run-prod-verification.sh
```

## What this verifies

- latest merged changes are visible in git history
- latest Railway deployment is healthy
- homepage, pricing, reports, news, digest, and auth routes return <400
- key public APIs return <400
- Playwright production smoke passes against the live site

## Interpretation

- If the script passes without `RUN_UNIT=1`, production smoke is green.
- If `RUN_UNIT=1` fails while production smoke passes, treat that as a repo regression to fix, not immediate proof that production is broken.
- If Playwright or HTTP smoke fails, treat release as NO-GO until fixed.

## Repo-specific notes

Current production smoke lives in `e2e/homepage.spec.ts`.
Keep that file aligned with the live offer model and canonical navigation.
