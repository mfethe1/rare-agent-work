import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

// Map plan keys to env-var price IDs (created in Stripe dashboard/API)
function getPriceId(planKey: string): string | null {
  const map: Record<string, string | undefined> = {
    report_60: process.env.STRIPE_PRICE_ID_REPORT_60,
    report_multi: process.env.STRIPE_PRICE_ID_REPORT_MULTI,
    report_empirical: process.env.STRIPE_PRICE_ID_REPORT_EMPIRICAL,
    report_mcp: process.env.STRIPE_PRICE_ID_REPORT_MCP,
    report_incidents: process.env.STRIPE_PRICE_ID_REPORT_INCIDENTS,
    newsletter: process.env.STRIPE_PRICE_ID_NEWSLETTER,
    starter: process.env.STRIPE_PRICE_ID_STARTER,
    pro: process.env.STRIPE_PRICE_ID_PRO,
  };
  return map[planKey] || null;
}

const PLANS = {
  // One-time report purchases
  report_60: {
    amount: 2900,
    name: "Agent Setup in 60 Minutes",
    slug: "agent-setup-60",
    mode: "payment" as const,
    tier: null,
  },
  report_multi: {
    amount: 7900,
    name: "From Single Agent to Multi-Agent",
    slug: "single-to-multi-agent",
    mode: "payment" as const,
    tier: null,
  },
  report_empirical: {
    amount: 29900,
    name: "Agent Architecture Empirical Research",
    slug: "empirical-agent-architecture",
    mode: "payment" as const,
    tier: null,
  },
  report_mcp: {
    amount: 14900,
    name: 'MCP Security: Protecting Agents from Tool Poisoning',
    slug: 'mcp-security',
    mode: 'payment' as const,
    tier: null,
  },
  report_incidents: {
    amount: 14900,
    name: 'Production Agent Incidents: Real Post-Mortems',
    slug: 'agent-incident-postmortems',
    mode: 'payment' as const,
    tier: null,
  },
  // Subscriptions
  newsletter: {
    amount: 1000,
    name: "Newsletter Plan — premium newsletter + hot-news alerts",
    slug: null,
    mode: "subscription" as const,
    tier: "newsletter",
  },
  starter: {
    amount: 2900,
    name: "Starter Plan — All Reports + AI Guide (50k tokens/mo)",
    slug: null,
    mode: "subscription" as const,
    tier: "starter",
  },
  pro: {
    amount: 4900,
    name: "Operator Access — reports + AI guide + priority research updates",
    slug: null,
    mode: "subscription" as const,
    tier: "pro",
  },

} as const;

type PlanKey = keyof typeof PLANS;

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured. Contact support." },
      { status: 500 }
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  });

  let body: { plan: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const planKey = body.plan as PlanKey;
  const plan = PLANS[planKey];

  if (!plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (req.headers.get("origin") ?? "https://rareagent.work");

  try {
    const priceId = getPriceId(planKey);

    if (plan.mode === "subscription") {
      const lineItem = priceId
        ? { price: priceId, quantity: 1 }
        : {
            price_data: {
              currency: "usd" as const,
              product_data: {
                name: plan.name,
                metadata: { tier: plan.tier ?? "starter" },
              },
              unit_amount: plan.amount,
              recurring: { interval: "month" as const },
            },
            quantity: 1,
          };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [lineItem],
        metadata: { plan: planKey, tier: plan.tier ?? "starter" },
        success_url: `${baseUrl}/account?subscribed=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pricing`,
      });
      return NextResponse.json({ url: session.url });
    }

    // One-time purchase
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: "usd" as const,
            product_data: { name: plan.name },
            unit_amount: plan.amount,
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [lineItem],
      metadata: { plan: planKey },
      success_url: `${baseUrl}/reports/${plan.slug}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/reports/${plan.slug}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    console.error("Stripe checkout error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
