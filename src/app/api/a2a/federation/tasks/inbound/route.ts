import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { handleInboundTask } from '@/lib/a2a/federation';

/**
 * POST /api/a2a/federation/tasks/inbound — Receive a task from a federated peer.
 *
 * This endpoint is called by remote platforms to submit tasks to local agents.
 * Authentication is via the X-Federation-Fingerprint header (peer's key fingerprint).
 */
export async function POST(request: Request) {
  const fingerprint = request.headers.get('x-federation-fingerprint');
  if (!fingerprint) {
    return NextResponse.json(
      { error: 'Missing X-Federation-Fingerprint header.' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();

    const result = await handleInboundTask(fingerprint, {
      target_agent_id: body.target_agent_id,
      intent: body.intent,
      payload: body.payload ?? {},
      trace_context: body.trace_context,
    });

    if (!result.accepted) {
      return NextResponse.json(
        { accepted: false, error: result.error },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { accepted: true, task_id: result.task_id },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/federation/tasks/inbound'),
      { status: 500 },
    );
  }
}
