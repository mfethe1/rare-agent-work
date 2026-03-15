/**
 * Zod validation schemas for A2A Messaging Channels endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// Channel Create — POST /api/a2a/channels
// ──────────────────────────────────────────────

export const channelCreateSchema = z
  .object({
    name: trimmed(200).min(1, 'Channel name is required'),
    description: trimmed(1000).min(1, 'Channel description is required'),
    channel_type: z.enum(['direct', 'group', 'topic']),
    /** For direct channels, specifies the other agent. */
    target_agent_id: z.string().uuid().optional(),
    /** Optional correlation to a task/workflow. */
    correlation_id: trimmed(256).optional(),
    /** TTL in seconds (1h to 30 days, default 24h). */
    ttl_seconds: z.number().int().min(3600).max(2592000).default(86400),
  })
  .refine(
    (data) => {
      if (data.channel_type === 'direct' && !data.target_agent_id) return false;
      return true;
    },
    { message: 'Direct channels require a target_agent_id.' },
  );

export type ChannelCreateInput = z.infer<typeof channelCreateSchema>;

// ──────────────────────────────────────────────
// Channel List — GET /api/a2a/channels
// ──────────────────────────────────────────────

export const channelListSchema = z.object({
  channel_type: z.enum(['direct', 'group', 'topic']).optional(),
  correlation_id: trimmed(256).optional(),
  active_only: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(50),
});

export type ChannelListInput = z.infer<typeof channelListSchema>;

// ──────────────────────────────────────────────
// Add Member — POST /api/a2a/channels/:id/members
// ──────────────────────────────────────────────

export const channelAddMemberSchema = z.object({
  agent_id: z.string().uuid('Valid agent UUID is required'),
  role: z.enum(['member', 'observer']).default('member'),
});

export type ChannelAddMemberInput = z.infer<typeof channelAddMemberSchema>;

// ──────────────────────────────────────────────
// Send Message — POST /api/a2a/channels/:id/messages
// ──────────────────────────────────────────────

export const messageSendSchema = z
  .object({
    message_type: z.enum([
      'text',
      'request',
      'response',
      'proposal',
      'vote',
      'notification',
    ]),
    /** Structured message content (max 64KB serialized). */
    content: z.record(z.string(), z.unknown()).refine(
      (v) => JSON.stringify(v).length <= 65536,
      { message: 'Message content must be under 64KB when serialized' },
    ),
    /** Reply to a specific message (thread support). */
    reply_to: z.string().uuid().optional(),
    /** For vote messages: which proposal is being voted on. */
    proposal_id: z.string().uuid().optional(),
    /** For vote messages: the vote value. */
    vote: z.enum(['approve', 'reject', 'abstain']).optional(),
    /** Optional metadata tags. */
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      if (data.message_type === 'vote') {
        return !!data.proposal_id && !!data.vote;
      }
      return true;
    },
    { message: 'Vote messages require both proposal_id and vote value.' },
  )
  .refine(
    (data) => {
      if (data.message_type === 'response') {
        return !!data.reply_to;
      }
      return true;
    },
    { message: 'Response messages require a reply_to message ID.' },
  );

export type MessageSendInput = z.infer<typeof messageSendSchema>;

// ──────────────────────────────────────────────
// List Messages — GET /api/a2a/channels/:id/messages
// ──────────────────────────────────────────────

export const messageListSchema = z.object({
  /** Filter by message type. */
  message_type: z
    .enum(['text', 'request', 'response', 'proposal', 'vote', 'notification'])
    .optional(),
  /** Filter by sender. */
  sender_agent_id: z.string().uuid().optional(),
  /** Only messages in a thread (replies to this message). */
  thread_id: z.string().uuid().optional(),
  /** Pagination cursor (ISO timestamp — fetch messages before this time). */
  before: z.string().datetime().optional(),
  /** Max results (1-100). */
  limit: z.number().int().min(1).max(100).default(50),
});

export type MessageListInput = z.infer<typeof messageListSchema>;
