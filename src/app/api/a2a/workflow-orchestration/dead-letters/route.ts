import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { getExecutionSchema, acknowledgeDeadLetterSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = getExecutionSchema.parse(body);
    const deadLetters = workflowOrchestrationEngine.getDeadLetters(parsed.executionId);
    return NextResponse.json({ deadLetters });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/dead-letters error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = acknowledgeDeadLetterSchema.parse(body);
    const entry = workflowOrchestrationEngine.acknowledgeDeadLetter(
      parsed.executionId,
      parsed.deadLetterId,
    );
    return NextResponse.json({ entry });
  } catch (err) {
    console.error('PUT /api/a2a/workflow-orchestration/dead-letters error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
