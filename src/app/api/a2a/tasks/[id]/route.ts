import { NextRequest, NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import type { TaskStatusResponse } from '@/lib/a2a';

/**
 * GET /api/a2a/tasks/:id — Get task status and result.
 *
 * Requires agent authentication. Agents can only view their own tasks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  const { id } = await params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: 'Invalid task ID format.' },
      { status: 400 },
    );
  }

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      { status: 503 },
    );
  }

  try {
    const { data, error } = await db
      .from('a2a_tasks')
      .select('*')
      .eq('id', id)
      .eq('sender_agent_id', agent.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Task not found.' },
        { status: 404 },
      );
    }

    const response: TaskStatusResponse = {
      task: {
        id: data.id,
        sender_agent_id: data.sender_agent_id,
        target_agent_id: data.target_agent_id ?? undefined,
        intent: data.intent,
        priority: data.priority,
        status: data.status,
        input: data.input,
        result: data.result ?? undefined,
        error: data.error ?? undefined,
        correlation_id: data.correlation_id ?? undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
        completed_at: data.completed_at ?? undefined,
        ttl_seconds: data.ttl_seconds,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/tasks/:id'),
      { status: 500 },
    );
  }
}
