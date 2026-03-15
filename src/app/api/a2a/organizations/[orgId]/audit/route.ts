import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { queryOrgAudit } from '@/lib/a2a/organizations/engine';
import { orgAuditSchema } from '@/lib/a2a/organizations/validation';

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /api/a2a/organizations/:orgId/audit — Query org audit log
 */
export async function GET(request: Request, { params }: Params) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { orgId } = await params;
    const { searchParams } = new URL(request.url);
    const parsed = orgAuditSchema.safeParse({
      action: searchParams.get('action') ?? undefined,
      actor_agent_id: searchParams.get('actor_agent_id') ?? undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await queryOrgAudit(orgId, parsed.data);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/organizations/:orgId/audit error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
