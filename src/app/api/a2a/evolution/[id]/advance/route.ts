import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { advanceGeneration } from '@/lib/a2a/evolution/engine';

/**
 * POST /api/a2a/evolution/:id/advance — Advance population to next generation
 *
 * Runs selection, crossover, mutation, and speciation to produce a new generation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const { id } = await params;
    const result = advanceGeneration(id);
    if (!result) {
      return NextResponse.json({ error: 'Population not found or not active.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/a2a/evolution/:id/advance error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
