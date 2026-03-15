import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getPopulation } from '@/lib/a2a/evolution/engine';

/**
 * GET /api/a2a/evolution/:id — Get population detail with genomes, fitness, and history
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
    const result = getPopulation(id);
    if (!result) {
      return NextResponse.json({ error: 'Population not found.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/evolution/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
