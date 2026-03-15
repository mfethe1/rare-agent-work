/**
 * POST /api/a2a/trust/:agentId/evaluate — Evaluate a trust signal for a specific agent
 */
import { NextRequest, NextResponse } from 'next/server';
import { evaluateSignal, trustSignalSchema } from '@/lib/a2a/trust';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const body = await req.json();

  const parsed = trustSignalSchema.safeParse({ ...body, agent_id: agentId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid trust signal', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = evaluateSignal(parsed.data);
  return NextResponse.json(result);
}
