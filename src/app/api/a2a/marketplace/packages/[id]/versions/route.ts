import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { publishVersionSchema, publishVersion } from '@/lib/a2a/marketplace';

/**
 * POST /api/a2a/marketplace/packages/:id/versions — Publish a new version.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const input = publishVersionSchema.parse(body);

    const version = await publishVersion({
      package_id: id,
      publisher_agent_id: agent.id,
      version: input.version,
      changelog: input.changelog,
      input_schema: input.input_schema,
      output_schema: input.output_schema,
      dependencies: input.dependencies,
    });

    return NextResponse.json(
      {
        version_id: version.id,
        package_id: version.package_id,
        version: version.version,
        verified: version.verified,
        created_at: version.created_at,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[marketplace/versions/publish]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
