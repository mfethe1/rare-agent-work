import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { timeoutStepSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = timeoutStepSchema.parse(body);
    const execution = workflowOrchestrationEngine.timeoutStep(
      parsed.executionId,
      parsed.stepId,
    );
    return NextResponse.json({ execution });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/step-timeout error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
