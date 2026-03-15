import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { triggerWorkflow, computeProgress, getStepCategories } from '@/lib/a2a/workflow-engine';
import type { TriggerWorkflowRequest } from '@/lib/a2a/workflow-types';

/**
 * POST /api/a2a/workflows/:id/trigger — Start a new workflow execution.
 *
 * Creates an execution instance, initializes all steps as pending,
 * and immediately begins advancing root steps (those with no dependencies).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
    if (!rl.allowed) {
      return NextResponse.json(rateLimitBody('task.submit', rl), {
        status: 429,
        headers: rateLimitHeaders(rl),
      });
    }

    const { id: workflowId } = await params;
    const body = (await req.json()) as TriggerWorkflowRequest;

    if (!body.input || typeof body.input !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request. Required: input (object).' },
        { status: 400 },
      );
    }

    const result = await triggerWorkflow(workflowId, agent.id, body);

    if (result.error) {
      const status = result.error.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    const execution = result.execution!;
    const progress = computeProgress(execution.steps);
    const { active, blocked } = getStepCategories(execution.steps);

    return NextResponse.json(
      {
        execution_id: execution.id,
        workflow_id: workflowId,
        status: execution.status,
        correlation_id: execution.correlation_id,
        progress,
        steps: execution.steps.map((s) => ({
          step_id: s.step_id,
          status: s.status,
          task_id: s.task_id,
          assigned_agent_id: s.assigned_agent_id,
        })),
        active_steps: active,
        blocked_steps: blocked,
        created_at: execution.created_at,
        deadline: execution.deadline,
        status_url: `/api/a2a/workflows/${workflowId}/executions/${execution.id}`,
      },
      { status: 201, headers: rateLimitHeaders(rl) },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}
