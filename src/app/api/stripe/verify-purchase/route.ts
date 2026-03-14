/**
 * POST /api/stripe/verify-purchase
 *
 * Verifies a Stripe checkout session and confirms it covers a specific report slug.
 * Called client-side after the Stripe redirect to unlock the purchased report content.
 *
 * This is the missing piece of the one-time purchase flow: the report page redirects
 * here with ?purchased=true&session_id=..., and this endpoint verifies the session
 * so the content can be unlocked without requiring a Supabase auth account.
 *
 * Body: { sessionId: string, reportSlug: string }
 * Response: { verified: true, email: string, reportSlug: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { safeErrorBody } from '@/lib/api-errors';

export const runtime = 'nodejs';

// Plan key → report slug mapping (mirrors PLANS in checkout/route.ts)
const PLAN_TO_SLUG: Record<string, string> = {
  report_60: 'agent-setup-60',
  report_multi: 'single-to-multi-agent',
  report_empirical: 'empirical-agent-architecture',
  report_mcp: 'mcp-security',
  report_incidents: 'agent-incident-postmortems',
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  let body: { sessionId?: string; reportSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sessionId, reportSlug } = body;
  if (!sessionId || !reportSlug) {
    return NextResponse.json({ error: 'Missing sessionId or reportSlug' }, { status: 400 });
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
  });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Must be a completed payment (not subscription, not pending)
    if (session.status !== 'complete') {
      return NextResponse.json({ error: 'Session not complete' }, { status: 402 });
    }
    if (session.mode !== 'payment') {
      return NextResponse.json({ error: 'Not a one-time purchase session' }, { status: 400 });
    }

    // Resolve the slug from the plan key stored in session metadata,
    // or derive it from the line item product name as fallback.
    const planKey = session.metadata?.plan as string | undefined;
    const expectedSlug = planKey ? PLAN_TO_SLUG[planKey] : undefined;

    if (!expectedSlug) {
      // Fallback: check line items for the report name
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 5 });
      const hasReportItem = lineItems.data.some((item) => {
        const name = item.description ?? '';
        return name.toLowerCase().includes(reportSlug.replace(/-/g, ' ').toLowerCase());
      });
      if (!hasReportItem) {
        return NextResponse.json({ error: 'Session does not cover this report' }, { status: 403 });
      }
    } else if (expectedSlug !== reportSlug) {
      return NextResponse.json({ error: 'Session does not cover this report' }, { status: 403 });
    }

    const customerEmail = session.customer_details?.email ?? '';
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    // Persist to report_purchases if not already stored (idempotent upsert)
    const supabase = getAdminSupabase();
    if (supabase && customerEmail) {
      await supabase.from('report_purchases').upsert(
        {
          stripe_session_id: sessionId,
          stripe_customer_id: customerId,
          customer_email: customerEmail,
          report_slug: expectedSlug ?? reportSlug,
          plan_key: planKey ?? '',
          amount_cents: session.amount_total ?? 0,
        },
        { onConflict: 'stripe_session_id' },
      );
    }

    return NextResponse.json({
      verified: true,
      email: customerEmail,
      reportSlug: expectedSlug ?? reportSlug,
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'unknown', 'POST /api/stripe/verify-purchase'),
      { status: 500 },
    );
  }
}
