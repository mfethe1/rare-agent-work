import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { crossover } from '@/lib/a2a/evolution/engine';
import { crossoverSchema } from '@/lib/a2a/evolution/validation';

/**
 * POST /api/a2a/evolution/:id/crossover — Breed two parent genomes
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
    const { id } = await params;
    const body = await request.json();
    const parsed = crossoverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = crossover(parsed.data, id);
    if (!result) {
      return NextResponse.json({ error: 'One or both parent genomes not found.' }, { status: 404 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/evolution/:id/crossover error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
