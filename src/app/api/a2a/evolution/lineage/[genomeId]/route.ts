import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getLineage } from '@/lib/a2a/evolution/engine';

/**
 * GET /api/a2a/evolution/lineage/:genomeId — Get full genealogy tree for a genome
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ genomeId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { genomeId } = await params;
    const result = getLineage(genomeId);
    if (!result) {
      return NextResponse.json({ error: 'Genome not found.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/evolution/lineage/:genomeId error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
