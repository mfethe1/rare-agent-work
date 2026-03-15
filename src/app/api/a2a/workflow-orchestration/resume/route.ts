import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { resumeExecutionSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = resumeExecutionSchema.parse(body);
    let execution;
    if (parsed.fromCheckpointId) {
      execution = workflowOrchestrationEngine.restoreFromCheckpoint(
        parsed.executionId,
        parsed.fromCheckpointId,
      );
    } else {
      execution = workflowOrchestrationEngine.resumeExecution(parsed.executionId);
    }
    return NextResponse.json({ execution });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/resume error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
