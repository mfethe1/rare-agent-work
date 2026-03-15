import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { planPipeline, pipelinePlanSchema } from '@/lib/a2a/pipelines';

/**
 * POST /api/a2a/pipelines/plan — Auto-compose a pipeline plan.
 *
 * Given an input schema (data you have) and a desired output schema
 * (data you need), the planner searches available capability schemas
 * to find chains of capabilities that transform input → output.
 *
 * Returns up to 3 ranked plans with confidence scores and
 * candidate agents for each stage.
 */
export async function POST(req: Request) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
    if (!rl.allowed) {
      return NextResponse.json(rateLimitBody('task.submit', rl), {
        status: 429,
        headers: rateLimitHeaders(rl),
      });
    }

    const body = await req.json();
    const parsed = pipelinePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request.', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const plans = await planPipeline(parsed.data);

    return NextResponse.json(
      { plans, count: plans.length },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    console.error('[A2A Pipeline] Plan failed:', err);
    return NextResponse.json({ error: 'Failed to plan pipeline.' }, { status: 500 });
  }
}
