import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getSimulation, getSimulationTwins } from '@/lib/a2a/simulation/engine';

/**
 * GET /api/a2a/simulations/:id — Get simulation details with twins
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const simulation = await getSimulation(id);
    if (!simulation) {
      return NextResponse.json({ error: 'Simulation not found.' }, { status: 404 });
    }

    const twins = await getSimulationTwins(id);
    return NextResponse.json({ simulation, twins });
  } catch (err) {
    console.error('GET /api/a2a/simulations/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
