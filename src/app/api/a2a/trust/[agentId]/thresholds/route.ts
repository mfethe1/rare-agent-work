/**
 * POST /api/a2a/trust/:agentId/thresholds — Adjust trust thresholds for an agent+domain
 */
import { NextRequest, NextResponse } from 'next/server';
import { adjustThresholds, thresholdAdjustmentSchema } from '@/lib/a2a/trust';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const body = await req.json();

  const parsed = thresholdAdjustmentSchema.safeParse({ ...body, agent_id: agentId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid threshold adjustment', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = adjustThresholds(parsed.data);
  return NextResponse.json(event);
}
