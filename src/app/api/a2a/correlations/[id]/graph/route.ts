/**
 * GET /api/a2a/correlations/:id/graph — Get the full causal graph
 *
 * Returns the complete DAG of events with causal edges, domain lanes,
 * and summary statistics. This is the primary endpoint for agents that
 * need to understand the full story of a multi-step operation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getCausalGraph } from '@/lib/a2a/events/correlation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const graph = await getCausalGraph(id);

    return NextResponse.json(graph);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Correlation context not found' }, { status: 404 });
    }
    console.error('[Correlations] GET/:id/graph error:', err);
    return NextResponse.json(
      { error: 'Failed to build causal graph' },
      { status: 500 }
    );
  }
}
