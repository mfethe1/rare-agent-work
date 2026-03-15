import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { intentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import { findMatchesSchema } from '@/lib/a2a/intent-discovery/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = findMatchesSchema.parse(body);
    const matches = intentDiscoveryEngine.findMatches(parsed.intentId, {
      maxResults: parsed.maxResults,
      minScore: parsed.minScore,
      domainFilter: parsed.domainFilter,
      excludeAgents: parsed.excludeAgents,
    });
    return NextResponse.json({ matches });
  } catch (err) {
    console.error('POST /api/a2a/intent-discovery/match error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
