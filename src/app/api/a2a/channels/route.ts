import { NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { channelCreateSchema, channelListSchema } from '@/lib/a2a/channels/validation';
import { emitEvent } from '@/lib/a2a/webhooks';

/**
 * POST /api/a2a/channels — Create a messaging channel.
 *
 * Agents create channels to establish scoped, bidirectional communication
 * with other agents. Supports direct (1:1), group, and topic channels.
 *
 * Auth: Bearer token (agent API key) required.
 */
export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = channelCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { name, description, channel_type, target_agent_id, correlation_id, ttl_seconds } =
    parsed.data;

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // For direct channels, verify target agent exists
  if (channel_type === 'direct' && target_agent_id) {
    if (target_agent_id === agent.id) {
      return NextResponse.json(
        { error: 'Cannot create a direct channel with yourself.' },
        { status: 400 },
      );
    }
    const { data: target } = await db
      .from('agent_registry')
      .select('id')
      .eq('id', target_agent_id)
      .eq('is_active', true)
      .single();
    if (!target) {
      return NextResponse.json(
        { error: 'Target agent not found or inactive.' },
        { status: 404 },
      );
    }

    // Check if a direct channel already exists between these agents
    const { data: existing } = await db
      .from('a2a_channels')
      .select('id, a2a_channel_members!inner(agent_id)')
      .eq('channel_type', 'direct')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString());

    if (existing) {
      for (const ch of existing) {
        const members = (ch as Record<string, unknown>).a2a_channel_members as Array<{
          agent_id: string;
        }>;
        const memberIds = members.map((m) => m.agent_id);
        if (memberIds.includes(agent.id) && memberIds.includes(target_agent_id)) {
          return NextResponse.json(
            {
              error: 'A direct channel already exists between these agents.',
              existing_channel_id: ch.id,
            },
            { status: 409 },
          );
        }
      }
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl_seconds * 1000).toISOString();

  // Create the channel
  const { data: channel, error: chError } = await db
    .from('a2a_channels')
    .insert({
      name,
      description,
      channel_type,
      created_by: agent.id,
      correlation_id: correlation_id ?? null,
      ttl_seconds,
      expires_at: expiresAt,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select('id, name, channel_type, created_by, expires_at, created_at')
    .single();

  if (chError || !channel) {
    console.error('[A2A Channels] Create error:', chError);
    return NextResponse.json({ error: 'Failed to create channel.' }, { status: 500 });
  }

  // Add the creator as owner
  const membersToInsert: Array<{
    channel_id: string;
    agent_id: string;
    role: string;
  }> = [{ channel_id: channel.id, agent_id: agent.id, role: 'owner' }];

  // For direct channels, also add the target agent
  if (channel_type === 'direct' && target_agent_id) {
    membersToInsert.push({
      channel_id: channel.id,
      agent_id: target_agent_id,
      role: 'member',
    });
  }

  const { error: memError } = await db.from('a2a_channel_members').insert(membersToInsert);

  if (memError) {
    console.error('[A2A Channels] Add members error:', memError);
    // Clean up the channel
    await db.from('a2a_channels').delete().eq('id', channel.id);
    return NextResponse.json({ error: 'Failed to initialize channel members.' }, { status: 500 });
  }

  // Emit channel.created event
  emitEvent('channel.created' as Parameters<typeof emitEvent>[0], {
    channel_id: channel.id,
    channel_type,
    name,
    created_by: agent.id,
    agent_name: agent.name,
    correlation_id: correlation_id ?? null,
    members: membersToInsert.map((m) => m.agent_id),
  });

  return NextResponse.json(
    {
      channel_id: channel.id,
      name: channel.name,
      channel_type: channel.channel_type,
      created_by: channel.created_by,
      expires_at: channel.expires_at,
      created_at: channel.created_at,
    },
    {
      status: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  );
}

/**
 * GET /api/a2a/channels — List channels the agent is a member of.
 *
 * Returns channels with unread counts and last message timestamps.
 *
 * Auth: Bearer token (agent API key) required.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid agent API key.' },
      { status: 401 },
    );
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'context.read');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('context.read', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const url = new URL(request.url);
  const params: Record<string, unknown> = {};

  const channelType = url.searchParams.get('channel_type');
  const correlationId = url.searchParams.get('correlation_id');
  const activeOnly = url.searchParams.get('active_only');
  const limitParam = url.searchParams.get('limit');

  if (channelType) params.channel_type = channelType;
  if (correlationId) params.correlation_id = correlationId;
  if (activeOnly !== null) params.active_only = activeOnly !== 'false';
  if (limitParam) params.limit = parseInt(limitParam, 10);

  const parsed = channelListSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters.', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const query = parsed.data;
  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Get channel IDs where this agent is a member
  const { data: memberships, error: memErr } = await db
    .from('a2a_channel_members')
    .select('channel_id, role, last_read_at')
    .eq('agent_id', agent.id);

  if (memErr) {
    console.error('[A2A Channels] Membership query error:', memErr);
    return NextResponse.json({ error: 'Failed to query channels.' }, { status: 500 });
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json(
      { channels: [], count: 0 },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }

  const channelIds = memberships.map((m) => m.channel_id);
  const membershipMap = new Map(memberships.map((m) => [m.channel_id, m]));

  // Fetch channels
  let chQuery = db
    .from('a2a_channels')
    .select('*')
    .in('id', channelIds)
    .order('updated_at', { ascending: false })
    .limit(query.limit);

  if (query.active_only) {
    chQuery = chQuery.eq('is_active', true).gt('expires_at', new Date().toISOString());
  }
  if (query.channel_type) {
    chQuery = chQuery.eq('channel_type', query.channel_type);
  }
  if (query.correlation_id) {
    chQuery = chQuery.eq('correlation_id', query.correlation_id);
  }

  const { data: channels, error: chErr } = await chQuery;

  if (chErr) {
    console.error('[A2A Channels] Channel query error:', chErr);
    return NextResponse.json({ error: 'Failed to query channels.' }, { status: 500 });
  }

  // Enrich with unread counts
  const enriched = await Promise.all(
    (channels ?? []).map(async (ch) => {
      const membership = membershipMap.get(ch.id);
      const lastReadAt = membership?.last_read_at ?? ch.created_at;

      // Count messages after last_read_at
      const { count } = await db
        .from('a2a_channel_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .gt('created_at', lastReadAt);

      // Get last message timestamp
      const { data: lastMsg } = await db
        .from('a2a_channel_messages')
        .select('created_at')
        .eq('channel_id', ch.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        ...ch,
        role: membership?.role ?? 'member',
        unread_count: count ?? 0,
        last_message_at: lastMsg?.created_at ?? null,
      };
    }),
  );

  return NextResponse.json(
    { channels: enriched, count: enriched.length },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
