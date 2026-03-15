import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a';
import {
  getAgentReputation,
  getReputationLeaderboard,
} from '@/lib/a2a/reputation';

/**
 * GET /api/a2a/reputation — Query agent reputation scores.
 *
 * Query params:
 *   - agent_id: Get reputation for a specific agent
 *   - leaderboard: If "true", return top agents by reputation
 *   - limit: Max results for leaderboard (default 20, max 100)
 *
 * Requires agent authentication. Reputation data is transparent —
 * any authenticated agent can view any other agent's reputation.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const agentId = url.searchParams.get('agent_id');
  const leaderboard = url.searchParams.get('leaderboard');
  const limitParam = url.searchParams.get('limit');

  // Single agent reputation lookup
  if (agentId) {
    if (!/^[0-9a-f-]{36}$/.test(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent_id format.' },
        { status: 400 },
      );
    }

    const reputation = await getAgentReputation(agentId);
    if (!reputation) {
      return NextResponse.json(
        { error: 'No reputation data found for this agent.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ reputation });
  }

  // Leaderboard
  if (leaderboard === 'true') {
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
    const agents = await getReputationLeaderboard(limit);

    return NextResponse.json({
      leaderboard: agents,
      count: agents.length,
    });
  }

  // Default: return the caller's own reputation
  const selfReputation = await getAgentReputation(agent.id);

  return NextResponse.json({
    reputation: selfReputation ?? {
      agent_id: agent.id,
      reputation_score: 0,
      total_tasks: 0,
      total_ratings: 0,
      message: 'No reputation data yet. Complete tasks and receive feedback to build reputation.',
    },
  });
}
