import { NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { channelAddMemberSchema } from '@/lib/a2a/channels/validation';
import { emitEvent } from '@/lib/a2a/webhooks';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/a2a/channels/:id/members — Add an agent to a channel.
 *
 * Only the channel owner (or any member for topic channels) can add members.
 * Direct channels are limited to 2 members (enforced by DB trigger).
 *
 * Auth: Bearer token (agent API key) required.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid agent API key.' },
      { status: 401 },
    );
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'context.write');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('context.write', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const { id: channelId } = await params;
  if (!UUID_RE.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel ID format.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = channelAddMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { agent_id: newAgentId, role } = parsed.data;
  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Verify channel exists and is active
  const { data: channel } = await db
    .from('a2a_channels')
    .select('id, channel_type, is_active, expires_at')
    .eq('id', channelId)
    .single();

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found.' }, { status: 404 });
  }
  if (!channel.is_active || new Date(channel.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Channel is archived or expired.' }, { status: 410 });
  }

  // Verify the requesting agent is a member
  const { data: callerMembership } = await db
    .from('a2a_channel_members')
    .select('role')
    .eq('channel_id', channelId)
    .eq('agent_id', agent.id)
    .single();

  if (!callerMembership) {
    return NextResponse.json(
      { error: 'You are not a member of this channel.' },
      { status: 403 },
    );
  }

  // For group channels, only owner can add members. Topic channels allow any member.
  if (channel.channel_type === 'group' && callerMembership.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the channel owner can add members to group channels.' },
      { status: 403 },
    );
  }

  if (channel.channel_type === 'direct') {
    return NextResponse.json(
      { error: 'Cannot add members to direct channels.' },
      { status: 400 },
    );
  }

  // Verify target agent exists
  const { data: targetAgent } = await db
    .from('agent_registry')
    .select('id, name')
    .eq('id', newAgentId)
    .eq('is_active', true)
    .single();

  if (!targetAgent) {
    return NextResponse.json({ error: 'Target agent not found or inactive.' }, { status: 404 });
  }

  // Add the member (UNIQUE constraint prevents duplicates)
  const { data: membership, error: memError } = await db
    .from('a2a_channel_members')
    .insert({
      channel_id: channelId,
      agent_id: newAgentId,
      role,
    })
    .select('id, channel_id, agent_id, role, joined_at')
    .single();

  if (memError) {
    if (memError.code === '23505') {
      return NextResponse.json(
        { error: 'Agent is already a member of this channel.' },
        { status: 409 },
      );
    }
    console.error('[A2A Channels] Add member error:', memError);
    return NextResponse.json({ error: 'Failed to add member.' }, { status: 500 });
  }

  emitEvent('channel.member_added' as Parameters<typeof emitEvent>[0], {
    channel_id: channelId,
    agent_id: newAgentId,
    agent_name: targetAgent.name,
    role,
    added_by: agent.id,
  });

  return NextResponse.json(
    {
      membership_id: membership.id,
      channel_id: membership.channel_id,
      agent_id: membership.agent_id,
      role: membership.role,
      joined_at: membership.joined_at,
    },
    {
      status: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  );
}

/**
 * DELETE /api/a2a/channels/:id/members?agent_id=<uuid> — Leave or remove an agent.
 *
 * Agents can remove themselves. Channel owners can remove others.
 *
 * Auth: Bearer token (agent API key) required.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid agent API key.' },
      { status: 401 },
    );
  }

  const { id: channelId } = await params;
  if (!UUID_RE.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel ID format.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const targetAgentId = url.searchParams.get('agent_id');
  if (!targetAgentId || !UUID_RE.test(targetAgentId)) {
    return NextResponse.json(
      { error: 'Missing or invalid agent_id query parameter.' },
      { status: 400 },
    );
  }

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // If removing someone else, must be owner
  if (targetAgentId !== agent.id) {
    const { data: callerMembership } = await db
      .from('a2a_channel_members')
      .select('role')
      .eq('channel_id', channelId)
      .eq('agent_id', agent.id)
      .single();

    if (!callerMembership || callerMembership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only channel owners can remove other members.' },
        { status: 403 },
      );
    }
  }

  const { error } = await db
    .from('a2a_channel_members')
    .delete()
    .eq('channel_id', channelId)
    .eq('agent_id', targetAgentId);

  if (error) {
    console.error('[A2A Channels] Remove member error:', error);
    return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 });
  }

  return NextResponse.json(
    { removed: true, channel_id: channelId, agent_id: targetAgentId },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
