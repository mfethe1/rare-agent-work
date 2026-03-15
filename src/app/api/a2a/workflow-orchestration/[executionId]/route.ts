import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    authenticateAgent(req);
    const { executionId } = await params;
    const execution = workflowOrchestrationEngine.getExecution(executionId);
    return NextResponse.json({ execution });
  } catch (err) {
    console.error('GET /api/a2a/workflow-orchestration/[executionId] error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
