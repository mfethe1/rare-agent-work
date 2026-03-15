import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { evaluateFitness } from '@/lib/a2a/evolution/engine';
import { evaluateFitnessSchema } from '@/lib/a2a/evolution/validation';

/**
 * POST /api/a2a/evolution/:id/fitness — Submit fitness evaluation for a genome
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    await params; // acknowledge population context
    const body = await request.json();
    const parsed = evaluateFitnessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = evaluateFitness(parsed.data);
    if (!result) {
      return NextResponse.json({ error: 'Genome not found.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/a2a/evolution/:id/fitness error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
