# Job Queue System

Async job queue implementation using Upstash Redis and BullMQ for background processing.

## Quick Start

### Enqueue a Job

```typescript
import { enqueueJob } from '@/lib/queue';

// Enqueue a Stripe subscription job
const jobId = await enqueueJob({
  type: 'stripe.subscription.created',
  customerId: 'cus_xxx',
  subscriptionId: 'sub_xxx',
  customerEmail: 'user@example.com',
  tier: 'pro',
  priority: 'high',
}, {
  priority: 'high',
  maxAttempts: 3,
});

console.log('Job enqueued:', jobId);
```

### Check Job Status

```typescript
import { getJobStatus } from '@/lib/queue';

const job = await getJobStatus(jobId);
console.log('Job status:', job?.status);
console.log('Job result:', job?.result);
```

### Add a New Job Type

1. Add the job type to `types.ts`:

```typescript
export type JobType = 
  | 'your.new.job'
  | ...;

export interface YourNewJobPayload extends BaseJobPayload {
  type: 'your.new.job';
  yourData: string;
}
```

2. Add handler to `handlers.ts`:

```typescript
async function handleYourNewJob(payload: YourNewJobPayload) {
  // Your processing logic here
  console.log('Processing:', payload.yourData);
  return { success: true };
}

// Add to switch statement in handleJob()
case 'your.new.job':
  return handleYourNewJob(payload);
```

3. Enqueue the job:

```typescript
await enqueueJob({
  type: 'your.new.job',
  yourData: 'test',
  priority: 'normal',
});
```

## Architecture

```
┌─────────────────┐
│   Next.js App   │
│  (API Routes)   │
└────────┬────────┘
         │ enqueueJob()
         ▼
┌─────────────────┐
│  Upstash Redis  │
│   (Job Queue)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  BullMQ Worker  │
│  (Background)   │
└────────┬────────┘
         │ handleJob()
         ▼
┌─────────────────┐
│   Job Handler   │
│  (Processing)   │
└─────────────────┘
```

## Job Lifecycle

1. **Pending** - Job created and waiting in queue
2. **Processing** - Worker picked up the job
3. **Completed** - Job finished successfully
4. **Failed** - Job failed after max retries
5. **Retrying** - Job failed but will retry
6. **Cancelled** - Job was manually cancelled

## Best Practices

### Priority Levels

- **Critical** - Payment processing, security events
- **High** - User-facing operations, welcome emails
- **Normal** - Background tasks, analytics
- **Low** - Cleanup, maintenance tasks

### Error Handling

Jobs automatically retry on failure. Configure retry behavior:

```typescript
await enqueueJob(payload, {
  maxAttempts: 5,  // Retry up to 5 times
  priority: 'high',
});
```

### Scheduled Jobs

Delay job execution:

```typescript
await enqueueJob(payload, {
  scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
});
```

### Idempotency

Always design job handlers to be idempotent (safe to run multiple times):

```typescript
async function handleStripeSubscriptionUpdate(payload) {
  // Use upsert instead of insert
  await supabase.from('users').upsert({
    email: payload.customerEmail,
    tier: payload.tier,
  }, { onConflict: 'email' });
}
```

## Monitoring

### Check Queue Stats

```bash
curl -H "x-api-key: $SERVICE_API_KEY" \
  https://rareagent.work/api/jobs/stats
```

### List Recent Jobs

```bash
curl -H "x-api-key: $SERVICE_API_KEY" \
  "https://rareagent.work/api/jobs?status=failed&limit=10"
```

### Worker Logs

```bash
# Railway
railway logs --service worker

# Local
npm run worker
```

## Testing

```typescript
import { enqueueJob, getJobStatus } from '@/lib/queue';

// Test job creation
const jobId = await enqueueJob({
  type: 'analytics.track',
  event: 'test_event',
  properties: { test: true },
});

// Wait for processing
await new Promise(resolve => setTimeout(resolve, 2000));

// Check result
const job = await getJobStatus(jobId);
expect(job?.status).toBe('completed');
```

## Troubleshooting

### Jobs stuck in pending

- Check worker is running: `railway ps`
- Verify Redis connection
- Check worker logs for errors

### High memory usage

- Reduce `WORKER_CONCURRENCY`
- Enable job cleanup
- Check for memory leaks in handlers

### Jobs failing repeatedly

- Check handler implementation
- Verify environment variables
- Review error logs
- Increase `maxAttempts` if transient failures

