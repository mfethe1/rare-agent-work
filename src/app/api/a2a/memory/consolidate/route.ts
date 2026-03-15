import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { consolidate, ConsolidateSchema } from '@/lib/a2a/memory';

/**
 * POST /api/a2a/memory/consolidate — Consolidate episodes into distilled memory
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const body = await request.json();
    const parsed = ConsolidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { bankId, sourceEpisodeIds, strategy } = parsed.data;
    const consolidation = consolidate(agent.id, bankId, sourceEpisodeIds, strategy);
    return NextResponse.json({ consolidation }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/memory/consolidate error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
