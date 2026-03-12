# Job Queue Setup Guide

This document describes the async job queue system built with Upstash Redis and BullMQ.

## Architecture

The job queue system consists of:

1. **Queue Client** (`src/lib/queue/client.ts`) - Enqueues jobs for async processing
2. **Job Handlers** (`src/lib/queue/handlers.ts`) - Processes different job types
3. **Worker Process** (`scripts/worker.mjs`) - Background worker that consumes jobs
4. **API Endpoints** (`src/app/api/jobs/*`) - REST API for job management
5. **Database** - Supabase table for job persistence and audit trail

## Environment Variables

### Required

```bash
# Upstash Redis (for serverless/REST API)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Redis URL (for BullMQ worker)
REDIS_URL=redis://default:password@your-redis.upstash.io:6379
# OR
UPSTASH_REDIS_URL=rediss://default:password@your-redis.upstash.io:6379

# Supabase (for job persistence)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (for webhook processing)
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Optional

```bash
# Enable job queue for Stripe webhooks (default: false)
USE_JOB_QUEUE=true

# Worker configuration
WORKER_CONCURRENCY=5
WORKER_MAX_JOBS_PER_SECOND=10

# Service API key for /api/jobs endpoints
SERVICE_API_KEY=your-secret-key
```

## Setup Instructions

### 1. Create Upstash Redis Instance

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy the REST URL and token
4. Copy the Redis URL (for worker connection)
5. Add to your `.env.local` or Railway environment variables

### 2. Run Database Migration

```bash
# Apply the jobs table migration
npx supabase db push

# Or manually run the migration
psql $DATABASE_URL -f supabase/migrations/20260312_jobs_table.sql
```

### 3. Deploy Worker Process

#### Railway

1. Create a new service in your Railway project
2. Set the start command: `npm run worker`
3. Add all required environment variables
4. Deploy

#### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["npm", "run", "worker"]
```

#### Local Development

```bash
npm run worker
```

### 4. Enable Job Queue in Webhooks

Set environment variable:

```bash
USE_JOB_QUEUE=true
```

## API Endpoints

### POST /api/jobs

Create a new job.

**Authentication:** Service API key required

**Request:**
```json
{
  "payload": {
    "type": "stripe.subscription.created",
    "customerId": "cus_xxx",
    "subscriptionId": "sub_xxx",
    "customerEmail": "user@example.com",
    "tier": "pro"
  },
  "options": {
    "priority": "high",
    "maxAttempts": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "type": "stripe.subscription.created",
  "status": "pending"
}
```

### GET /api/jobs

List jobs with filtering.

**Query Parameters:**
- `status` - Filter by status (pending, completed, failed)
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "jobs": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET /api/jobs/[id]

Get job status and details.

**Response:**
```json
{
  "job": {
    "id": "uuid",
    "type": "stripe.subscription.created",
    "status": "completed",
    "priority": "high",
    "payload": {...},
    "result": {...},
    "attempts": 1,
    "createdAt": "2026-03-12T...",
    "completedAt": "2026-03-12T..."
  }
}
```

### DELETE /api/jobs/[id]

Cancel a pending job.

### GET /api/jobs/stats

Get queue statistics and health metrics.

## Job Types

See `src/lib/queue/types.ts` for all supported job types:

- `stripe.subscription.created`
- `stripe.subscription.updated`
- `stripe.subscription.deleted`
- `stripe.invoice.paid`
- `stripe.checkout.completed`
- `email.digest.send`
- `email.welcome.send`
- `email.report.deliver`
- `news.ingest.hot`
- `news.summary.generate`
- `report.generate`
- `analytics.track`

## Monitoring

Check worker logs:
```bash
railway logs --service worker
```

Check queue stats:
```bash
curl -H "x-api-key: $SERVICE_API_KEY" https://rareagent.work/api/jobs/stats
```

## Troubleshooting

### Jobs not processing

1. Check worker is running: `railway ps`
2. Check Redis connection: verify REDIS_URL is correct
3. Check worker logs for errors

### High failure rate

1. Check job handler implementation
2. Verify environment variables are set
3. Increase max_attempts if needed

### Memory issues

1. Reduce WORKER_CONCURRENCY
2. Enable job cleanup: run `SELECT public.cleanup_old_jobs()` periodically

