import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  federatedTaskSubmitSchema,
  submitFederatedTask,
} from '@/lib/a2a/federation';

/**
 * POST /api/a2a/federation/tasks — Submit a task to a remote agent on a peer platform.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const parsed = await validateRequest(request, federatedTaskSubmitSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await submitFederatedTask(parsed.data);
    return NextResponse.json({ federated_task: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/federation/tasks'), { status: 500 });
  }
}
