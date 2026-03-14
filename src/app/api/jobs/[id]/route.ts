/**
 * GET /api/jobs/[id] - Get job status
 * DELETE /api/jobs/[id] - Cancel a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus, getUpstashClient, getBullQueue } from '@/lib/queue';
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
 * GET /api/jobs/[id]
 * Get job status and details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  if (!verifyServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized. Service API key required.' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const job = await getJobStatus(id);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(safeErrorBody(error, 'queue', 'GET /api/jobs/[id]'), { status: 500 });
  }
}

/**
 * DELETE /api/jobs/[id]
 * Cancel a pending or processing job
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  if (!verifyServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized. Service API key required.' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    
    // Try to remove from BullMQ
    const queue = getBullQueue();
    const bullJob = await queue.getJob(id);
    
    if (bullJob) {
      await bullJob.remove();
    }

    // Update status in Upstash
    const redis = getUpstashClient();
    const jobData = await redis.hgetall(`job:${id}`);
    
    if (!jobData || Object.keys(jobData).length === 0) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    await redis.hset(`job:${id}`, {
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });

    // Remove from pending set
    await redis.zrem('jobs:pending', id);

    return NextResponse.json({
      success: true,
      jobId: id,
      status: 'cancelled',
    });
  } catch (error) {
    return NextResponse.json(safeErrorBody(error, 'queue', 'DELETE /api/jobs/[id]'), { status: 500 });
  }
}

