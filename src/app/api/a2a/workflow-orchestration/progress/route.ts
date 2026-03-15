import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { getProgressSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = getProgressSchema.parse(body);
    const progress = workflowOrchestrationEngine.getProgress(parsed.executionId);
    return NextResponse.json({ progress });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/progress error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
