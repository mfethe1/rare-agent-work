import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { createWorkflowDefinition } from '@/lib/a2a/workflow-engine';
import type { CreateWorkflowRequest } from '@/lib/a2a/workflow-types';

/**
 * POST /api/a2a/workflows — Create a new workflow definition.
 *
 * Accepts a DAG of steps that describe a multi-agent collaboration.
 * Validates DAG integrity (no cycles, valid references) before persisting.
 */
export async function POST(req: Request) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Rate limit
    const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
    if (!rl.allowed) {
      return NextResponse.json(rateLimitBody('task.submit', rl), {
        status: 429,
        headers: rateLimitHeaders(rl),
      });
    }

    const body = (await req.json()) as CreateWorkflowRequest;

    if (!body.name || !body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Required: name (string), steps (non-empty array).' },
        { status: 400 },
      );
    }

    // Validate step structure
    for (const step of body.steps) {
      if (!step.step_id || !step.intent || !step.agent_target) {
        return NextResponse.json(
          { error: `Step "${step.step_id ?? '(unnamed)'}" missing required fields: step_id, intent, agent_target.` },
          { status: 400 },
        );
      }
      if (!step.depends_on) step.depends_on = [];
      if (!step.input_template) step.input_template = {};
    }

    const result = await createWorkflowDefinition(agent.id, body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        workflow_id: result.definition!.id,
        name: result.definition!.name,
        version: result.definition!.version,
        steps: result.definition!.steps.length,
        created_at: result.definition!.created_at,
        trigger_url: `/api/a2a/workflows/${result.definition!.id}/trigger`,
      },
      { status: 201, headers: rateLimitHeaders(rl) },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}

/**
 * GET /api/a2a/workflows — List workflow definitions (optionally filtered by creator).
 */
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { getServiceDb } = await import('@/lib/a2a/auth');
  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  const url = new URL(req.url);
  const creatorOnly = url.searchParams.get('mine') === 'true';

  let query = db
    .from('a2a_workflow_definitions')
    .select('id, name, description, version, creator_agent_id, timeout_seconds, max_parallelism, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (creatorOnly) {
    query = query.eq('creator_agent_id', agent.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[A2A Workflow] List failed:', error);
    return NextResponse.json({ error: 'Failed to list workflows.' }, { status: 500 });
  }

  return NextResponse.json({
    workflows: (data ?? []).map((w) => ({
      ...w,
      trigger_url: `/api/a2a/workflows/${w.id}/trigger`,
    })),
    count: data?.length ?? 0,
  });
}
