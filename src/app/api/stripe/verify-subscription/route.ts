/**
 * POST /api/stripe/verify-subscription
 *
 * Verifies a Stripe checkout session for a subscription purchase.
 * Called client-side after the Stripe redirect to confirm the subscription
 * and resolve the tier so the success banner can display accurate info.
 *
 * Body: { sessionId: string }
 * Response: { verified: true, tier: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { safeErrorBody } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
  });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status !== 'complete') {
      return NextResponse.json({ error: 'Session not complete' }, { status: 402 });
    }
    if (session.mode !== 'subscription') {
      return NextResponse.json({ error: 'Not a subscription session' }, { status: 400 });
    }

    const tier = session.metadata?.tier ?? session.metadata?.plan ?? '';

    return NextResponse.json({
      verified: true,
      tier,
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'unknown', 'POST /api/stripe/verify-subscription'),
      { status: 500 },
    );
  }
}
