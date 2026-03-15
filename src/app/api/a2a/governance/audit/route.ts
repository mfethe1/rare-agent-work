import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { auditQuerySchema, queryAuditLog } from '@/lib/a2a/governance';

/**
 * GET /api/a2a/governance/audit — Query the governance audit log.
 *
 * Returns an immutable trail of every governed action evaluation.
 * Query params: agent_id, action, decision, limit
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const params = {
    agent_id: url.searchParams.get('agent_id') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
    decision: url.searchParams.get('decision') ?? undefined,
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100,
  };

  const parseResult = auditQuerySchema.safeParse(params);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const entries = await queryAuditLog(parseResult.data);
    return NextResponse.json({ entries, count: entries.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/governance/audit'), { status: 500 });
  }
}
