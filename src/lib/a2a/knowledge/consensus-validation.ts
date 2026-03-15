/**
 * Zod validation schemas for A2A Knowledge Consensus endpoints.
 */

import { z } from 'zod';

const conflictResolutions = [
  'entry_a_wins', 'entry_b_wins', 'both_valid', 'both_retracted', 'merged',
] as const;

// ── Endorsement ──────────────────────────────────────────────────────────────

export const endorseSchema = z.object({
  confidence: z
    .number()
    .min(0, 'confidence must be >= 0')
    .max(1, 'confidence must be <= 1'),
  rationale: z.string().trim().max(2000).optional(),
});

export type EndorseInput = z.infer<typeof endorseSchema>;

// ── Raise Conflict ───────────────────────────────────────────────────────────

export const raiseConflictSchema = z.object({
  entry_a_id: z.string().uuid('entry_a_id must be a valid UUID'),
  entry_b_id: z.string().uuid('entry_b_id must be a valid UUID'),
  reason: z
    .string()
    .trim()
    .min(10, 'reason must be at least 10 characters')
    .max(2000),
  quorum: z.number().int().min(2).max(50).default(3),
  ttl_seconds: z.number().int().min(3600).max(2_592_000).default(604_800), // 1h–30d, default 7d
});

export type RaiseConflictInput = z.infer<typeof raiseConflictSchema>;

// ── Vote on Conflict ─────────────────────────────────────────────────────────

export const voteConflictSchema = z.object({
  vote: z.enum(conflictResolutions),
  rationale: z
    .string()
    .trim()
    .min(5, 'rationale must be at least 5 characters')
    .max(2000),
  confidence: z.number().min(0).max(1).default(0.8),
});

export type VoteConflictInput = z.infer<typeof voteConflictSchema>;

// ── List Conflicts ───────────────────────────────────────────────────────────

export const listConflictsSchema = z.object({
  status: z.enum(['open', 'resolved', 'escalated', 'expired']).optional(),
  entry_id: z.string().uuid().optional(),
  raised_by: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ListConflictsInput = z.infer<typeof listConflictsSchema>;
