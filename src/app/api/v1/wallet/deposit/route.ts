import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { addCredits } from "@/lib/wallet";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

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
  if (amount > 10000) {
    return errorResponse("Maximum deposit amount is 10,000 credits per transaction", "AMOUNT_TOO_LARGE", 400);
  }

  try {
    const tx = addCredits(agent.agent_id, amount, "manual_deposit");

    return NextResponse.json(
      {
        transaction_id: tx.id,
        agent_id: agent.agent_id,
        amount_deposited: amount,
        new_balance: tx.balance_after,
        currency: "credits",
        note: "In production, this would integrate with Stripe for real payment processing.",
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
