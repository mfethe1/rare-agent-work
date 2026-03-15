import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { compareSimulations } from '@/lib/a2a/simulation/engine';
import { compareSimulationsSchema } from '@/lib/a2a/simulation/validation';

/**
 * POST /api/a2a/simulations/compare — Compare two simulation runs (A/B analysis)
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = compareSimulationsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const comparison = await compareSimulations(parsed.data);
    if (!comparison) {
      return NextResponse.json(
        { error: 'Both simulations must exist and be completed.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ comparison });
  } catch (err) {
    console.error('POST /api/a2a/simulations/compare error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
