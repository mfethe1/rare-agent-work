import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { createCheckpointSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = createCheckpointSchema.parse(body);
    const checkpoint = workflowOrchestrationEngine.createCheckpoint(
      parsed.executionId,
      parsed.atStepId,
    );
    return NextResponse.json({ checkpoint }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/checkpoint error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
