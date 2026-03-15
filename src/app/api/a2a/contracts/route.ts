import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  contractProposeSchema,
  contractListSchema,
  proposeContract,
  listContracts,
} from '@/lib/a2a/contracts';

/**
 * POST /api/a2a/contracts — Propose a new service contract.
 *
 * The authenticated agent becomes the consumer; the specified
 * provider_agent_id becomes the provider. A negotiation thread
 * is opened for the provider to accept, reject, or counter.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody('task.submit', rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  const parsed = await validateRequest(request, contractProposeSchema);
  if (!parsed.success) return parsed.response;

  if (parsed.data.provider_agent_id === agent.id) {
    return NextResponse.json({ error: 'Cannot propose a contract with yourself.' }, { status: 422 });
  }

  try {
    const result = await proposeContract({
      consumer_agent_id: agent.id,
      input: parsed.data,
    });

    if (!result) {
      return NextResponse.json({ error: 'Failed to create contract proposal.' }, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/contracts'), { status: 500 });
  }
}

/**
 * GET /api/a2a/contracts — List contracts for the authenticated agent.
 *
 * Query params: status, role (provider|consumer|any), capability, limit
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const params = {
    status: url.searchParams.get('status') ?? undefined,
    role: url.searchParams.get('role') ?? 'any',
    capability: url.searchParams.get('capability') ?? undefined,
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
  };

  const parseResult = contractListSchema.safeParse(params);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const contracts = await listContracts({
      agent_id: agent.id,
      ...parseResult.data,
    });

    return NextResponse.json({ contracts, count: contracts.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/contracts'), { status: 500 });
  }
}
