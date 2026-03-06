import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Use service-role key for webhook writes (bypasses RLS)
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

const TIER_BUDGETS: Record<string, number> = {
  starter: 50_000,
  pro: 200_000,
};

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || !secret) {
    return NextResponse.json(
      { error: 'Stripe webhook env vars are not configured.' },
      { status: 500 },
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  });

  const body = await req.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header.' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const customerEmail = session.customer_details?.email;
        const tier = (session.metadata?.tier as string) ?? null;

        console.log('checkout.session.completed', {
          id: session.id,
          customer: customerId,
          tier,
          amount_total: session.amount_total,
        });

        if (supabase && customerId && customerEmail && tier) {
          const budget = TIER_BUDGETS[tier] ?? 0;
          // Upsert user profile with new tier
          await supabase.from('users').upsert(
            {
              email: customerEmail,
              tier,
              tokens_budget: budget,
              stripe_customer_id: customerId,
              stripe_subscription_id:
                typeof session.subscription === 'string'
                  ? session.subscription
                  : session.subscription?.id ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          );
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        console.log('invoice.paid', {
          id: invoice.id,
          customer: customerId,
          amount_paid: invoice.amount_paid,
        });

        if (supabase && customerId) {
          // Reset monthly token usage on each paid invoice cycle
          await supabase
            .from('users')
            .update({ tokens_used: 0, updated_at: new Date().toISOString() })
            .eq('stripe_customer_id', customerId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        console.log('customer.subscription.deleted', {
          id: subscription.id,
          customer: customerId,
          status: subscription.status,
        });

        if (supabase && customerId) {
          await supabase
            .from('users')
            .update({
              tier: 'free',
              tokens_budget: 0,
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId);
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handling failed';
    console.error('Webhook error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
