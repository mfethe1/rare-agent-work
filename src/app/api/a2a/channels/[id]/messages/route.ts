import { NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { messageSendSchema, messageListSchema } from '@/lib/a2a/channels/validation';
import type { ProposalTally } from '@/lib/a2a/channels/types';
import { emitEvent } from '@/lib/a2a/webhooks';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Compute vote tally for a proposal message.
 */
async function computeTally(
  db: ReturnType<typeof getServiceDb>,
  channelId: string,
  proposalId: string,
): Promise<ProposalTally | null> {
  if (!db) return null;

  // Count votes by type
  const { data: votes } = await db
    .from('a2a_channel_messages')
    .select('vote')
    .eq('channel_id', channelId)
    .eq('proposal_id', proposalId)
    .eq('message_type', 'vote');

  // Count eligible voters (non-observer members)
  const { count: eligible } = await db
    .from('a2a_channel_members')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .neq('role', 'observer');

  const approve = votes?.filter((v) => v.vote === 'approve').length ?? 0;
  const reject = votes?.filter((v) => v.vote === 'reject').length ?? 0;
  const abstain = votes?.filter((v) => v.vote === 'abstain').length ?? 0;
  const totalVotes = approve + reject + abstain;
  const eligibleVoters = eligible ?? 0;
  const quorumReached = eligibleVoters > 0 && totalVotes > eligibleVoters / 2;

  let outcome: ProposalTally['outcome'] = null;
  if (quorumReached) {
    if (approve > reject) outcome = 'approve';
    else if (reject > approve) outcome = 'reject';
    else outcome = 'abstain'; // tie
  }

  return {
    proposal_id: proposalId,
    approve,
    reject,
    abstain,
    total_votes: totalVotes,
    eligible_voters: eligibleVoters,
    quorum_reached: quorumReached,
    outcome,
  };
}

/**
 * POST /api/a2a/channels/:id/messages — Send a message to a channel.
 *
 * Supports text, request/response, proposal/vote, and notification message types.
 * Only channel members with write access (owner, member) can send messages.
 * Observers can only read.
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

  const parsed = messageSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { message_type, content, reply_to, proposal_id, vote, metadata } = parsed.data;
  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Verify channel exists and is active
  const { data: channel } = await db
    .from('a2a_channels')
    .select('id, is_active, expires_at')
    .eq('id', channelId)
    .single();

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found.' }, { status: 404 });
  }
  if (!channel.is_active || new Date(channel.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Channel is archived or expired.' }, { status: 410 });
  }

  // Verify sender is a member with write access
  const { data: membership } = await db
    .from('a2a_channel_members')
    .select('role')
    .eq('channel_id', channelId)
    .eq('agent_id', agent.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this channel.' },
      { status: 403 },
    );
  }
  if (membership.role === 'observer') {
    return NextResponse.json(
      { error: 'Observers cannot send messages. Request a member or owner role.' },
      { status: 403 },
    );
  }

  // If replying to a message, verify it exists in this channel
  if (reply_to) {
    const { data: parent } = await db
      .from('a2a_channel_messages')
      .select('id')
      .eq('id', reply_to)
      .eq('channel_id', channelId)
      .single();
    if (!parent) {
      return NextResponse.json(
        { error: 'Reply target message not found in this channel.' },
        { status: 404 },
      );
    }
  }

  // If voting, verify the proposal exists and is a proposal type
  if (message_type === 'vote' && proposal_id) {
    const { data: proposal } = await db
      .from('a2a_channel_messages')
      .select('id, message_type')
      .eq('id', proposal_id)
      .eq('channel_id', channelId)
      .single();
    if (!proposal || proposal.message_type !== 'proposal') {
      return NextResponse.json(
        { error: 'Proposal message not found in this channel.' },
        { status: 404 },
      );
    }
  }

  // Insert the message
  const { data: message, error: msgError } = await db
    .from('a2a_channel_messages')
    .insert({
      channel_id: channelId,
      sender_agent_id: agent.id,
      message_type,
      content,
      reply_to: reply_to ?? null,
      proposal_id: proposal_id ?? null,
      vote: vote ?? null,
      metadata: metadata ?? null,
    })
    .select('id, channel_id, sender_agent_id, message_type, created_at')
    .single();

  if (msgError) {
    // Unique vote constraint violation
    if (msgError.code === '23505') {
      return NextResponse.json(
        { error: 'You have already voted on this proposal.' },
        { status: 409 },
      );
    }
    console.error('[A2A Channels] Send message error:', msgError);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }

  // Update sender's last_read_at
  await db
    .from('a2a_channel_members')
    .update({ last_read_at: message.created_at })
    .eq('channel_id', channelId)
    .eq('agent_id', agent.id);

  // Build response
  const response: Record<string, unknown> = {
    message_id: message.id,
    channel_id: message.channel_id,
    sender_agent_id: message.sender_agent_id,
    message_type: message.message_type,
    created_at: message.created_at,
  };

  // For proposals, include initial tally; for votes, include updated tally
  if (message_type === 'proposal') {
    const { count: eligible } = await db
      .from('a2a_channel_members')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .neq('role', 'observer');

    response.tally = {
      proposal_id: message.id,
      approve: 0,
      reject: 0,
      abstain: 0,
      total_votes: 0,
      eligible_voters: eligible ?? 0,
      quorum_reached: false,
      outcome: null,
    };
  } else if (message_type === 'vote' && proposal_id) {
    response.tally = await computeTally(db, channelId, proposal_id);
  }

  // Emit message event (fire-and-forget)
  emitEvent('channel.message' as Parameters<typeof emitEvent>[0], {
    channel_id: channelId,
    message_id: message.id,
    sender_agent_id: agent.id,
    sender_name: agent.name,
    message_type,
    has_content: Object.keys(content).length > 0,
    reply_to: reply_to ?? null,
    proposal_id: proposal_id ?? null,
    vote: vote ?? null,
  });

  return NextResponse.json(response, {
    status: 201,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

/**
 * GET /api/a2a/channels/:id/messages — List messages in a channel.
 *
 * Supports cursor-based pagination, filtering by type/sender/thread.
 * Also returns proposal tallies for any proposal messages in the result.
 * Updates the agent's last_read_at on access.
 *
 * Auth: Bearer token (agent API key) required.
 */
export async function GET(
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

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'context.read');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('context.read', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const { id: channelId } = await params;
  if (!UUID_RE.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel ID format.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const queryParams: Record<string, unknown> = {};

  const messageType = url.searchParams.get('message_type');
  const senderAgentId = url.searchParams.get('sender_agent_id');
  const threadId = url.searchParams.get('thread_id');
  const before = url.searchParams.get('before');
  const limitParam = url.searchParams.get('limit');

  if (messageType) queryParams.message_type = messageType;
  if (senderAgentId) queryParams.sender_agent_id = senderAgentId;
  if (threadId) queryParams.thread_id = threadId;
  if (before) queryParams.before = before;
  if (limitParam) queryParams.limit = parseInt(limitParam, 10);

  const parsed = messageListSchema.safeParse(queryParams);
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

  // Verify the agent is a member of this channel
  const { data: membership } = await db
    .from('a2a_channel_members')
    .select('role')
    .eq('channel_id', channelId)
    .eq('agent_id', agent.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this channel.' },
      { status: 403 },
    );
  }

  // Build message query
  let msgQuery = db
    .from('a2a_channel_messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(query.limit);

  if (query.message_type) {
    msgQuery = msgQuery.eq('message_type', query.message_type);
  }
  if (query.sender_agent_id) {
    msgQuery = msgQuery.eq('sender_agent_id', query.sender_agent_id);
  }
  if (query.thread_id) {
    msgQuery = msgQuery.eq('reply_to', query.thread_id);
  }
  if (query.before) {
    msgQuery = msgQuery.lt('created_at', query.before);
  }

  const { data: messages, error: msgErr } = await msgQuery;

  if (msgErr) {
    console.error('[A2A Channels] List messages error:', msgErr);
    return NextResponse.json({ error: 'Failed to list messages.' }, { status: 500 });
  }

  // Compute tallies for any proposal messages in the result
  const tallies: Record<string, ProposalTally> = {};
  const proposalMessages = (messages ?? []).filter((m) => m.message_type === 'proposal');
  await Promise.all(
    proposalMessages.map(async (p) => {
      const tally = await computeTally(db, channelId, p.id);
      if (tally) tallies[p.id] = tally;
    }),
  );

  // Update last_read_at for this agent
  await db
    .from('a2a_channel_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('channel_id', channelId)
    .eq('agent_id', agent.id);

  // Compute pagination cursor
  const oldestMessage = messages && messages.length > 0
    ? messages[messages.length - 1]
    : null;
  const nextCursor = oldestMessage ? oldestMessage.created_at : null;

  return NextResponse.json(
    {
      messages: messages ?? [],
      count: messages?.length ?? 0,
      next_cursor: nextCursor,
      tallies,
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
