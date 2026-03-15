/**
 * POST /api/a2a/trust/:agentId/override — Set a manual autonomy override
 * DELETE /api/a2a/trust/:agentId/override — Lift a manual override
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  setManualOverride,
  liftManualOverride,
  manualOverrideSchema,
  liftOverrideSchema,
} from '@/lib/a2a/trust';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const body = await req.json();

  const parsed = manualOverrideSchema.safeParse({ ...body, agent_id: agentId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid override request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = setManualOverride(parsed.data);
  return NextResponse.json(event);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const body = await req.json();

  const parsed = liftOverrideSchema.safeParse({ ...body, agent_id: agentId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid lift override request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = liftManualOverride(parsed.data);
  if (!event) {
    return NextResponse.json(
      { error: 'No active override found for this agent/domain' },
      { status: 404 },
    );
  }

  return NextResponse.json(event);
}
