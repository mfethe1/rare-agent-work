import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { agentProfileUpdateSchema } from '@/lib/a2a/validation';
import { updateAgentProfile, getAgentProfile } from '@/lib/a2a/discovery';

/**
 * PATCH /api/a2a/agents/profile — Update the authenticated agent's profile.
 *
 * Agents evolve — they add capabilities, change descriptions, and update
 * callback URLs. This endpoint lets an agent update its own profile
 * without re-registering.
 *
 * Only the owning agent can update its profile (enforced via auth).
 * At least one field must be provided.
 */
export async function PATCH(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  const parsed = await validateRequest(request, agentProfileUpdateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const updated = await updateAgentProfile(agent.id, parsed.data);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update profile.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      agent: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        callback_url: updated.callback_url,
        capabilities: updated.capabilities,
        trust_level: updated.trust_level,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'PATCH /api/a2a/agents/profile'),
      { status: 500 },
    );
  }
}

/**
 * GET /api/a2a/agents/profile — Get the authenticated agent's own profile.
 *
 * Convenience endpoint: returns the caller's enriched profile without
 * needing to know their own agent ID.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  try {
    const profile = await getAgentProfile(agent.id);

    if (!profile) {
      return NextResponse.json(
        { error: 'Agent profile not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ agent: profile });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/agents/profile'),
      { status: 500 },
    );
  }
}
