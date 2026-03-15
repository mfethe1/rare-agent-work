import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent, taskFeedbackSchema } from '@/lib/a2a';
import { submitTaskFeedback } from '@/lib/a2a/reputation';
import { emitEvent } from '@/lib/a2a/webhooks';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';

/**
 * POST /api/a2a/tasks/:id/feedback — Rate a completed task.
 *
 * Allows the requesting agent to provide quality feedback (1-5 rating)
 * after a task completes. This feedback drives the dynamic reputation
 * system that improves routing decisions over time.
 *
 * Only the sender of a task can rate it. Only completed/failed tasks
 * can receive feedback. One rating per task per reviewer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  // Rate limit check
  const rl = await checkRateLimit(agent.id, agent.trust_level, 'feedback.submit');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('feedback.submit', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const { id: taskId } = await params;

  if (!taskId || !/^[0-9a-f-]{36}$/.test(taskId)) {
    return NextResponse.json(
      { error: 'Invalid task ID.' },
      { status: 400 },
    );
  }

  const parsed = await validateRequest(request, taskFeedbackSchema);
  if (!parsed.success) return parsed.response;

  const { rating, feedback } = parsed.data;

  try {
    const result = await submitTaskFeedback({
      task_id: taskId,
      reviewer_agent_id: agent.id,
      rating,
      feedback,
    });

    if (!result.success) {
      const status = result.error === 'Task not found.' ? 404
        : result.error === 'Only the requesting agent can rate a task.' ? 403
        : result.error === 'Cannot rate platform-executed tasks.' ? 422
        : 400;

      return NextResponse.json(
        { error: result.error },
        { status },
      );
    }

    // Emit event for observability and potential reputation refresh triggers
    emitEvent('task.feedback', {
      task_id: taskId,
      feedback_id: result.feedback_id,
      reviewer_agent_id: agent.id,
      rating,
    });

    return NextResponse.json(
      {
        feedback_id: result.feedback_id,
        task_id: taskId,
        rating,
        message: 'Feedback recorded. Reputation scores update periodically.',
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', `POST /api/a2a/tasks/${taskId}/feedback`),
      { status: 500 },
    );
  }
}
