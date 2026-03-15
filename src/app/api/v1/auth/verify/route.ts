import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Remaining": "100",
};

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(
      "Authorization header with Bearer token is required",
      "MISSING_AUTH",
      401,
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token || !token.startsWith("ra_")) {
    return errorResponse(
      "Invalid token format. Token must start with ra_",
      "INVALID_TOKEN_FORMAT",
      401,
    );
  }

  try {
    const agent = await verifyApiKey(token);

    if (!agent) {
      return errorResponse("Invalid or expired API key", "INVALID_TOKEN", 401);
    }

    return NextResponse.json(
      {
        valid: true,
        agent: {
          id: agent.agent_id,
          name: agent.name,
          scopes: agent.scopes,
          capabilities: agent.capabilities,
          created_at: agent.created_at,
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[auth/verify] Error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
