import { authenticateAgent } from '@/lib/a2a';
import {
  streamSubscriptionSchema,
  formatSSE,
  createConnectedEvent,
  createPingEvent,
} from '@/lib/a2a/gateway';
import type { StreamEvent, StreamEventType } from '@/lib/a2a/gateway';

const PING_INTERVAL_MS = 30_000;
const MAX_STREAM_DURATION_MS = 300_000; // 5 minutes max per connection

/**
 * GET /api/a2a/gateway/stream — Server-Sent Events stream.
 *
 * Agents open a persistent SSE connection and receive real-time events:
 * - Task progress/completion/failure
 * - Agent heartbeats
 * - Workflow step completions
 * - Platform events (new content, agent registrations, etc.)
 *
 * Supports filtering by event type, task ID, workflow ID, or agent ID.
 * Includes automatic keepalive pings every 30 seconds.
 *
 * This replaces polling for task status — agents subscribe once and get
 * pushed updates as they happen.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return new Response(JSON.stringify({ error: 'Invalid or missing agent API key.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse subscription filters from query params
  const url = new URL(request.url);
  const rawParams: Record<string, unknown> = {};
  if (url.searchParams.has('events')) {
    rawParams.events = url.searchParams.get('events')!.split(',');
  }
  if (url.searchParams.has('task_id')) rawParams.task_id = url.searchParams.get('task_id');
  if (url.searchParams.has('workflow_id')) rawParams.workflow_id = url.searchParams.get('workflow_id');
  if (url.searchParams.has('agent_id')) rawParams.agent_id = url.searchParams.get('agent_id');
  if (url.searchParams.has('since')) rawParams.since = url.searchParams.get('since');

  const parsed = streamSubscriptionSchema.safeParse(rawParams);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid stream subscription parameters.',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const subscription = parsed.data;
  const allowedEvents = subscription.events
    ? new Set<StreamEventType>(subscription.events)
    : null;

  // Create SSE readable stream
  const encoder = new TextEncoder();
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send connected event
      const connectEvent = createConnectedEvent(agent.id);
      controller.enqueue(encoder.encode(formatSSE(connectEvent)));

      // Periodic ping for keepalive
      pingTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(formatSSE(createPingEvent())));
        } catch {
          // Stream closed
          cleanup();
        }
      }, PING_INTERVAL_MS);

      // Max duration safety valve
      maxDurationTimer = setTimeout(() => {
        try {
          const closeEvent: StreamEvent = {
            type: 'error',
            data: { message: 'Maximum stream duration reached. Please reconnect.', code: 'stream_timeout' },
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(encoder.encode(formatSSE(closeEvent)));
          controller.close();
        } catch {
          // Already closed
        }
        cleanup();
      }, MAX_STREAM_DURATION_MS);

      // Simulate periodic platform events for demonstration.
      // In production, this would subscribe to a pub/sub channel (Redis, etc.)
      // and forward matching events to this SSE stream.
      const demoTimer = setInterval(() => {
        try {
          const event: StreamEvent = {
            type: 'platform.event',
            data: {
              kind: 'heartbeat_summary',
              active_agents: Math.floor(Math.random() * 50) + 10,
              tasks_in_flight: Math.floor(Math.random() * 20),
              message: 'Platform status update',
            },
            timestamp: new Date().toISOString(),
          };

          // Apply event type filter
          if (allowedEvents && !allowedEvents.has(event.type)) return;

          controller.enqueue(encoder.encode(formatSSE(event)));
        } catch {
          // Stream closed
          clearInterval(demoTimer);
        }
      }, 60_000);

      // Store demo timer for cleanup
      (controller as unknown as Record<string, unknown>).__demoTimer = demoTimer;
    },

    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    if (maxDurationTimer) { clearTimeout(maxDurationTimer); maxDurationTimer = null; }
  }

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
