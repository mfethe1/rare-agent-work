import { NextRequest } from 'next/server';
import {
  getSubscription,
  registerSSEConnection,
  disconnectSSE,
  pollSSEQueue,
} from '@/lib/a2a/events';

/**
 * GET /api/a2a/events/stream?subscription_id=...&agent_id=...
 *
 * Server-Sent Events (SSE) endpoint for real-time event streaming.
 * Agents connect here to receive push events matching their subscription filter.
 *
 * Protocol:
 *   - Connection opens with a "connected" event containing the connection ID
 *   - Events are streamed as they arrive, formatted as SSE
 *   - Heartbeat pings every 30s to keep the connection alive
 *   - On disconnect, agent can reconnect and use replay to catch up
 */
export async function GET(req: NextRequest) {
  const subscription_id = req.nextUrl.searchParams.get('subscription_id');
  const agent_id = req.nextUrl.searchParams.get('agent_id');

  if (!subscription_id || !agent_id) {
    return new Response(JSON.stringify({ error: 'subscription_id and agent_id are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const subscription = await getSubscription(subscription_id);
  if (!subscription) {
    return new Response(JSON.stringify({ error: 'Subscription not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (subscription.agent_id !== agent_id) {
    return new Response(JSON.stringify({ error: 'Subscription does not belong to this agent' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (subscription.status !== 'active') {
    return new Response(JSON.stringify({ error: 'Subscription is not active' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let connectionId: string | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Register SSE connection
      const connection = await registerSSEConnection(subscription_id, agent_id);
      connectionId = connection.id;

      // Send connected event
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ connection_id: connection.id })}\n\n`
        )
      );

      // Poll loop — in production, this would be replaced by Supabase Realtime
      // or a Redis pub/sub listener for true push semantics
      const pollInterval = setInterval(async () => {
        if (closed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const events = await pollSSEQueue(subscription_id, 10);
          for (const event of events) {
            const sseMessage = [
              `id: ${event.sequence}`,
              `event: ${event.topic}`,
              `data: ${JSON.stringify(event)}`,
              '',
              '',
            ].join('\n');
            controller.enqueue(encoder.encode(sseMessage));
          }
        } catch {
          // Swallow poll errors to keep connection alive
        }
      }, 1000);

      // Heartbeat every 30s
      const heartbeatInterval = setInterval(() => {
        if (closed) {
          clearInterval(heartbeatInterval);
          return;
        }
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30_000);
    },

    cancel() {
      closed = true;
      if (connectionId) {
        disconnectSSE(connectionId).catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
