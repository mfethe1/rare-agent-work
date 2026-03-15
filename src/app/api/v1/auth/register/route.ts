import { NextRequest, NextResponse } from "next/server";
import { registerAgent } from "@/lib/agent-auth";

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Request body must be a JSON object", "INVALID_BODY", 400);
  }

  const { name, description, capabilities, callback_url } = body as Record<string, unknown>;

  // Validate required fields
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Field 'name' is required and must be a non-empty string", "MISSING_NAME", 400);
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return errorResponse("Field 'description' is required and must be a non-empty string", "MISSING_DESCRIPTION", 400);
  }
  if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
    return errorResponse("Field 'capabilities' is required and must be a non-empty array", "MISSING_CAPABILITIES", 400);
  }
  if (!capabilities.every((c) => typeof c === "string")) {
    return errorResponse("All capabilities must be strings", "INVALID_CAPABILITIES", 400);
  }
  if (callback_url !== undefined && (typeof callback_url !== "string" || !isValidUrl(callback_url))) {
    return errorResponse("'callback_url' must be a valid URL", "INVALID_CALLBACK_URL", 400);
  }

  try {
    const { agent, api_key } = await registerAgent({
      name: name.trim(),
      description: description.trim(),
      capabilities: capabilities as string[],
      callback_url: callback_url as string | undefined,
    });

    return NextResponse.json(
      {
        agent_id: agent.agent_id,
        api_key,
        created_at: agent.created_at,
        scopes: agent.scopes,
        note: "Store your api_key securely — it will not be shown again.",
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[auth/register] Error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
