/**
 * POST /api/a2a/correlations/search — Search correlation contexts
 *
 * Rich search across correlation contexts by name, status, domain
 * involvement, time range, and minimum event count.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { searchCorrelations } from '@/lib/a2a/events/correlation';
import { EventDomain } from '@/lib/a2a/events/types';

export async function POST(request: NextRequest) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const results = await searchCorrelations({
      name_pattern: body.name_pattern,
      initiator_id: body.initiator_id,
      status: body.status,
      min_events: body.min_events,
      domains: body.domains as EventDomain[],
      from_date: body.from_date,
      to_date: body.to_date,
      limit: Math.min(body.limit ?? 50, 100),
    });

    return NextResponse.json({ results, count: results.length });
  } catch (err) {
    console.error('[Correlations] search error:', err);
    return NextResponse.json(
      { error: 'Failed to search correlations' },
      { status: 500 }
    );
  }
}
