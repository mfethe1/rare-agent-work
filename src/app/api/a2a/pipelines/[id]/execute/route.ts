import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  getPipeline,
  createExecution,
  executePipeline,
  pipelineExecuteSchema,
} from '@/lib/a2a/pipelines';

/**
 * POST /api/a2a/pipelines/:id/execute — Trigger a pipeline execution.
 *
 * Creates an execution record and begins processing stages sequentially.
 * Each stage invokes a capability (platform intent or agent task) and
 * feeds its output to the next stage through field mapping.
 *
 * Returns immediately with the execution ID; stages run asynchronously.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id: pipelineId } = await params;
    const pipeline = await getPipeline(pipelineId);
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found.' }, { status: 404 });
    }

    if (pipeline.status !== 'active') {
      return NextResponse.json(
        { error: `Pipeline is ${pipeline.status}. Only active pipelines can be executed.` },
        { status: 409 },
      );
    }

    const body = await req.json();
    const parsed = pipelineExecuteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request.', details: parsed.error.issues },
        { status: 400 },
      );
    }

    // Create execution record
    const execution = await createExecution(
      pipelineId,
      agent.id,
      parsed.data.input,
      pipeline.stages,
      parsed.data.correlation_id,
    );

    // Run pipeline asynchronously (don't await — return immediately)
    executePipeline(pipeline, execution.id, parsed.data.input).catch(err => {
      console.error(`[A2A Pipeline] Execution ${execution.id} failed:`, err);
    });

    return NextResponse.json(
      {
        execution_id: execution.id,
        pipeline_id: pipelineId,
        status: 'pending',
        progress: 0,
        status_url: `/api/a2a/pipelines/${pipelineId}/executions/${execution.id}`,
        created_at: execution.created_at,
      },
      { status: 202, headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    console.error('[A2A Pipeline] Execute failed:', err);
    return NextResponse.json({ error: 'Failed to execute pipeline.' }, { status: 500 });
  }
}
