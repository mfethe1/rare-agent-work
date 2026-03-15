import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  policyCreateSchema,
  policyListSchema,
  createPolicy,
  listPolicies,
} from '@/lib/a2a/governance';

/**
 * POST /api/a2a/governance/policies — Create a governance policy for an agent.
 *
 * The authenticated agent creates a policy that constrains the target agent's
 * autonomy. Only partner-level agents or the platform can create policies.
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

  const parsed = await validateRequest(request, policyCreateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await createPolicy(agent.id, parsed.data);
    if (!result) {
      return NextResponse.json({ error: 'Failed to create governance policy.' }, { status: 500 });
    }

    return NextResponse.json({
      policy_id: result.policy_id,
      agent_id: parsed.data.agent_id,
      autonomy_level: parsed.data.autonomy_level,
      is_active: true,
      created_at: result.created_at,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/governance/policies'), { status: 500 });
  }
}

/**
 * GET /api/a2a/governance/policies — List governance policies.
 *
 * Query params: agent_id, is_active, limit
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const params = {
    agent_id: url.searchParams.get('agent_id') ?? undefined,
    is_active: url.searchParams.get('is_active') !== 'false',
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
  };

  const parseResult = policyListSchema.safeParse(params);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const policies = await listPolicies(parseResult.data);
    return NextResponse.json({ policies, count: policies.length });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/governance/policies'), { status: 500 });
  }
}
