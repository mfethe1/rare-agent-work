import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getEnsemble } from '@/lib/a2a/ensemble/engine';

/**
 * GET /api/a2a/ensembles/:ensembleId — Get ensemble details with members and active rounds
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ensembleId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { ensembleId } = await params;
    const result = await getEnsemble(ensembleId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/a2a/ensembles/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
