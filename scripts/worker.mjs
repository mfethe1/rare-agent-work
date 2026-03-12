#!/usr/bin/env node
/**
 * Job Queue Worker Process (ESM version)
 * 
 * Standalone worker process for processing background jobs.
 * This is the ESM version that can be run directly with Node.js.
 */

import { Worker } from 'bullmq';

console.log('='.repeat(60));
console.log('Rare Agent Work - Job Queue Worker');
console.log('='.repeat(60));
console.log('');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Redis URL:', process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || 'not set');
console.log('Concurrency:', process.env.WORKER_CONCURRENCY || '5');
console.log('Max jobs/sec:', process.env.WORKER_MAX_JOBS_PER_SECOND || '10');
console.log('');

// Validate required environment variables
const requiredEnvVars = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
if (!redisUrl) {
  console.error('ERROR: REDIS_URL or UPSTASH_REDIS_URL must be set');
  process.exit(1);
}

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('ERROR: Missing required environment variables:');
  missingVars.forEach((varName) => console.error(`  - ${varName}`));
  process.exit(1);
}

console.log('Starting worker...');
console.log('');

// Create worker
const worker = new Worker(
  'rare-agent-jobs',
  async (job) => {
    console.log(`[Worker] Processing job ${job.id} (${job.name})`);
    
    // Import handler dynamically to avoid circular dependencies
    const { handleJob } = await import('../src/lib/queue/handlers.ts');
    const payload = job.data.payload;
    
    try {
      const result = await handleJob(payload);
      console.log(`[Worker] Job ${job.id} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed:`, error.message);
      throw error;
    }
  },
  {
    connection: {
      url: redisUrl,
      maxRetriesPerRequest: null,
    },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    limiter: {
      max: parseInt(process.env.WORKER_MAX_JOBS_PER_SECOND || '10', 10),
      duration: 1000,
    },
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] ✓ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] ✗ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

console.log('✓ Worker started successfully');
console.log('');
console.log('Press Ctrl+C to stop the worker gracefully');
console.log('');

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down worker...');
  await worker.close();
  console.log('Worker stopped');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

