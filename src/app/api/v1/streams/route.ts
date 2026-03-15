import { NextRequest } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { eventBus, VALID_EVENT_TYPES, type EventType, type BusEvent } from "@/lib/event-bus";

const HEARTBEAT_MS = 30_000;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Optional auth — enhances filtering
  let agentId: string | undefined;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const agent = await verifyApiKey(authHeader.slice(7));
    if (agent) agentId = agent.agent_id;
  }

  // Parse event type filters
  const eventsParam = searchParams.get("events");
  let filteredTypes: EventType[] | null = null;
  if (eventsParam) {
    const requested = eventsParam.split(",").map((e) => e.trim()) as EventType[];
    const invalid = requested.filter((t) => !VALID_EVENT_TYPES.includes(t));
    if (invalid.length > 0) {
      return new Response(
        JSON.stringify({ error: `Invalid event types: ${invalid.join(", ")}. Valid: ${VALID_EVENT_TYPES.join(", ")}`, code: "INVALID_EVENTS" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    filteredTypes = requested;
  }

  // Optional tag filter for news events
  const tagsParam = searchParams.get("tags");
  const tagFilter = tagsParam ? tagsParam.split(",").map((t) => t.trim()) : null;

  const encoder = new TextEncoder();

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connEvent = `event: connected\ndata: ${JSON.stringify({
        message: "SSE stream connected",
        agent_id: agentId,
        filtered_events: filteredTypes ?? VALID_EVENT_TYPES,
        timestamp: new Date().toISOString(),
      })}\n\n`;
      controller.enqueue(encoder.encode(connEvent));

      // Subscribe to events
      const subId = crypto.randomUUID();
      const unsubscribe = eventBus.subscribe(subId, filteredTypes, (event: BusEvent) => {
        // Apply tag filter for news events
        if (tagFilter && event.type === "news.published") {
          const eventTags = (event.data.tags as string[]) ?? [];
          const hasMatch = tagFilter.some((tag) => eventTags.includes(tag));
          if (!hasMatch) return;
        }

        const sseData = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify({
          id: event.id,
          type: event.type,
          data: event.data,
          timestamp: event.timestamp,
        })}\n\n`;
        try {
          controller.enqueue(encoder.encode(sseData));
        } catch {
          // Stream was closed
        }
      });

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        try {
          const heartbeatData = `: heartbeat ${new Date().toISOString()}\n\n`;
          controller.enqueue(encoder.encode(heartbeatData));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, HEARTBEAT_MS);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
