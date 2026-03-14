/**
 * POST /api/jobs - Create a new job
 * GET /api/jobs - List jobs (with filtering)
 */

import { NextRequest, NextResponse } from 'next/server';
import { enqueueJob, getUpstashClient } from '@/lib/queue';
import type { JobPayload, CreateJobOptions, Job } from '@/lib/queue/types';
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
    // If no service key is configured, allow in development
    return process.env.NODE_ENV === 'development';
  }

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === serviceKey;
  }

  return apiKey === serviceKey;
}

/**
 * POST /api/jobs
 * Create a new background job
 */
export async function POST(req: NextRequest) {
  // Verify authentication
  if (!verifyServiceAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized. Service API key required.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { payload, options } = body as {
      payload: JobPayload;
      options?: CreateJobOptions;
    };

    if (!payload || !payload.type) {
      return NextResponse.json(
        { error: 'Invalid request. payload.type is required.' },
        { status: 400 }
      );
    }

    const jobId = await enqueueJob(payload, options);

    return NextResponse.json(
      {
        success: true,
        jobId,
        type: payload.type,
        status: 'pending',
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(safeErrorBody(error, 'queue', 'POST /api/jobs'), { status: 500 });
  }
}

/**
 * GET /api/jobs
 * List jobs with optional filtering
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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // pending, completed, failed
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const redis = getUpstashClient();
    
    // Determine which sorted set to query
    const setKey = status === 'completed' 
      ? 'jobs:completed'
      : status === 'failed'
      ? 'jobs:failed'
      : 'jobs:pending';

    // Get job IDs from sorted set (most recent first)
    const jobIds = await redis.zrange(setKey, offset, offset + limit - 1, {
      rev: true,
    });

    // Fetch job details
    const jobs: Job[] = [];
    for (const jobId of jobIds) {
      const jobData = await redis.hgetall(`job:${jobId}`);
      if (jobData && Object.keys(jobData).length > 0) {
        jobs.push({ id: jobId as string, ...jobData } as unknown as Job);
      }
    }

    // Get total count
    const total = await redis.zcard(setKey);

    return NextResponse.json({
      jobs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    return NextResponse.json(safeErrorBody(error, 'queue', 'GET /api/jobs'), { status: 500 });
  }
}

