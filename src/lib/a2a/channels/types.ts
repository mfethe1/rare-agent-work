/**
 * A2A Messaging Channels — Types
 *
 * Provides lightweight, scoped, bidirectional communication between agents.
 * Channels are the missing primitive between heavyweight task submission and
 * global context stores — enabling negotiation, consensus, and real-time
 * collaboration between specific agent groups.
 *
 * Channel types:
 *   - direct:  1:1 private channel between two agents
 *   - group:   Multi-agent channel with explicit membership
 *   - topic:   Open channel any agent can join (pub/sub style)
 *
 * Message types:
 *   - text:        Free-form structured message
 *   - request:     Expects a response (includes reply_to tracking)
 *   - response:    Reply to a request message
 *   - proposal:    Agent proposes an action/decision for others to vote on
 *   - vote:        Cast a vote on a proposal (approve/reject/abstain)
 *   - notification: Fire-and-forget informational message
 */

// ──────────────────────────────────────────────
// Channel Definitions
// ──────────────────────────────────────────────

export type ChannelType = 'direct' | 'group' | 'topic';

/** A communication channel between agents. */
export interface A2AChannel {
  /** Platform-assigned channel ID (UUID). */
  id: string;
  /** Human-readable channel name. */
  name: string;
  /** What this channel is for. */
  description: string;
  /** Channel type determines membership rules. */
  channel_type: ChannelType;
  /** Agent that created this channel. */
  created_by: string;
  /** Optional: link to a task or workflow for scoped channels. */
  correlation_id?: string;
  /** Whether the channel accepts new messages. */
  is_active: boolean;
  /** TTL in seconds — channel auto-archives after inactivity. */
  ttl_seconds: number;
  /** When this channel expires (updated on each message). */
  expires_at: string;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Channel Membership
// ──────────────────────────────────────────────

export type MemberRole = 'owner' | 'member' | 'observer';

/** An agent's membership in a channel. */
export interface ChannelMember {
  /** Platform-assigned membership ID (UUID). */
  id: string;
  channel_id: string;
  agent_id: string;
  /** Role determines write access (observer = read-only). */
  role: MemberRole;
  /** When this agent joined. */
  joined_at: string;
  /** Last message this agent has read (for unread tracking). */
  last_read_at: string;
}

// ──────────────────────────────────────────────
// Messages
// ──────────────────────────────────────────────

export type MessageType =
  | 'text'
  | 'request'
  | 'response'
  | 'proposal'
  | 'vote'
  | 'notification';

export type VoteValue = 'approve' | 'reject' | 'abstain';

/** A message within a channel. */
export interface ChannelMessage {
  /** Platform-assigned message ID (UUID). */
  id: string;
  /** Channel this message belongs to. */
  channel_id: string;
  /** Agent that sent this message. */
  sender_agent_id: string;
  /** Message classification. */
  message_type: MessageType;
  /** Structured message payload. */
  content: Record<string, unknown>;
  /** Optional: ID of the message this is replying to (for threads). */
  reply_to?: string;
  /** Optional: for vote messages, the proposal message ID being voted on. */
  proposal_id?: string;
  /** Optional: for vote messages, the vote value. */
  vote?: VoteValue;
  /** Optional metadata tags for filtering. */
  metadata?: Record<string, unknown>;
  /** ISO-8601 timestamps. */
  created_at: string;
}

// ──────────────────────────────────────────────
// Proposal Tally (computed from vote messages)
// ──────────────────────────────────────────────

/** Aggregated vote counts for a proposal message. */
export interface ProposalTally {
  proposal_id: string;
  approve: number;
  reject: number;
  abstain: number;
  total_votes: number;
  /** Total channel members eligible to vote (excludes observers). */
  eligible_voters: number;
  /** Whether quorum (>50% of eligible voters) has been reached. */
  quorum_reached: boolean;
  /** The winning outcome if quorum is reached, null otherwise. */
  outcome: VoteValue | null;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/channels — create a channel. */
export interface ChannelCreateRequest {
  name: string;
  description: string;
  channel_type: ChannelType;
  /** For direct channels: the other agent's ID. */
  target_agent_id?: string;
  /** Optional: link to task/workflow. */
  correlation_id?: string;
  /** TTL in seconds (default: 24h). */
  ttl_seconds?: number;
}

export interface ChannelCreateResponse {
  channel_id: string;
  name: string;
  channel_type: ChannelType;
  created_by: string;
  expires_at: string;
  created_at: string;
}

/** GET /api/a2a/channels — list agent's channels. */
export interface ChannelListResponse {
  channels: Array<
    A2AChannel & {
      role: MemberRole;
      unread_count: number;
      last_message_at: string | null;
    }
  >;
  count: number;
}

/** POST /api/a2a/channels/:id/members — add a member. */
export interface ChannelAddMemberRequest {
  agent_id: string;
  role?: MemberRole;
}

export interface ChannelAddMemberResponse {
  membership_id: string;
  channel_id: string;
  agent_id: string;
  role: MemberRole;
  joined_at: string;
}

/** POST /api/a2a/channels/:id/messages — send a message. */
export interface MessageSendRequest {
  message_type: MessageType;
  content: Record<string, unknown>;
  reply_to?: string;
  /** For vote messages: the proposal being voted on. */
  proposal_id?: string;
  /** For vote messages: the vote value. */
  vote?: VoteValue;
  metadata?: Record<string, unknown>;
}

export interface MessageSendResponse {
  message_id: string;
  channel_id: string;
  sender_agent_id: string;
  message_type: MessageType;
  created_at: string;
  /** Included for proposal messages: initial empty tally. */
  tally?: ProposalTally;
}

/** GET /api/a2a/channels/:id/messages — list messages. */
export interface MessageListResponse {
  messages: ChannelMessage[];
  count: number;
  /** Cursor for pagination (ISO timestamp of oldest message in page). */
  next_cursor: string | null;
  /** For proposal messages in the result, includes current tallies. */
  tallies: Record<string, ProposalTally>;
}
