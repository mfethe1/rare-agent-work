# Daily AI News Summary Pipeline

This repo now includes a deterministic digest pipeline that can run on demand, daily, or every 3 hours.

## What it produces

Artifacts are written to:

- `data/digests/latest.json`
- `data/digests/latest.md`

Digest sections:

- TL;DR
- Top stories (with why-it-matters + action)
- Signal vs Noise
- Builder’s Corner
- Market & Policy
- Deep dive
- Tomorrow radar

Each story keeps:

- source link
- timestamp
- confidence label (`high` or `medium`)

## Seed recipients

Seed delivery list lives in `data/digest-recipients.json` and currently includes:

- `mfethe1@gmail.com`
- `protelynx@gmail.com`
- `Michael.fethe@protelynx.ai`

## Manual trigger

Generate digest artifact only:

```bash
npm run digest:daily
```

Generate + send email via Resend:

```bash
RESEND_API_KEY=... DIGEST_FROM_EMAIL="Rare Agent Work <hello@rareagent.work>" npm run digest:daily -- --send
```

Generate a shorter rolling window every 3 hours:

```bash
npm run digest:daily -- --window-hours 3
```

Generate + send a 3-hour rolling update:

```bash
RESEND_API_KEY=... DIGEST_FROM_EMAIL="Rare Agent Work <hello@rareagent.work>" npm run digest:daily -- --window-hours 3 --send
```

## API trigger

Protected endpoint:

- `POST /api/digest`

Auth:

- `Authorization: Bearer $DIGEST_API_KEY`
- falls back to `INGEST_API_KEY` if `DIGEST_API_KEY` is not set

Example:

```bash
curl -X POST https://rareagent.work/api/digest \
  -H "Authorization: Bearer $DIGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"windowHours":24,"send":true}'
```

Read latest artifact:

```bash
curl https://rareagent.work/api/digest
```

## Environment variables

Required for generation only:

- none beyond normal network access

Required for email sending:

- `RESEND_API_KEY`

Recommended sender config:

- `DIGEST_FROM_EMAIL="Rare Agent Work <hello@rareagent.work>"`

Optional auth config for API-triggered runs:

- `DIGEST_API_KEY`
- `INGEST_API_KEY` (fallback)

## Scheduler setup

### Daily morning send

Example cron (7:00 AM America/Indianapolis equivalent on the host):

```bash
0 7 * * * cd /path/to/rare-agent-work && RESEND_API_KEY=... DIGEST_FROM_EMAIL="Rare Agent Work <hello@rareagent.work>" npm run digest:daily -- --send >> /tmp/rare-agent-digest.log 2>&1
```

### Every 3 hours rolling update

```bash
0 */3 * * * cd /path/to/rare-agent-work && RESEND_API_KEY=... DIGEST_FROM_EMAIL="Rare Agent Work <hello@rareagent.work>" npm run digest:daily -- --window-hours 3 --send >> /tmp/rare-agent-digest.log 2>&1
```

## Verification checklist

1. `npm run digest:daily`
2. Confirm `data/digests/latest.json` exists.
3. Confirm `data/digests/latest.md` exists.
4. Open `data/digests/latest.md` and verify all digest sections are present.
5. Confirm the seed recipient list in `data/digest-recipients.json`.
6. If mail credentials are ready, run:
   ```bash
   RESEND_API_KEY=... DIGEST_FROM_EMAIL="Rare Agent Work <hello@rareagent.work>" npm run digest:daily -- --send
   ```
7. Confirm the command returns `"sent": true` in JSON output.
8. Check inboxes for the three seed addresses tomorrow morning.

## Notes

- If Resend is not configured tonight, artifact generation is still complete and deterministic.
- Email sending is intentionally explicit and can be turned on once sender-domain verification is confirmed.
- `GET /api/digest` now serves the latest generated artifact instead of trying to synthesize content at request time.
