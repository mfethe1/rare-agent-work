import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import {
  authenticateAgent,
  taskSubmitSchema,
  getServiceDb,
  executeIntent,
  isIntentSupported,
  IntentNotFoundError,
} from '@/lib/a2a';
import type { TaskSubmitResponse } from '@/lib/a2a';
import { emitEvent } from '@/lib/a2a/webhooks';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';

/**
 * POST /api/a2a/tasks — Submit a task to the platform.
 *
 * Requires agent authentication via Bearer token.
 * Rate-limited per agent based on trust level.
 * For built-in intents, the task is executed synchronously and
 * the result is available immediately via the status endpoint.
 */
export async function POST(request: Request) {
  // Authenticate the calling agent
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  // Rate limit check
  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('task.submit', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  // Clone the request since authenticateAgent already consumed headers but not body
  const parsed = await validateRequest(request, taskSubmitSchema);
  if (!parsed.success) return parsed.response;

  const { intent, input, target_agent_id, priority, correlation_id, ttl_seconds } = parsed.data;

  // Validate that the intent is supported (for platform-routed tasks)
  if (!target_agent_id && !isIntentSupported(intent)) {
    return NextResponse.json(
      {
        error: `Unsupported intent: "${intent}". Use GET /api/a2a/capabilities to see available intents.`,
      },
      { status: 422 },
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
    // Create the task record
    const { data: task, error: insertError } = await db
      .from('a2a_tasks')
      .insert({
        sender_agent_id: agent.id,
        target_agent_id: target_agent_id ?? null,
        intent,
        priority,
        status: 'accepted',
        input,
        correlation_id: correlation_id ?? null,
        ttl_seconds,
      })
      .select('id, status, created_at')
      .single();

    if (insertError || !task) {
      return NextResponse.json(
        safeErrorBody(insertError, 'db', 'POST /api/a2a/tasks'),
        { status: 500 },
      );
    }

    const baseUrl = new URL(request.url).origin;
    const statusUrl = `${baseUrl}/api/a2a/tasks/${task.id}`;

    // For platform intents, execute synchronously
    if (!target_agent_id && isIntentSupported(intent)) {
      try {
        // Mark in_progress
        await db.from('a2a_tasks').update({ status: 'in_progress' }).eq('id', task.id);

        const result = await executeIntent(intent, input);

        // Mark completed with result
        await db
          .from('a2a_tasks')
          .update({ status: 'completed', result })
          .eq('id', task.id);

        // Emit task.completed event (fire-and-forget)
        emitEvent('task.completed', {
          task_id: task.id,
          intent,
          sender_agent_id: agent.id,
          priority,
          correlation_id: correlation_id ?? null,
        });

        const response: TaskSubmitResponse = {
          task_id: task.id,
          status: 'completed',
          created_at: task.created_at,
          status_url: statusUrl,
        };

        return NextResponse.json(response, { status: 201 });
      } catch (execErr) {
        const errorPayload = execErr instanceof IntentNotFoundError
          ? { code: 'intent_not_found', message: execErr.message }
          : { code: 'execution_error', message: 'Task execution failed.' };

        await db
          .from('a2a_tasks')
          .update({ status: 'failed', error: errorPayload })
          .eq('id', task.id);

        console.error('[A2A] Task execution failed:', task.id, execErr);

        // Emit task.failed event (fire-and-forget)
        emitEvent('task.failed', {
          task_id: task.id,
          intent,
          sender_agent_id: agent.id,
          error_code: errorPayload.code,
          correlation_id: correlation_id ?? null,
        });

        const response: TaskSubmitResponse = {
          task_id: task.id,
          status: 'failed',
          created_at: task.created_at,
          status_url: statusUrl,
        };

        return NextResponse.json(response, { status: 201 });
      }
    }

    // For agent-targeted tasks, emit task.assigned to the target agent
    if (target_agent_id) {
      emitEvent(
        'task.assigned',
        {
          task_id: task.id,
          intent,
          sender_agent_id: agent.id,
          target_agent_id,
          priority,
          input,
          correlation_id: correlation_id ?? null,
          status_url: statusUrl,
        },
        target_agent_id, // Only notify the target agent
      );
    }

    const response: TaskSubmitResponse = {
      task_id: task.id,
      status: 'accepted',
      created_at: task.created_at,
      status_url: statusUrl,
    };

    return NextResponse.json(response, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/tasks'),
      { status: 500 },
    );
  }
}
