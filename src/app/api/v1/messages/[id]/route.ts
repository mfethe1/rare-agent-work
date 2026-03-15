import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS_GET, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { getMessageById, markMessageRead } from "@/lib/messages";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS_GET });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS_GET });
  }

  const msg = await getMessageById(id);
  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404, headers: CORS_HEADERS_GET });
  }
  if (msg.from_agent_id !== agent.agent_id && msg.to_agent_id !== agent.agent_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: CORS_HEADERS_GET });
  }

  return NextResponse.json({ message: msg }, { headers: CORS_HEADERS_GET });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const msg = await markMessageRead(id, agent.agent_id);
  if (!msg) {
    return NextResponse.json({ error: "Message not found or forbidden" }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json({ message: msg, marked_read: true }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
