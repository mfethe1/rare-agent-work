/**
 * Job Queue Client
 * 
 * Provides a unified interface for enqueuing jobs using Upstash Redis.
 * Supports both serverless (Upstash REST) and traditional Redis connections.
 */

import { Redis } from '@upstash/redis';
import { Queue } from 'bullmq';
import type { JobPayload, CreateJobOptions, Job, JobStatus } from './types';

// Singleton instances
let upstashClient: Redis | null = null;
let bullQueue: Queue | null = null;

/**
 * Get or create Upstash Redis client
 */
export function getUpstashClient(): Redis {
  if (upstashClient) return upstashClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
  }

  upstashClient = new Redis({ url, token });
  return upstashClient;
}

/**
 * Get or create BullMQ queue instance
 */
export function getBullQueue(): Queue {
  if (bullQueue) return bullQueue;

  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  
  if (!redisUrl) {
    throw new Error('REDIS_URL or UPSTASH_REDIS_URL must be set for BullMQ');
  }

  bullQueue = new Queue('rare-agent-jobs', {
    connection: {
      url: redisUrl,
      maxRetriesPerRequest: null,
    },
  });

  return bullQueue;
}

/**
 * Enqueue a job for async processing
 */
export async function enqueueJob(
  payload: JobPayload,
  options: CreateJobOptions = {}
): Promise<string> {
  const {
    priority = 'normal',
    maxAttempts = 3,
    scheduledFor,
    metadata = {},
  } = options;

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  const job: Omit<Job, 'id'> = {
    type: payload.type,
    status: 'pending' as JobStatus,
    priority,
    payload,
    attempts: 0,
    maxAttempts,
    scheduledFor: scheduledFor?.toISOString(),
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Use BullMQ for job queue management
    const queue = getBullQueue();
    
    const bullPriority = {
      critical: 1,
      high: 2,
      normal: 3,
      low: 4,
    }[priority];

    await queue.add(
      payload.type,
      { ...job, id: jobId },
      {
        jobId,
        priority: bullPriority,
        attempts: maxAttempts,
        delay: scheduledFor ? scheduledFor.getTime() - Date.now() : undefined,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      }
    );

    // Also store in Upstash for quick lookups
    const redis = getUpstashClient();
    await redis.hset(`job:${jobId}`, job);
    await redis.zadd('jobs:pending', { score: Date.now(), member: jobId });
    await redis.expire(`job:${jobId}`, 60 * 60 * 24 * 7); // 7 days TTL

    console.log(`[Queue] Enqueued job ${jobId} (${payload.type}) with priority ${priority}`);
    return jobId;
  } catch (error) {
    console.error('[Queue] Failed to enqueue job:', error);
    throw error;
  }
}

/**
 * Get job status by ID
 */
export async function getJobStatus(jobId: string): Promise<Job | null> {
  try {
    const redis = getUpstashClient();
    const data = await redis.hgetall(`job:${jobId}`);
    
    if (!data || Object.keys(data).length === 0) {
      // Try to get from BullMQ
      const queue = getBullQueue();
      const bullJob = await queue.getJob(jobId);
      
      if (!bullJob) return null;
      
      return {
        id: jobId,
        type: bullJob.name as any,
        status: bullJob.finishedOn ? 'completed' : bullJob.failedReason ? 'failed' : 'processing',
        priority: 'normal',
        payload: bullJob.data.payload,
        result: bullJob.returnvalue,
        error: bullJob.failedReason,
        attempts: bullJob.attemptsMade,
        maxAttempts: bullJob.opts.attempts || 3,
        createdAt: new Date(bullJob.timestamp).toISOString(),
        updatedAt: new Date(bullJob.processedOn || bullJob.timestamp).toISOString(),
      } as Job;
    }
    
    return data as unknown as Job;
  } catch (error) {
    console.error('[Queue] Failed to get job status:', error);
    return null;
  }
}

