import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { queryFederationAudit } from '@/lib/a2a/federation';

/**
 * GET /api/a2a/federation/audit — Query federation audit log.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const entries = await queryFederationAudit({
      peer_id: url.searchParams.get('peer_id') ?? undefined,
      action: url.searchParams.get('action') ?? undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
    });
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/federation/audit'), { status: 500 });
  }
}
