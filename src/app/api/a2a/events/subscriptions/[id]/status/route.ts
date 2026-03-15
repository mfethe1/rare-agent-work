import { NextRequest, NextResponse } from 'next/server';
import { updateSubscriptionStatus } from '@/lib/a2a/events';
import { validateStatusTransition } from '@/lib/a2a/events/validation';
import { getSubscription } from '@/lib/a2a/events';

/**
 * PATCH /api/a2a/events/subscriptions/:id/status
 *
 * Update a subscription's status (pause, resume, cancel).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { agent_id, status } = body;

    if (!agent_id || !status) {
      return NextResponse.json({ error: 'agent_id and status are required' }, { status: 400 });
    }

    const existing = await getSubscription(id);
    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const validation = validateStatusTransition(existing.status, status);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Invalid transition', details: validation.errors }, { status: 400 });
    }

    const updated = await updateSubscriptionStatus(id, agent_id, status);
    return NextResponse.json({ subscription: updated });
  } catch (err) {
    console.error('[API] PATCH /api/a2a/events/subscriptions/[id]/status error:', err);
    return NextResponse.json({ error: 'Failed to update subscription status' }, { status: 500 });
  }
}
