# Deployment Verification Checklist (Rare Agent Work)

_Last updated: 2026-03-08_

This checklist is for quick post-merge / post-deploy validation until a full CI pipeline is added.

## 1) Source + deployment target sanity

- Source branch for production source of truth is expected to be `main`:
  - `git fetch --all`
  - `git rev-parse origin/main` (record commit)
- Confirm deploy instructions are consistent in-repo:
  - `README.md` currently has outdated text mentioning Vercel.
  - Runtime headers currently indicate Railway; this mismatch should be resolved in follow-up.

## 2) Confirm production is serving the expected codebase

```bash
curl -sS -I https://rareagent.work | sed -n '1,25p'
```

Expected key signals from current production:
- `server: railway-edge`
- `x-railway-edge` header present
- `x-nextjs-cache` / `x-nextjs-prerender` headers

Quick content sanity (anchor-level, lightweight parity check):

```bash
curl -sS https://rareagent.work/ \
  | grep -Eo 'href="[^"]+"[^>]*>([^<]+)' \
  | grep -E '#catalog|#consulting|Browse reports|View Pricing' | sort -u
```

Current observed production values should match the current `main` branch page structure:
- `#catalog`
- `#consulting`
- `Browse reports`
- `View Pricing`

## 3) API smoke checks (must be reachable and return JSON)

```bash
curl -sS https://rareagent.work/api/v1/models | head -c 200
curl -sS https://rareagent.work/api/v1/reports | head -c 200
curl -sS https://rareagent.work/api/news?limit=1 | head -c 120
```

## 4) Functional smoke (critical paths)

- `GET /news` returns 200 and contains expected latest news cards.
- `GET /digest` returns 200.
- `GET /models` returns page (if model pages are enabled).
- `GET /reports/<known-slug>` returns 200 for one known slug from `/api/v1/reports`.

## 5) Gap to close (identified)

- There is no `.github/workflows` deploy workflow in-repo.
- No automated production smoke checks are currently wired into CI.
- README deployment note still references Vercel while runtime headers show Railway.

## 6) Minimal deploy artifact next-step

Before marking a release complete, add this checklist run as a required post-deploy step in the deployment pipeline.
