/**
 * Job Queue Worker
 * 
 * Background worker process that consumes jobs from the queue and processes them.
 * This should be run as a separate process (e.g., Railway worker dyno).
 */

import { Worker, Job as BullJob } from 'bullmq';
import { handleJob } from './handlers';
import { getUpstashClient } from './client';
import type { JobPayload } from './types';

let worker: Worker | null = null;

/**
 * Start the job queue worker
 */
export function startWorker() {
  if (worker) {
    console.log('[Worker] Worker already running');
    return worker;
  }

  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  
  if (!redisUrl) {
    throw new Error('REDIS_URL or UPSTASH_REDIS_URL must be set for worker');
  }

  console.log('[Worker] Starting job queue worker...');

  worker = new Worker(
    'rare-agent-jobs',
    async (job: BullJob) => {
      const jobId = job.id || 'unknown';
      const jobData = job.data;
      const payload: JobPayload = jobData.payload;

      console.log(`[Worker] Processing job ${jobId} (${payload.type})`);

      try {
        // Update job status in Upstash
        const redis = getUpstashClient();
        await redis.hset(`job:${jobId}`, {
          status: 'processing',
          startedAt: new Date().toISOString(),
          attempts: job.attemptsMade + 1,
        });

        // Process the job
        const result = await handleJob(payload);

        // Update job status to completed
        await redis.hset(`job:${jobId}`, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          result: JSON.stringify(result),
        });

        // Move from pending to completed set
        await redis.zrem('jobs:pending', jobId);
        await redis.zadd('jobs:completed', { score: Date.now(), member: jobId });

        console.log(`[Worker] Job ${jobId} completed successfully`);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Worker] Job ${jobId} failed:`, errorMessage);

        // Update job status to failed or retrying
        const redis = getUpstashClient();
        const status = job.attemptsMade + 1 >= (job.opts.attempts || 3) ? 'failed' : 'retrying';
        
        await redis.hset(`job:${jobId}`, {
          status,
          error: errorMessage,
          updatedAt: new Date().toISOString(),
        });

        if (status === 'failed') {
          await redis.zrem('jobs:pending', jobId);
          await redis.zadd('jobs:failed', { score: Date.now(), member: jobId });
        }

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
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  console.log('[Worker] Worker started successfully');
  return worker;
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker() {
  if (!worker) {
    console.log('[Worker] No worker to stop');
    return;
  }

  console.log('[Worker] Stopping worker...');
  await worker.close();
  worker = null;
  console.log('[Worker] Worker stopped');
}

/**
 * Get worker instance
 */
export function getWorker() {
  return worker;
}

// Handle process signals for graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('[Worker] Received SIGTERM, shutting down gracefully...');
    await stopWorker();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[Worker] Received SIGINT, shutting down gracefully...');
    await stopWorker();
    process.exit(0);
  });
}

