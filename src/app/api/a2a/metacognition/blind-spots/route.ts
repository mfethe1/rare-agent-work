/**
 * GET /api/a2a/metacognition/blind-spots — Get detected blind spots for an agent
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getBlindSpots,
  getBlindSpotsSchema,
} from '@/lib/a2a/metacognition';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }

    const minConfidence = url.searchParams.get('min_confidence');
    const type = url.searchParams.get('type');

    const input = {
      agent_id: agentId,
      min_confidence: minConfidence ? parseFloat(minConfidence) : undefined,
      type: type ?? undefined,
    };

    const parsed = getBlindSpotsSchema.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = getBlindSpots(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
