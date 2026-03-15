import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { executeWorkflowSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = executeWorkflowSchema.parse(body);
    const execution = workflowOrchestrationEngine.executeWorkflow(parsed.workflowId, parsed.input);
    return NextResponse.json({ execution }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/execute error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
