import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyApiKey } from "@/lib/agent-auth";
import { addCredits, getRecentDeposits } from "@/lib/wallet";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const MAX_DEPOSIT_AMOUNT = 1000;
const MAX_DEPOSITS_PER_HOUR = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Request body must be a JSON object", "INVALID_BODY", 400);
  }

  const { amount } = body as Record<string, unknown>;

  if (amount === undefined || typeof amount !== "number") {
    return errorResponse("Field 'amount' is required and must be a number", "MISSING_AMOUNT", 400);
  }
  if (amount <= 0 || !Number.isFinite(amount)) {
    return errorResponse("Amount must be a positive number", "INVALID_AMOUNT", 400);
  }

  // Fix 3: Max 1000 credits per deposit
  if (amount > MAX_DEPOSIT_AMOUNT) {
    return errorResponse(
      `Maximum deposit amount is ${MAX_DEPOSIT_AMOUNT} credits per transaction`,
      "AMOUNT_TOO_LARGE",
      400,
    );
  }

  // Fix 3: Max 5 deposits per hour per agent
  const recentDeposits = await getRecentDeposits(agent.agent_id, ONE_HOUR_MS);
  if (recentDeposits.length >= MAX_DEPOSITS_PER_HOUR) {
    const oldest = recentDeposits.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )[0];
    const resetAt = new Date(
      new Date(oldest.created_at).getTime() + ONE_HOUR_MS,
    ).toISOString();

    return NextResponse.json(
      {
        error: `Rate limit exceeded. Maximum ${MAX_DEPOSITS_PER_HOUR} deposits per hour.`,
        code: "RATE_LIMITED",
        status: 429,
        retry_after: resetAt,
      },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": resetAt } },
    );
  }

  // Determine payment method: Stripe checkout or direct (test mode)
  const { payment_method } = body as Record<string, unknown>;
  const useStripe = payment_method === "stripe" || process.env.STRIPE_SECRET_KEY;

  try {
    // If Stripe is configured and requested, create a Checkout Session
    if (useStripe && payment_method === "stripe") {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        return errorResponse("Stripe is not configured on this instance", "STRIPE_NOT_CONFIGURED", 503);
      }

      const stripe = new Stripe(secretKey, {
        apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
      });

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://rareagent.work";
      const unitAmountCents = Math.round(amount * 100); // 1 credit = $1

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${amount} RareAgent Credits`,
                description: `Credit deposit for agent ${agent.name} (${agent.agent_id})`,
              },
              unit_amount: unitAmountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          agent_id: agent.agent_id,
          credits: String(amount),
          type: "agent_credit_deposit",
        },
        success_url: `${baseUrl}/api/v1/wallet/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/api/v1/wallet/deposit/cancelled`,
      });

      return NextResponse.json(
        {
          payment_method: "stripe",
          checkout_url: session.url,
          session_id: session.id,
          amount_usd: amount,
          credits_to_receive: amount,
          agent_id: agent.agent_id,
          note: "Complete payment at checkout_url. Credits will be added automatically via webhook.",
        },
        { status: 201, headers: CORS_HEADERS },
      );
    }

    // Direct deposit (test/sandbox mode — no real payment)
    const tx = await addCredits(agent.agent_id, amount, payment_method === "stripe" ? "stripe_deposit" : "manual_deposit");

    return NextResponse.json(
      {
        payment_method: "direct",
        transaction_id: tx.id,
        agent_id: agent.agent_id,
        amount_deposited: amount,
        new_balance: tx.balance_after,
        currency: "credits",
        deposits_this_hour: recentDeposits.length + 1,
        deposits_remaining: MAX_DEPOSITS_PER_HOUR - recentDeposits.length - 1,
        note: payment_method === "stripe"
          ? "Stripe not configured — credits added directly."
          : "Direct deposit (test mode). Use payment_method: 'stripe' for real payments.",
        created_at: tx.created_at,
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[wallet/deposit] Error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
