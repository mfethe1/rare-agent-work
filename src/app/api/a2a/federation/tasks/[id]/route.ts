import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getFederatedTask } from '@/lib/a2a/federation';

/**
 * GET /api/a2a/federation/tasks/:id — Get federated task status.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const task = await getFederatedTask(id);
    if (!task) {
      return NextResponse.json({ error: 'Federated task not found.' }, { status: 404 });
    }
    return NextResponse.json({ federated_task: task });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/federation/tasks/:id'), { status: 500 });
  }
}
