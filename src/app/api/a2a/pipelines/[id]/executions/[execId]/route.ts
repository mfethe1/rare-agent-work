import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getExecution } from '@/lib/a2a/pipelines';

/**
 * GET /api/a2a/pipelines/:id/executions/:execId — Get execution status.
 *
 * Returns the full execution state including per-stage results,
 * progress, and timing information. Agents poll this endpoint
 * to track pipeline completion.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; execId: string }> },
) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { id: pipelineId, execId } = await params;
  const execution = await getExecution(execId);

  if (!execution || execution.pipeline_id !== pipelineId) {
    return NextResponse.json({ error: 'Execution not found.' }, { status: 404 });
  }

  return NextResponse.json({ execution });
}
