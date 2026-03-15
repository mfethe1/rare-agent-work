/**
 * Zod validation schemas for Agent Ensemble Protocol endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

const formationStrategySchema = z.enum([
  'manual',
  'capability_match',
  'auction',
  'reputation_top_n',
]);

const consensusPolicySchema = z.enum([
  'majority',
  'supermajority',
  'unanimous',
  'weighted_reputation',
  'coordinator_decides',
  'validator_gate',
]);

const memberRoleSchema = z.enum([
  'coordinator',
  'specialist',
  'validator',
  'critic',
  'observer',
]);

const voteDecisionSchema = z.enum(['approve', 'reject', 'revise']);

const dissolveReasonSchema = z.enum(['goal_complete', 'manual']);

// ── Create Ensemble ─────────────────────────────────────────────────────────

export const createEnsembleSchema = z.object({
  name: trimmed(200).min(1),
  goal: trimmed(2000).min(1),
  formation_strategy: formationStrategySchema,
  consensus_policy: consensusPolicySchema,
  min_quorum: z.number().int().min(2).max(50).default(3),
  max_members: z.number().int().min(2).max(100).default(10),
  tags: z.array(trimmed(100)).max(20).default([]),
  idle_timeout_seconds: z.number().int().min(60).max(604800).default(3600), // 1h default, 7d max
  invite_agents: z.array(trimmed(100)).max(100).optional(),
  required_capabilities: z.array(trimmed(200)).max(50).optional(),
  top_n: z.number().int().min(1).max(10).default(3),
});

export type CreateEnsembleInput = z.infer<typeof createEnsembleSchema>;

// ── Invite Member ───────────────────────────────────────────────────────────

export const inviteMemberSchema = z.object({
  agent_id: trimmed(100).min(1),
  role: memberRoleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// ── Propose Output ──────────────────────────────────────────────────────────

export const proposeOutputSchema = z.object({
  external_task_id: trimmed(100).min(1),
  proposed_output: z.record(z.unknown()),
  max_rounds: z.number().int().min(1).max(10).default(3),
});

export type ProposeOutputInput = z.infer<typeof proposeOutputSchema>;

// ── Vote ────────────────────────────────────────────────────────────────────

export const voteSchema = z.object({
  decision: voteDecisionSchema,
  rationale: trimmed(2000).min(1),
  suggested_changes: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).default(0.8),
});

export type VoteInput = z.infer<typeof voteSchema>;

// ── Dissolve ────────────────────────────────────────────────────────────────

export const dissolveSchema = z.object({
  reason: dissolveReasonSchema,
  accomplishment_summary: trimmed(5000).optional(),
  learnings: z.array(trimmed(2000)).max(50).optional(),
});

export type DissolveInput = z.infer<typeof dissolveSchema>;

// ── List Ensembles ──────────────────────────────────────────────────────────

export const listEnsemblesSchema = z.object({
  status: z.enum(['forming', 'active', 'quorum_lost', 'dissolving', 'dissolved']).optional(),
  tag: trimmed(100).optional(),
  created_by: trimmed(100).optional(),
  member_agent_id: trimmed(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListEnsemblesInput = z.infer<typeof listEnsemblesSchema>;
