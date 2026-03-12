# Rare Agent Work Branch Audit — 2026-03-12

## What was cleaned up

- Ran `git remote prune origin` in the canonical repo clone.
- This removed a large set of stale remote-tracking refs, including old `pr/*` refs and retired feature branches that were no longer on GitHub.
- Result: the local repo now reflects the *actual* remaining remote branches instead of years of stale tracking noise.

## Current state

- **Open GitHub PRs:** none
- **Primary production branch:** `main`
- **Current production verification:** `main` was redeployed and smoke checks were updated to match the live IA.

## Remaining remote branches ahead of `main`

### 1) `autoresearch/rosie-mar9`
Ahead: 4 commits
Behind: 39 commits

Commits:
- `f5352ca` — setup autoresearch loop and initial fixes
- `508451f` — prefetch main navigation links
- `d5ded84` — auto-save research results before rebase
- `bc3621c` — interactive gated HTML reports

Assessment:
- **Potentially valuable**, especially the interactive HTML reports.
- **Not a clean merge-now candidate** in current form because it is significantly behind `main` and conflicts with current product structure.
- Recommended path: rebase onto `main` in a fresh integration branch and re-validate against current pricing / report architecture.

### 2) A2A / network stack branches
Branches:
- `feat/a2a-agent-card`
- `feat/a2a-api-routes`
- `feat/a2a-nats-client`
- `lenny/a2a-discovery`
- `lenny/a2a-network`
- `lenny/network-ui`
- `lenny/security-model`

Assessment:
- These form **one coherent feature set**, not seven independent merge units.
- They are all behind current `main` and should **not** be cherry-picked individually into production.
- Recommended path: create one integration branch from `main`, merge the full A2A stack there, fix conflicts once, then run a focused smoke/build pass.

### 3) `lenny/paywall-assistant`
Ahead: 1 commit
Behind: 47 commits

Commit:
- `f1f6b6f` — gate AI assistant behind auth and paid plans

Assessment:
- The **behavior already exists on `main`** (`src/app/api/chat/route.ts` and `src/components/ReportChat.tsx` already enforce paid-plan gating).
- This branch is best treated as **obsolete** and can be deleted once we confirm no one still references it.

### 4) `master`
Ahead: 3 commits
Behind: 104 commits

Assessment:
- Legacy branch.
- Not a merge target.
- Keep only if needed for historical reference; otherwise archive or delete after explicit confirmation.

## Merge-now recommendation

### Merge now
- **None** of the remaining ahead-of-main branches should be merged directly into `main` without a fresh integration pass.

### Safe to retire
- `lenny/paywall-assistant` (functionally superseded by `main`)
- stale local refs already pruned

### Needs integration branch, not direct merge
- full A2A/network stack
- `autoresearch/rosie-mar9`

## Process changes to reduce sprawl going forward

1. **Single canonical ship branch:** `main`
2. **No long-lived feature branches without weekly rebase** onto `main`
3. **No `pr/*` local tracking refs** kept around after merge/close
4. **Delete superseded remote branches** within 24h of successful merge
5. **One integration branch per feature cluster** (example: the A2A stack), not many micro-branches lingering independently
6. **Production smoke tests must track live IA** whenever homepage/pricing/navigation changes

## Suggested next cleanup actions

1. Delete obsolete remote branch `lenny/paywall-assistant`
2. Decide whether `master` should be archived or removed
3. Open one fresh integration branch for the A2A/network stack
4. Rebase `autoresearch/rosie-mar9` onto `main` only if the gated HTML reports still matter to roadmap
