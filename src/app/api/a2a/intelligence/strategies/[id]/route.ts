import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  getStrategy,
  retireStrategy,
  promoteStrategy,
  evaluatePerformance,
  getStrategyLineage,
} from '@/lib/a2a/intelligence';

/**
 * GET /api/a2a/intelligence/strategies/:id — Get strategy details with performance
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const strategy = getStrategy(id);
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    const performance = evaluatePerformance(id);
    const lineage = getStrategyLineage(id);
    return NextResponse.json({ strategy, performance, lineage });
  } catch (err) {
    console.error('GET /api/a2a/intelligence/strategies/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * PATCH /api/a2a/intelligence/strategies/:id — Promote or retire a strategy
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body as { action: 'promote' | 'retire' };

    let strategy;
    if (action === 'promote') {
      strategy = promoteStrategy(id);
    } else if (action === 'retire') {
      strategy = retireStrategy(id);
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "promote" or "retire".' }, { status: 422 });
    }

    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found or invalid state transition' }, { status: 404 });
    }

    return NextResponse.json({ strategy });
  } catch (err) {
    console.error('PATCH /api/a2a/intelligence/strategies/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
