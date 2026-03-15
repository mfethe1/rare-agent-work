import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { workflowOrchestrationEngine } from '@/lib/a2a/workflow-orchestration/engine';
import { getAuditLogSchema } from '@/lib/a2a/workflow-orchestration/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = getAuditLogSchema.parse(body);
    const auditLog = workflowOrchestrationEngine.getAuditLog(parsed.executionId);
    return NextResponse.json({ auditLog });
  } catch (err) {
    console.error('POST /api/a2a/workflow-orchestration/audit error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
