import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { cancelExecution, getExecution } from '@/lib/a2a/pipelines';

/**
 * POST /api/a2a/pipelines/:id/executions/:execId/cancel — Cancel execution.
 *
 * Cancels a running or pending pipeline execution. Stages already
 * completed retain their results; pending stages are marked as skipped.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; execId: string }> },
) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: pipelineId, execId } = await params;
    const execution = await getExecution(execId);

    if (!execution || execution.pipeline_id !== pipelineId) {
      return NextResponse.json({ error: 'Execution not found.' }, { status: 404 });
    }

    // Only the invoking agent can cancel
    if (execution.invoked_by_agent_id !== agent.id) {
      return NextResponse.json({ error: 'Only the invoking agent can cancel.' }, { status: 403 });
    }

    const cancelled = await cancelExecution(execId);

    const completedStages = cancelled.stages.filter(s => s.status === 'completed').length;
    return NextResponse.json({
      execution_id: cancelled.id,
      status: 'cancelled',
      stages_completed: completedStages,
      stages_total: cancelled.stages.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancel failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
