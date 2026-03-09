# Rare Agent Work

Next.js app for rareagent.work.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Production verification

Fast production smoke against the live site:

```bash
npm run test:prod
```

Include repo unit/integration tests too:

```bash
RUN_UNIT=1 npm run test:prod
```

## Tracking + conversion setup

Set these env vars in `.env.local` and production:

- `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (required)
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_SUBSCRIBE` (optional)
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_REPORT` (optional)

Checkout conversion flow:

- Click CTA → `click_checkout` + `begin_checkout`
- Stripe success redirect includes `session_id`
- Success pages fire `purchase` event (GA4)
- If Ads conversion labels are set, success pages also fire `conversion`

## Stripe Webhooks

A webhook endpoint is configured at:

- `POST /api/stripe/webhook`

Supported events (current):

- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted`

### Environment Variables

Copy `.env.example` to `.env.local` and set:

```bash
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

### Local webhook testing

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Then trigger test events with Stripe CLI.

## Hot News Auto-Update

To ingest breaking AI news from curated feeds, use:

- `POST /api/news/hot`
- Header: `Authorization: Bearer <HOT_NEWS_API_KEY>`

Set env vars:

```bash
HOT_NEWS_API_KEY=...
INGEST_API_KEY=...
RESEND_API_KEY=...
CONSULTING_FROM_EMAIL="Rare Agent Work <hello@rareagent.work>"
```

Recommended scheduler: every 10–15 minutes.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
