import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { taskUpdateSchema, VALID_STATUS_TRANSITIONS } from '@/lib/a2a/validation';
import type { TaskStatusResponse, TaskUpdateResponse } from '@/lib/a2a';
import { emitEvent } from '@/lib/a2a/webhooks';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shared auth + id validation for all methods on this route. */
async function resolveRequest(
  request: NextRequest,
  params: Promise<{ id: string }>,
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return {
      error: NextResponse.json(
        { error: 'Invalid or missing agent API key.' },
        { status: 401 },
      ),
    };
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return {
      error: NextResponse.json(
        { error: 'Invalid task ID format.' },
        { status: 400 },
      ),
    };
  }

  const db = getServiceDb();
  if (!db) {
    return {
      error: NextResponse.json(
        { error: 'Service temporarily unavailable.' },
        { status: 503 },
      ),
    };
  }

  return { agent, id, db };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function taskToResponse(data: any): TaskStatusResponse {
  return {
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
}

/**
 * GET /api/a2a/tasks/:id — Get task status and result.
 *
 * Requires agent authentication. An agent can view a task if they are
 * the sender OR the assigned target agent.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await resolveRequest(request, params);
  if ('error' in resolved) return resolved.error;
  const { agent, id, db } = resolved;

  try {
    // Allow both sender and target agent to view the task
    const { data, error } = await db
      .from('a2a_tasks')
      .select('*')
      .eq('id', id)
      .or(`sender_agent_id.eq.${agent.id},target_agent_id.eq.${agent.id}`)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Task not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(taskToResponse(data));
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/tasks/:id'),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/a2a/tasks/:id — Update task status (for assigned agents).
 *
 * This is the critical callback endpoint that completes the agent-to-agent
 * collaboration loop. When a task is assigned to an agent via webhook,
 * the assigned agent calls this endpoint to report progress and results.
 *
 * Authorization: Only the target_agent_id of a task can update it.
 * Status transitions are strictly validated (forward-only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await resolveRequest(request, params);
  if ('error' in resolved) return resolved.error;
  const { agent, id, db } = resolved;

  // Rate limit check
  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.update');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('task.update', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  // Validate the request body
  const parsed = await validateRequest(request, taskUpdateSchema);
  if (!parsed.success) return parsed.response;
  const { status: newStatus, result, error: taskError } = parsed.data;

  try {
    // Fetch the task — must exist and be assigned to this agent
    const { data: task, error: fetchError } = await db
      .from('a2a_tasks')
      .select('id, sender_agent_id, target_agent_id, intent, priority, status, correlation_id, ttl_seconds, created_at')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return NextResponse.json(
        { error: 'Task not found.' },
        { status: 404 },
      );
    }

    // Authorization: only the assigned target agent can update
    if (task.target_agent_id !== agent.id) {
      return NextResponse.json(
        { error: 'Only the assigned target agent can update this task.' },
        { status: 403 },
      );
    }

    // Validate status transition
    const allowed = VALID_STATUS_TRANSITIONS[task.status];
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: "${task.status}" → "${newStatus}". Allowed transitions from "${task.status}": ${allowed?.join(', ') ?? 'none (task is in a terminal state)'}.`,
        },
        { status: 422 },
      );
    }

    // Check TTL — reject updates on expired tasks
    const taskAge = (Date.now() - new Date(task.created_at).getTime()) / 1000;
    if (taskAge > task.ttl_seconds) {
      // Auto-fail the expired task
      await db
        .from('a2a_tasks')
        .update({
          status: 'failed',
          error: { code: 'task_expired', message: `Task TTL of ${task.ttl_seconds}s exceeded.` },
        })
        .eq('id', id);

      return NextResponse.json(
        { error: `Task expired (TTL: ${task.ttl_seconds}s). Cannot update.` },
        { status: 410 },
      );
    }

    // Build the update payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { status: newStatus, updated_by_agent_id: agent.id };
    if (result !== undefined) update.result = result;
    if (taskError !== undefined) update.error = taskError;

    const { data: updated, error: updateError } = await db
      .from('a2a_tasks')
      .update(update)
      .eq('id', id)
      .select('id, status, updated_at, completed_at')
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        safeErrorBody(updateError, 'db', 'PATCH /api/a2a/tasks/:id'),
        { status: 500 },
      );
    }

    // Emit lifecycle events (fire-and-forget)
    const eventData = {
      task_id: task.id,
      intent: task.intent,
      sender_agent_id: task.sender_agent_id,
      target_agent_id: agent.id,
      priority: task.priority,
      correlation_id: task.correlation_id ?? null,
    };

    if (newStatus === 'completed') {
      emitEvent('task.completed', eventData);
    } else if (newStatus === 'failed') {
      emitEvent('task.failed', {
        ...eventData,
        error_code: taskError?.code ?? 'unknown',
      });
    }

    const response: TaskUpdateResponse = {
      task_id: updated.id,
      status: updated.status,
      updated_at: updated.updated_at,
      completed_at: updated.completed_at ?? undefined,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'PATCH /api/a2a/tasks/:id'),
      { status: 500 },
    );
  }
}
