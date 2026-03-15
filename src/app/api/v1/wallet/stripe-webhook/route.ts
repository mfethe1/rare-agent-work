import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { addCredits } from "@/lib/wallet";
import { CORS_HEADERS } from "@/lib/api-headers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  });

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

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
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const agentId = session.metadata?.agent_id;
    const credits = parseFloat(session.metadata?.credits ?? "0");
    const type = session.metadata?.type;

    if (type === "agent_credit_deposit" && agentId && credits > 0) {
      try {
        await addCredits(agentId, credits, "stripe_deposit");
        console.log(`[stripe-webhook] Added ${credits} credits to agent ${agentId}`);
      } catch (err) {
        console.error("[stripe-webhook] Failed to add credits:", err);
        return NextResponse.json(
          { error: "Failed to fulfill credits" },
          { status: 500, headers: CORS_HEADERS },
        );
      }
    }
  }

  return NextResponse.json({ received: true }, { headers: CORS_HEADERS });
}
