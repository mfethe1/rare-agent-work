/**
 * POST /api/a2a/temporal/clocks — Synchronize vector clocks between agents
 * GET  /api/a2a/temporal/clocks?agent_id=X — Get an agent's current vector clock
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  createVectorClock,
  merge as mergeVectorClocks,
  compare as compareVectorClocks,
  createTemporalCoordinate,
} from '@/lib/a2a/temporal';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, agentId, localClock, remoteClock } = body;

    if (!action || !agentId) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'action and agentId are required' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'create': {
        const clock = createVectorClock(agentId);
        return NextResponse.json({ clock }, { status: 201 });
      }

      case 'merge': {
        if (!localClock || !remoteClock) {
          return NextResponse.json(
            { error: 'localClock and remoteClock required for merge action' },
            { status: 400 },
          );
        }
        const merged = mergeVectorClocks(localClock, remoteClock, agentId);
        return NextResponse.json({ clock: merged });
      }

      case 'compare': {
        if (!localClock || !remoteClock) {
          return NextResponse.json(
            { error: 'localClock and remoteClock required for compare action' },
            { status: 400 },
          );
        }
        const order = compareVectorClocks(localClock, remoteClock);
        return NextResponse.json({ order });
      }

      case 'coordinate': {
        if (!localClock) {
          return NextResponse.json(
            { error: 'localClock required for coordinate action' },
            { status: 400 },
          );
        }
        const coordinate = createTemporalCoordinate(agentId, localClock);
        return NextResponse.json({ coordinate });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[a2a/temporal/clocks] POST error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = req.nextUrl.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }

    // In production, fetch persisted clock state
    return NextResponse.json({
      message: 'Clock retrieval requires persistent storage backend',
      agentId,
    });
  } catch (err) {
    console.error('[a2a/temporal/clocks] GET error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
