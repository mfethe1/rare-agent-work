import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { addCredits } from "@/lib/wallet";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "X-API-Version": "1.0.0",
};

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe-webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const agentId = session.metadata?.agent_id;
        const credits = session.metadata?.credits;
        const type = session.metadata?.type;

        if (type === "agent_credit_deposit" && agentId && credits) {
          const amount = parseFloat(credits);
          if (Number.isFinite(amount) && amount > 0) {
            await addCredits(agentId, amount, "stripe_deposit");
            console.log(
              `[stripe-webhook] Credited ${amount} to agent ${agentId} (session ${session.id})`,
            );
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // If we need to reverse credits on refund, handle here
        console.log(`[stripe-webhook] Refund received for charge ${charge.id}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { headers: CORS_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook handling failed";
    console.error("[stripe-webhook] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}
