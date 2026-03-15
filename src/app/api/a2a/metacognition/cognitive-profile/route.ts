/**
 * GET /api/a2a/metacognition/cognitive-profile — Get an agent's full cognitive profile & summary
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getCognitiveProfile,
  getMetacognitionSummary,
} from '@/lib/a2a/metacognition';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }

    const profile = getCognitiveProfile(agentId);
    if (!profile) {
      return NextResponse.json({ error: 'No cognitive profile found for this agent' }, { status: 404 });
    }

    const summary = getMetacognitionSummary(agentId);
    return NextResponse.json({ profile, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
