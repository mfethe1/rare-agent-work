import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { getAuditTrail } from '@/lib/a2a/negotiation/engine';

export async function GET(req: NextRequest) {
  try {
    authenticateAgent(req);
    const negotiation_id = req.nextUrl.searchParams.get('negotiation_id');
    if (!negotiation_id) {
      return NextResponse.json({ error: 'negotiation_id required' }, { status: 400 });
    }
    const event_type = req.nextUrl.searchParams.get('event_type') ?? undefined;
    const entries = getAuditTrail(negotiation_id, event_type as any);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('GET /api/a2a/negotiation/audit error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
