import { NextRequest, NextResponse } from "next/server";
import { getCorsHeadersGet, getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { loadTemplates } from "@/app/api/v1/templates/route";
import { verifyApiKey, registerAgent } from "@/lib/agent-auth";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: getCorsHeaders() });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const templates = loadTemplates();
  const template = templates.find((t) => t.id === id);

  if (!template) {
    return NextResponse.json(
      { error: "Template not found", code: "NOT_FOUND", status: 404 },
      { status: 404, headers: getCorsHeadersGet() },
    );
  }

  return NextResponse.json(template, { headers: getCorsHeadersGet() });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  const templates = loadTemplates();
  const template = templates.find((t) => t.id === id);
  if (!template) {
    return errorResponse("Template not found", "NOT_FOUND", 404);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // body is optional
  }

  const name = typeof body.name === "string" ? body.name.trim() : `${template.name} Agent`;
  const description = typeof body.description === "string"
    ? body.description.trim()
    : template.description;

  // Extra capabilities from body merged with template capabilities
  const extraCapabilities = Array.isArray(body.extra_capabilities) ? (body.extra_capabilities as string[]) : [];
  const capabilities = [...new Set([...template.capabilities, ...extraCapabilities])];

  try {
    const { agent: newAgent, api_key } = await registerAgent({
      name,
      description,
      capabilities,
    });

    return NextResponse.json(
      {
        agent_id: newAgent.agent_id,
        name: newAgent.name,
        capabilities: newAgent.capabilities,
        api_key,
        template_id: template.id,
        template_name: template.name,
        recommended_tools: template.recommended_tools,
        message: `Agent instantiated from template '${template.name}'. Store your API key — it won't be shown again.`,
      },
      { status: 201, headers: getCorsHeaders() },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(msg, "INSTANTIATE_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
