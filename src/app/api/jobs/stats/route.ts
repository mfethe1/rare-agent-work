/**
 * GET /api/jobs/stats - Get job queue statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUpstashClient, getBullQueue } from '@/lib/queue';
import { safeErrorBody } from '@/lib/api-errors';

export const runtime = 'nodejs';

/**
 * Verify service authentication
 */
function verifyServiceAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const apiKey = req.headers.get('x-api-key');
  const serviceKey = process.env.SERVICE_API_KEY || process.env.INGEST_API_KEY;

  if (!serviceKey) {
    return process.env.NODE_ENV === 'development';
  }

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === serviceKey;
  }

  return apiKey === serviceKey;
}

/**
 * GET /api/jobs/stats
 * Get queue statistics and health metrics
 */
export async function GET(req: NextRequest) {
  // Verify authentication
  if (!verifyServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized. Service API key required.' },
      { status: 401 }
    );
  }

  try {
    const redis = getUpstashClient();
    const queue = getBullQueue();

    // Get counts from Redis sorted sets
    const [pendingCount, completedCount, failedCount] = await Promise.all([
      redis.zcard('jobs:pending'),
      redis.zcard('jobs:completed'),
      redis.zcard('jobs:failed'),
    ]);

    // Get BullMQ queue metrics
    const [waiting, active, delayed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getFailedCount(),
    ]);

    // Get recent job IDs for sampling
    const recentPending = await redis.zrange('jobs:pending', 0, 4, { rev: true });
    const recentCompleted = await redis.zrange('jobs:completed', 0, 4, { rev: true });
    const recentFailed = await redis.zrange('jobs:failed', 0, 4, { rev: true });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      redis: {
        pending: pendingCount,
        completed: completedCount,
        failed: failedCount,
        total: pendingCount + completedCount + failedCount,
      },
      bullmq: {
        waiting,
        active,
        delayed,
        failed,
        total: waiting + active + delayed,
      },
      recent: {
        pending: recentPending,
        completed: recentCompleted,
        failed: recentFailed,
      },
      health: {
        status: active > 0 ? 'processing' : waiting > 0 ? 'idle' : 'empty',
        workerActive: active > 0,
      },
    });
  } catch (error) {
    return NextResponse.json(safeErrorBody(error, 'queue', 'GET /api/jobs/stats'), { status: 500 });
  }
}

