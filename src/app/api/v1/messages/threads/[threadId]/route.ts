import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS_GET } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { getThread } from "@/lib/messages";

export async function GET(req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS_GET });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS_GET });
  }

  const messages = await getThread(threadId);
  // Only return thread messages the agent is part of
  const visible = messages.filter(
    (m) => m.from_agent_id === agent.agent_id || m.to_agent_id === agent.agent_id,
  );

  return NextResponse.json({
    thread_id: threadId,
    message_count: visible.length,
    messages: visible,
  }, { headers: CORS_HEADERS_GET });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
