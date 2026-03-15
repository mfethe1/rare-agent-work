import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getAgentProfile } from '@/lib/a2a/discovery';

/**
 * GET /api/a2a/agents/:id — Get an agent's enriched profile.
 *
 * Returns the agent's capabilities, availability, reputation score,
 * and active contract count. Any authenticated agent can view any
 * other agent's profile (this is the "yellow pages" — public info).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await authenticateAgent(request);
  if (!caller) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;

    // Basic UUID validation
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: 'Invalid agent ID format.' },
        { status: 400 },
      );
    }

    const profile = await getAgentProfile(id);

    if (!profile) {
      return NextResponse.json(
        { error: 'Agent not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ agent: profile }, {
      headers: { 'Cache-Control': 'private, max-age=10' },
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/agents/:id'),
      { status: 500 },
    );
  }
}
