import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { createCampaign, listCampaigns } from '@/lib/a2a/sandbox/engine';
import { createCampaignSchema, listCampaignsSchema } from '@/lib/a2a/sandbox/validation';

/**
 * POST /api/a2a/sandbox/campaigns — Create an evaluation campaign
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
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await createCampaign(agent.id, parsed.data);
    if (!result) {
      return NextResponse.json(safeErrorBody(), { status: 500 });
    }

    return NextResponse.json({
      campaign_id: result.campaign_id,
      agent_id: parsed.data.agent_id,
      type: parsed.data.type,
      scenarios_count: parsed.data.scenarios.length,
      status: 'draft',
      created_at: result.created_at,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/sandbox/campaigns error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/sandbox/campaigns — List evaluation campaigns
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listCampaignsSchema.safeParse({
      agent_id: searchParams.get('agent_id') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const campaigns = await listCampaigns(parsed.data);
    return NextResponse.json({ campaigns, count: campaigns.length });
  } catch (err) {
    console.error('GET /api/a2a/sandbox/campaigns error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
