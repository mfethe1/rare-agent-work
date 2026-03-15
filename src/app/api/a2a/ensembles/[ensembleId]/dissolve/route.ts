import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { dissolveEnsemble } from '@/lib/a2a/ensemble/engine';
import { dissolveSchema } from '@/lib/a2a/ensemble/validation';

/**
 * POST /api/a2a/ensembles/:ensembleId/dissolve — Dissolve an ensemble
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ensembleId: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { ensembleId } = await params;
    const body = await request.json();
    const parsed = dissolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await dissolveEnsemble({
      requester_agent_id: agent.id,
      ensemble_id: ensembleId,
      input: parsed.data,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/a2a/ensembles/:id/dissolve error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
