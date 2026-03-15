import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { fuseInsights } from '@/lib/a2a/noosphere/engine';
import { fuseInsightsSchema } from '@/lib/a2a/noosphere/validation';

/** POST /api/a2a/noosphere/fuse — Fuse multiple thoughts into an emergent conclusion */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = fuseInsightsSchema.parse(body);
    const result = fuseInsights(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
