import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { intentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import { subscribeSchema, unsubscribeSchema } from '@/lib/a2a/intent-discovery/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = subscribeSchema.parse(body);
    const subscription = intentDiscoveryEngine.subscribe(parsed);
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/intent-discovery/subscribe error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = unsubscribeSchema.parse(body);
    const removed = intentDiscoveryEngine.unsubscribe(parsed.subscriptionId);
    if (!removed) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/a2a/intent-discovery/subscribe error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
