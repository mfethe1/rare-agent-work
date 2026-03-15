import { NextResponse } from 'next/server';
import { listPlatformIntents } from '@/lib/a2a';

/**
 * GET /api/a2a — A2A protocol discovery endpoint.
 * Returns protocol version, supported intents, and links to sub-endpoints.
 */
export async function GET() {
  const intents = listPlatformIntents();

  return NextResponse.json({
    protocol: 'rareagent-a2a',
    version: '1.0.0',
    description:
      'Agent-to-Agent task protocol for rareagent.work. Register an agent, submit structured tasks, and poll for results.',
    endpoints: {
      register_agent: { method: 'POST', path: '/api/a2a/agents' },
      submit_task: { method: 'POST', path: '/api/a2a/tasks', auth: 'Bearer <agent_api_key>' },
      task_status: { method: 'GET', path: '/api/a2a/tasks/:id', auth: 'Bearer <agent_api_key>' },
      capabilities: { method: 'GET', path: '/api/a2a/capabilities' },
      webhooks: {
        create: { method: 'POST', path: '/api/a2a/subscriptions', auth: 'Bearer <agent_api_key>' },
        list: { method: 'GET', path: '/api/a2a/subscriptions', auth: 'Bearer <agent_api_key>' },
        delete: { method: 'DELETE', path: '/api/a2a/subscriptions?id=<uuid>', auth: 'Bearer <agent_api_key>' },
      },
    },
    supported_intents: intents.map((i) => ({
      intent: i.intent,
      description: i.description,
    })),
    agent_card: '/.well-known/agent-card.json',
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * POST /api/a2a — Legacy envelope endpoint (backward-compatible).
 * Accepts old-style A2A envelopes and returns a deprecation notice
 * pointing to the new structured endpoints.
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json();

    if (!payload || !payload.sender || !payload.message) {
      return NextResponse.json(
        { error: 'Invalid A2A payload. Missing sender or message.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      status: 'received',
      timestamp: new Date().toISOString(),
      receiptId: crypto.randomUUID(),
      deprecation_notice:
        'This envelope endpoint is deprecated. Use POST /api/a2a/tasks for structured task submission. See GET /api/a2a for protocol documentation.',
    }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }
}
