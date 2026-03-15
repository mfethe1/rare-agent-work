import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  getExperiment,
  evaluateExperiment,
  selectStrategyForExperiment,
} from '@/lib/a2a/intelligence';

/**
 * GET /api/a2a/intelligence/experiments/:id — Get experiment details
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
    const experiment = getExperiment(id);
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }
    return NextResponse.json({ experiment });
  } catch (err) {
    console.error('GET /api/a2a/intelligence/experiments/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * POST /api/a2a/intelligence/experiments/:id — Evaluate or select strategy
 * body: { action: "evaluate" | "select" }
 */
export async function POST(
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
    const { action } = body as { action: string };

    if (action === 'evaluate') {
      const experiment = evaluateExperiment(id);
      if (!experiment) {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      return NextResponse.json({ experiment });
    }

    if (action === 'select') {
      const strategyId = selectStrategyForExperiment(id);
      if (!strategyId) {
        return NextResponse.json({ error: 'Experiment not found or not running' }, { status: 404 });
      }
      return NextResponse.json({ strategyId });
    }

    return NextResponse.json({ error: 'Invalid action. Use "evaluate" or "select".' }, { status: 422 });
  } catch (err) {
    console.error('POST /api/a2a/intelligence/experiments/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
