import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  getWorkflowExecution,
  computeProgress,
  getStepCategories,
} from '@/lib/a2a/workflow-engine';

/**
 * GET /api/a2a/workflows/:id/executions/:execId — Get workflow execution status.
 *
 * Returns full execution state including per-step progress, active/blocked
 * step lists, and overall progress percentage.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; execId: string }> },
) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { id: workflowId, execId } = await params;
  const execution = await getWorkflowExecution(execId);

  if (!execution || execution.workflow_definition_id !== workflowId) {
    return NextResponse.json({ error: 'Execution not found.' }, { status: 404 });
  }

  // Only the initiator can view execution details
  if (execution.initiator_agent_id !== agent.id) {
    return NextResponse.json({ error: 'Not authorized to view this execution.' }, { status: 403 });
  }

  const progress = computeProgress(execution.steps);
  const { active, blocked } = getStepCategories(execution.steps);

  return NextResponse.json({
    execution: {
      id: execution.id,
      workflow_definition_id: execution.workflow_definition_id,
      initiator_agent_id: execution.initiator_agent_id,
      status: execution.status,
      input: execution.input,
      output: execution.output,
      error: execution.error,
      correlation_id: execution.correlation_id,
      created_at: execution.created_at,
      started_at: execution.started_at,
      completed_at: execution.completed_at,
      deadline: execution.deadline,
      steps: execution.steps.map((s) => ({
        step_id: s.step_id,
        status: s.status,
        task_id: s.task_id,
        assigned_agent_id: s.assigned_agent_id,
        result: s.result,
        error: s.error,
        attempts: s.attempts,
        started_at: s.started_at,
        completed_at: s.completed_at,
      })),
    },
    progress,
    active_steps: active,
    blocked_steps: blocked,
  });
}
