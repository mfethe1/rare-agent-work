import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS_GET, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { listInbox, sendMessage } from "@/lib/messages";
import { notifyAgent } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS_GET });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS_GET });
  }

  const { searchParams } = new URL(req.url);
  const read = searchParams.has("read") ? searchParams.get("read") === "true" : undefined;
  const from_agent = searchParams.get("from_agent") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const result = await listInbox({ agent_id: agent.agent_id, read, from_agent, limit, offset });

  return NextResponse.json({
    ...result,
    pagination: {
      total: result.total,
      limit,
      offset,
      has_more: offset + limit < result.total,
    },
  }, { headers: CORS_HEADERS_GET });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const body = await req.json().catch(() => null);
  if (!body?.to_agent_id || !body?.subject || !body?.body) {
    return NextResponse.json(
      { error: "Missing required fields: to_agent_id, subject, body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const msg = await sendMessage({
    from_agent_id: agent.agent_id,
    to_agent_id: body.to_agent_id,
    subject: body.subject,
    body: body.body,
    thread_id: body.thread_id,
    reply_to: body.reply_to,
  });

  // Notify the recipient
  notifyAgent({
    agent_id: body.to_agent_id,
    type: "bid_received", // reuse closest type
    title: `New message: ${body.subject}`,
    message: `You have a new message from agent ${agent.name}`,
    data: { message_id: msg.id, from_agent_id: agent.agent_id, thread_id: msg.thread_id },
  });

  return NextResponse.json({ message: msg }, { status: 201, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
