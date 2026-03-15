import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  createPipeline,
  listPipelines,
  analyzeCompatibility,
  pipelineCreateSchema,
  pipelineListSchema,
} from '@/lib/a2a/pipelines';
import type { PipelineStage } from '@/lib/a2a/pipelines';

/**
 * POST /api/a2a/pipelines — Create a new pipeline definition.
 *
 * Agents compose multi-step data-flow pipelines where each stage invokes
 * a capability and feeds its output to the next stage. The platform
 * validates inter-stage schema compatibility on creation.
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
    const parsed = pipelineCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request.', details: parsed.error.issues },
        { status: 400 },
      );
    }

    // Check for duplicate stage IDs
    const stageIds = parsed.data.stages.map(s => s.stage_id);
    if (new Set(stageIds).size !== stageIds.length) {
      return NextResponse.json({ error: 'Duplicate stage_id values.' }, { status: 400 });
    }

    // Analyze inter-stage compatibility
    const stages = parsed.data.stages as PipelineStage[];
    const compatibilityReport = await analyzeCompatibility(
      stages,
      parsed.data.input_schema as Record<string, unknown> | undefined,
    );

    const pipeline = await createPipeline(agent.id, {
      ...parsed.data,
      stages,
      input_schema: parsed.data.input_schema as Record<string, unknown> | undefined,
      output_schema: parsed.data.output_schema as Record<string, unknown> | undefined,
    });

    return NextResponse.json(
      {
        pipeline_id: pipeline.id,
        name: pipeline.name,
        status: pipeline.status,
        stages_count: pipeline.stages.length,
        compatibility_report: compatibilityReport,
        created_at: pipeline.created_at,
        execute_url: `/api/a2a/pipelines/${pipeline.id}/execute`,
      },
      { status: 201, headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    console.error('[A2A Pipeline] Create failed:', err);
    return NextResponse.json({ error: 'Failed to create pipeline.' }, { status: 500 });
  }
}

/**
 * GET /api/a2a/pipelines — List pipeline definitions.
 *
 * Supports filtering by owner, status, tag, and visibility.
 */
export async function GET(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const params = pipelineListSchema.safeParse({
    owner_agent_id: url.searchParams.get('owner') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    tag: url.searchParams.get('tag') ?? undefined,
    is_public: url.searchParams.has('public') ? url.searchParams.get('public') === 'true' : undefined,
    limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
  });

  if (!params.success) {
    return NextResponse.json({ error: 'Invalid query parameters.' }, { status: 400 });
  }

  const { pipelines, count } = await listPipelines(params.data);

  return NextResponse.json({ pipelines, count });
}
