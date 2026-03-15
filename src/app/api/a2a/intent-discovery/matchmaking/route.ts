import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { intentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import {
  startMatchmakingSchema,
  refineMatchmakingSchema,
  selectMatchSchema,
  getSessionSchema,
} from '@/lib/a2a/intent-discovery/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();

    // Route based on body shape
    if (body.feedback) {
      const parsed = refineMatchmakingSchema.parse(body);
      const session = intentDiscoveryEngine.refineMatchmaking(parsed.sessionId, parsed.feedback);
      return NextResponse.json({ session });
    }

    if (body.matchId) {
      const parsed = selectMatchSchema.parse(body);
      const session = intentDiscoveryEngine.selectMatch(parsed.sessionId, parsed.matchId);
      return NextResponse.json({ session });
    }

    const parsed = startMatchmakingSchema.parse(body);
    const session = intentDiscoveryEngine.startMatchmaking(parsed.intentId, parsed.config);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/intent-discovery/matchmaking error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    authenticateAgent(req);
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = getSessionSchema.parse(params);
    const session = intentDiscoveryEngine.getSession(parsed.sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (err) {
    console.error('GET /api/a2a/intent-discovery/matchmaking error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
