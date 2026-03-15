import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  federatedAgentSearchSchema,
  searchFederatedAgents,
} from '@/lib/a2a/federation';

/**
 * GET /api/a2a/federation/agents — Search for agents across federated peers.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const input = federatedAgentSearchSchema.parse({
      capability: url.searchParams.get('capability') ?? undefined,
      peer_id: url.searchParams.get('peer_id') ?? undefined,
      available_only: url.searchParams.get('available_only') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    const result = await searchFederatedAgents(input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/federation/agents'), { status: 500 });
  }
}
