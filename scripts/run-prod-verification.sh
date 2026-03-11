#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PLAYWRIGHT_BASE_URL:-${1:-https://rareagent.work}}"
RUN_UNIT="${RUN_UNIT:-0}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

printf '\n== Rare Agent Work production verification ==\n'
printf 'Base URL: %s\n' "$BASE_URL"
printf 'Time: %s\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

printf '%s\n' '-- Recent git commits --'
git log --oneline -5 || true

if command -v railway >/dev/null 2>&1; then
  printf '\n%s\n' '-- Railway deployments --'
  railway deployment list | head -n 5 || true
fi

printf '\n%s\n' '-- HTTP smoke --'
for route in / /pricing /reports /news /digest /auth/login /api/v1/reports /api/v1/news /api/v1/news/health /api/v1/models; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL$route")"
  printf '%-20s %s\n' "$route" "$code"
  if [[ "$code" -ge 400 ]]; then
    echo "FAIL: $route returned HTTP $code"
    exit 1
  fi
done

printf '\n%s\n' '-- News freshness contract --'
news_health_status="$(curl -s -o /tmp/rare-agent-work-news-health.json -w '%{http_code}' "$BASE_URL/api/v1/news/health")"
printf 'news health status  %s\n' "$news_health_status"
cat /tmp/rare-agent-work-news-health.json
printf '\n'
if [[ "$news_health_status" -ge 400 ]]; then
  echo 'FAIL: news health endpoint reports stale feed or stale summary'
  exit 1
fi

printf '\n%s\n' '-- Playwright production smoke --'
PLAYWRIGHT_BASE_URL="$BASE_URL" npx playwright test e2e/homepage.spec.ts e2e/news-feed.spec.ts --reporter=line

if [[ "$RUN_UNIT" == "1" ]]; then
  printf '\n%s\n' '-- Vitest regression suite --'
  npm test
else
  printf '\n%s\n' '-- Vitest regression suite skipped --'
  printf 'Set RUN_UNIT=1 to include repo unit/integration tests.\n'
fi

printf '\n%s\n' 'GO/NO-GO: PASS'
