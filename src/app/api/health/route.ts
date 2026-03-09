import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/health
 * 
 * Basic health check endpoint for production verification.
 * Returns deployment metadata and system status.
 */
export async function GET() {
  const status = 'ok';
  const timestamp = new Date().toISOString();
  
  // Get deployment SHA from environment (Railway or Vercel)
  const commitSha = 
    process.env.RAILWAY_GIT_COMMIT_SHA || 
    process.env.VERCEL_GIT_COMMIT_SHA || 
    'local';
  
  return NextResponse.json(
    {
      status,
      timestamp,
      deployment: {
        commit: commitSha,
        platform: process.env.RAILWAY_GIT_COMMIT_SHA ? 'railway' : 
                  process.env.VERCEL_GIT_COMMIT_SHA ? 'vercel' : 'local',
      },
    },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}

