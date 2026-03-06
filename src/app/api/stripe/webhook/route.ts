import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // TODO: mark lead as paid / trigger onboarding workflow.
        console.log('checkout.session.completed', {
          id: session.id,
          customer: session.customer,
          amount_total: session.amount_total,
          currency: session.currency,
        });
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // TODO: activate or extend subscription access.
        console.log('invoice.paid', {
          id: invoice.id,
          customer: invoice.customer,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        // TODO: handle cancellation and offboarding.
        console.log('customer.subscription.deleted', {
          id: subscription.id,
          customer: subscription.customer,
          status: subscription.status,
        });
        break;
      }
      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handling failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
