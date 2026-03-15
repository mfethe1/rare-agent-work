/**
 * GET /api/a2a/trust — List all agent trust profiles
 * POST /api/a2a/trust — Submit a trust signal (post-action evaluation)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  listProfiles,
  evaluateSignal,
  trustSignalSchema,
} from '@/lib/a2a/trust';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const min_score = url.searchParams.get('min_score');
  const autonomy_level = url.searchParams.get('autonomy_level');
  const domain = url.searchParams.get('domain');
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');

  const result = listProfiles({
    min_composite_score: min_score ? parseFloat(min_score) : undefined,
    autonomy_level: autonomy_level as any,
    domain: domain as any,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = trustSignalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid trust signal', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = evaluateSignal(parsed.data);
  return NextResponse.json(result, { status: 200 });
}
