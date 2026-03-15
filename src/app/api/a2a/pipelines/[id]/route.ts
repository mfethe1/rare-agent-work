import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getPipeline, updatePipeline, pipelineUpdateSchema } from '@/lib/a2a/pipelines';

/**
 * GET /api/a2a/pipelines/:id — Get pipeline definition.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  const pipeline = await getPipeline(id);
  if (!pipeline) {
    return NextResponse.json({ error: 'Pipeline not found.' }, { status: 404 });
  }

  // Non-public pipelines are only visible to the owner
  if (!pipeline.is_public && pipeline.owner_agent_id !== agent.id) {
    return NextResponse.json({ error: 'Pipeline not found.' }, { status: 404 });
  }

  return NextResponse.json({ pipeline });
}

/**
 * PATCH /api/a2a/pipelines/:id — Update pipeline metadata or status.
 *
 * Only the owner agent can update their pipelines.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = pipelineUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request.', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const updated = await updatePipeline(id, agent.id, parsed.data);

    return NextResponse.json({
      pipeline_id: updated.id,
      status: updated.status,
      updated_at: updated.updated_at,
    });
  } catch (err) {
    console.error('[A2A Pipeline] Update failed:', err);
    return NextResponse.json({ error: 'Failed to update pipeline.' }, { status: 500 });
  }
}
