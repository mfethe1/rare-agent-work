import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';

/**
 * GET /api/a2a/workflows/:id/executions — List executions for a workflow.
 *
 * Returns recent executions with summary status, filterable by status.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { getServiceDb } = await import('@/lib/a2a/auth');
  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  const { id: workflowId } = await params;
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');

  let query = db
    .from('a2a_workflow_executions')
    .select('id, status, correlation_id, created_at, started_at, completed_at, deadline')
    .eq('workflow_definition_id', workflowId)
    .eq('initiator_agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[A2A Workflow] List executions failed:', error);
    return NextResponse.json({ error: 'Failed to list executions.' }, { status: 500 });
  }

  return NextResponse.json({
    executions: data ?? [],
    count: data?.length ?? 0,
  });
}
