import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { listGenomesForPopulation } from '@/lib/a2a/evolution/engine';

/**
 * GET /api/a2a/evolution/:id/genomes — List all genomes in a population
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
    const genomes = listGenomesForPopulation(id);
    return NextResponse.json({ genomes, total: genomes.length });
  } catch (err) {
    console.error('GET /api/a2a/evolution/:id/genomes error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
