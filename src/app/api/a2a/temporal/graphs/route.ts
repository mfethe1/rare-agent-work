/**
 * POST /api/a2a/temporal/graphs — Create a causal graph
 * GET  /api/a2a/temporal/graphs?graph_id=X — Get a causal graph
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { createCausalGraph, addNode, addEdge } from '@/lib/a2a/temporal';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, collaborators } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid request', details: 'name is required' }, { status: 400 });
    }

    const graph = createCausalGraph({
      name,
      owner: auth.agentId!,
      collaborators: collaborators ?? [],
    });

    return NextResponse.json({ graph }, { status: 201 });
  } catch (err) {
    console.error('[a2a/temporal/graphs] POST error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const graphId = req.nextUrl.searchParams.get('graph_id');
    if (!graphId) {
      return NextResponse.json({ error: 'graph_id query parameter required' }, { status: 400 });
    }

    // In production, this would fetch from persistent storage
    return NextResponse.json({
      message: 'Graph retrieval requires persistent storage backend',
      graphId,
    });
  } catch (err) {
    console.error('[a2a/temporal/graphs] GET error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
