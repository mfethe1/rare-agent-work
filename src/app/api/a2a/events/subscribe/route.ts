import { NextRequest, NextResponse } from 'next/server';
import { createSubscription, listSubscriptions } from '@/lib/a2a/events';
import { validateCreateSubscription } from '@/lib/a2a/events/validation';

/**
 * POST /api/a2a/events/subscribe
 *
 * Create a new event subscription for an agent.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateCreateSubscription(body);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    const subscription = await createSubscription(body);
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (err) {
    console.error('[API] POST /api/a2a/events/subscribe error:', err);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}

/**
 * GET /api/a2a/events/subscribe?agent_id=...&status=...
 *
 * List subscriptions for an agent.
 */
export async function GET(req: NextRequest) {
  try {
    const agent_id = req.nextUrl.searchParams.get('agent_id');
    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const status = req.nextUrl.searchParams.get('status') as 'active' | 'paused' | 'cancelled' | 'suspended' | null;
    const subscriptions = await listSubscriptions(agent_id, status ?? undefined);
    return NextResponse.json({ subscriptions });
  } catch (err) {
    console.error('[API] GET /api/a2a/events/subscribe error:', err);
    return NextResponse.json({ error: 'Failed to list subscriptions' }, { status: 500 });
  }
}
