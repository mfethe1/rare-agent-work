import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { failStepSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = failStepSchema.parse(body);
    const execution = workflowOrchestrationEngine.failStep(
      parsed.executionId,
      parsed.stepId,
      parsed.error,
    );
    return NextResponse.json({ execution });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/step-fail error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
