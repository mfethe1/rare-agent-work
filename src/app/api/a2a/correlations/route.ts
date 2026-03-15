/**
 * POST /api/a2a/correlations — Create a correlation context
 * GET  /api/a2a/correlations — List correlation contexts for an agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  createCorrelationContext,
  listCorrelationContexts,
} from '@/lib/a2a/events/correlation';

export async function POST(request: NextRequest) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'name is required and must be a string' },
        { status: 400 }
      );
    }

    const context = await createCorrelationContext({
      name: body.name,
      description: body.description,
      initiator_id: agent.id,
      root_event_id: body.root_event_id,
      metadata: body.metadata,
    });

    return NextResponse.json(context, { status: 201 });
  } catch (err) {
    console.error('[Correlations] POST error:', err);
    return NextResponse.json(
      { error: 'Failed to create correlation context' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as
      | 'active' | 'completed' | 'failed' | 'cancelled'
      | null;
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

    const contexts = await listCorrelationContexts(agent.id, {
      status: status ?? undefined,
      limit: Math.min(limit, 100),
      offset,
    });

    return NextResponse.json({ contexts, count: contexts.length });
  } catch (err) {
    console.error('[Correlations] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to list correlation contexts' },
      { status: 500 }
    );
  }
}
