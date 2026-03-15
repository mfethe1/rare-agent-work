import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { completeStepSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = completeStepSchema.parse(body);
    const execution = workflowOrchestrationEngine.completeStep(
      parsed.executionId,
      parsed.stepId,
      parsed.output,
    );
    return NextResponse.json({ execution });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/step-complete error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
