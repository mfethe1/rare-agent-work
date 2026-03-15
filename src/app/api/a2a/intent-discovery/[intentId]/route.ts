import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { intentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import { updateIntentSchema } from '@/lib/a2a/intent-discovery/validation';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ intentId: string }> },
) {
  try {
    authenticateAgent(req);
    const { intentId } = await params;
    const intent = intentDiscoveryEngine.getIntent(intentId);
    if (!intent) {
      return NextResponse.json({ error: 'Intent not found' }, { status: 404 });
    }
    return NextResponse.json({ intent });
  } catch (err) {
    console.error('GET /api/a2a/intent-discovery/[intentId] error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ intentId: string }> },
) {
  try {
    authenticateAgent(req);
    const { intentId } = await params;
    const body = await req.json();
    const parsed = updateIntentSchema.parse(body);
    const intent = intentDiscoveryEngine.updateIntent(intentId, parsed);
    return NextResponse.json({ intent });
  } catch (err) {
    console.error('PATCH /api/a2a/intent-discovery/[intentId] error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ intentId: string }> },
) {
  try {
    authenticateAgent(req);
    const { intentId } = await params;
    const intent = intentDiscoveryEngine.withdrawIntent(intentId);
    return NextResponse.json({ intent });
  } catch (err) {
    console.error('DELETE /api/a2a/intent-discovery/[intentId] error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
