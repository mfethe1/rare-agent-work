import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { createWorkflowSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = createWorkflowSchema.parse(body);
    const workflow = workflowOrchestrationEngine.createWorkflow(parsed);
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/create error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
