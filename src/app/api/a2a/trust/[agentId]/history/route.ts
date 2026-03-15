/**
 * GET /api/a2a/trust/:agentId/history — Get trust event history
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEventHistory } from '@/lib/a2a/trust';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const url = new URL(req.url);

  const domain = url.searchParams.get('domain') as any;
  const event_type = url.searchParams.get('event_type') as any;
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');

  const result = getEventHistory(agentId, {
    domain: domain || undefined,
    event_type: event_type || undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  return NextResponse.json(result);
}
