import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  shareEpisode,
  revokeShare,
  listShares,
  getSharedEpisodes,
  ShareEpisodeSchema,
  RevokeShareSchema,
} from '@/lib/a2a/memory';

/**
 * POST /api/a2a/memory/share — Share an episode with other agents
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
    const parsed = ShareEpisodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { episodeId, visibility, targetAgentIds, redactFields, expiresAt, allowReshare } = parsed.data;
    const share = shareEpisode(agent.id, episodeId, visibility, {
      targetAgentIds,
      redactFields,
      expiresAt,
      allowReshare,
    });
    return NextResponse.json({ share }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/memory/share error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * DELETE /api/a2a/memory/share — Revoke a memory share
 */
export async function DELETE(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = RevokeShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const revoked = revokeShare(parsed.data.shareId, agent.id);
    if (!revoked) {
      return NextResponse.json({ error: 'Share not found or not owned by you.' }, { status: 404 });
    }
    return NextResponse.json({ revoked: true });
  } catch (err) {
    console.error('DELETE /api/a2a/memory/share error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/memory/share — List shares you've created, or episodes shared with you
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') ?? 'outgoing';

    if (mode === 'incoming') {
      const sharedEpisodes = getSharedEpisodes(agent.id);
      return NextResponse.json({ episodes: sharedEpisodes });
    }

    const agentShares = listShares(agent.id);
    return NextResponse.json({ shares: agentShares });
  } catch (err) {
    console.error('GET /api/a2a/memory/share error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
