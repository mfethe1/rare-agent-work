# autoresearch

This is an experiment to have the LLM do its own research and optimization on the Rare Agent Work Next.js website and repository.

## Setup

To set up a new experiment:
1. **Agree on a run tag**: e.g., `autoresearch-mar9`.
2. **Create the branch**: `git checkout -b autoresearch/<tag>` from current main.
3. **Read the in-scope files**: Understand the Next.js app structure (`src/`, `package.json`, `next.config.ts`, `README.md`).
4. **Initialize results.tsv**: Create `results.tsv` with a header row and baseline entry. (e.g., `commit | build_time | bundle_size | status | description`).

## Experimentation

The goal is to autonomously improve the website. You can focus on:
- Improving SEO, meta tags, and accessibility (Lighthouse scores).
- Reducing Next.js bundle sizes or build times.
- Improving the UI/UX or fixing bugs.
- Enhancing test coverage (`vitest` or `playwright`).

**What you CAN do:**
- Modify any application code in `src/`, config files, or copy.
- Run `npm run lint`, `npm run build`, and `npm test` to validate changes.

**The metric:**
Since this is a web app, a successful change is one where `npm run build` succeeds, there are no linting errors, and you've demonstrably improved code quality, SEO, bundle size, or fixed a bug. If it fails to build, it's a regression.

## Output format & Logging

Log experiments to `results.tsv` (tab-separated):
```
commit	build_time	bundle_size_kb	status	description
```
Status should be `keep`, `discard`, or `crash`.

## The experiment loop

LOOP FOREVER:
1. Look at the git state.
2. Formulate an improvement hypothesis (e.g., "Add JSON-LD to reports page", "Optimize image loading in page.tsx", "Fix a linting warning").
3. Implement the change.
4. git commit.
5. Run the validation: `npm run lint && npm run build`. (Redirect output to `run.log`).
6. If the build crashes or fails lint, check `run.log`, attempt to fix once. If it still fails, `discard` (git reset) and log a crash.
7. If the build succeeds and the change is beneficial, `keep` (leave the commit).
8. Log the result to `results.tsv`.

**Timeout**: Each experiment loop should take ~2-5 minutes.
**Crashes**: If the app completely breaks, discard the commit (`git reset --hard HEAD~1`) and move on to the next idea.
**NEVER STOP**: Run this loop continuously until stopped by the user. Be autonomous. Keep finding new ways to improve the site.
