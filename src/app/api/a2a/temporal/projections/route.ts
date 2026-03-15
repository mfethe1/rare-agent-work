/**
 * POST /api/a2a/temporal/projections — Generate future projections
 *
 * Accepts a causal graph and changed node IDs, returns predicted future states
 * using the specified projection method (or ensemble by default).
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  projectByCausalPropagation,
  projectByPatternExtrapolation,
  projectByMonteCarlo,
  projectByEnsemble,
} from '@/lib/a2a/temporal';
import type { CausalGraph, TemporalEvent, ProjectionMethod, TemporalWindow } from '@/lib/a2a/temporal';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      graph,
      events,
      changedNodeIds,
      horizon,
      method = 'ensemble',
    }: {
      graph: CausalGraph;
      events?: TemporalEvent[];
      changedNodeIds: string[];
      horizon: TemporalWindow;
      method?: ProjectionMethod;
    } = body;

    if (!graph || !changedNodeIds || !horizon) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'graph, changedNodeIds, and horizon are required' },
        { status: 400 },
      );
    }

    let projection;
    switch (method) {
      case 'causal_propagation':
        projection = projectByCausalPropagation(graph, changedNodeIds, horizon);
        break;
      case 'pattern_extrapolation':
        projection = projectByPatternExtrapolation(events ?? [], horizon);
        break;
      case 'monte_carlo':
        projection = projectByMonteCarlo(graph, changedNodeIds, horizon);
        break;
      case 'ensemble':
      default:
        projection = projectByEnsemble(graph, events ?? [], changedNodeIds, horizon);
        break;
    }

    return NextResponse.json({ projection });
  } catch (err) {
    console.error('[a2a/temporal/projections] POST error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
