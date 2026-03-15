import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { recordEpisode, listEpisodes, RecordEpisodeSchema } from '@/lib/a2a/memory';

/**
 * POST /api/a2a/memory/episodes — Record a new episodic memory
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
    const parsed = RecordEpisodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { bankId, type, summary, content, context, importance, valence, tags, relatedEpisodeIds } = parsed.data;
    const episode = recordEpisode(agent.id, bankId, type, summary, content, {
      context,
      importance,
      valence,
      tags,
      relatedEpisodeIds,
    });
    return NextResponse.json({ episode }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/memory/episodes error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/memory/episodes?bankId=...&limit=...
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get('bankId') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const agentEpisodes = listEpisodes(agent.id, bankId, limit);
    return NextResponse.json({ episodes: agentEpisodes });
  } catch (err) {
    console.error('GET /api/a2a/memory/episodes error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
