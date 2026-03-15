/**
 * Agent Consensus & Distributed Decision Protocol — Validation
 *
 * Zod schemas for all API inputs. Every endpoint validates through these
 * schemas before touching the engine.
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// Shared Enums
// ──────────────────────────────────────────────

export const ConsensusAlgorithmSchema = z.enum([
  'weighted_majority',
  'supermajority',
  'conviction_voting',
  'liquid_democracy',
  'optimistic_approval',
  'unanimous',
]);

export const DecisionDomainSchema = z.enum([
  'resource_allocation',
  'policy_change',
  'membership_admission',
  'membership_removal',
  'capability_deployment',
  'emergency_response',
  'strategic_planning',
  'conflict_resolution',
  'budget_approval',
  'safety_override',
  'protocol_upgrade',
  'custom',
]);

export const ProposalStatusSchema = z.enum([
  'draft',
  'open',
  'voting',
  'decided_approved',
  'decided_rejected',
  'executed',
  'expired',
  'vetoed',
  'cancelled',
]);

export const VoteChoiceSchema = z.enum([
  'approve',
  'reject',
  'abstain',
  'veto',
]);

export const CouncilRoleSchema = z.enum([
  'chair',
  'member',
  'observer',
  'veto_holder',
]);

export const SplitBrainStrategySchema = z.enum([
  'highest_quorum_wins',
  'chair_partition_wins',
  'latest_timestamp_wins',
  'merge_and_revote',
  'manual_resolution',
]);

// ──────────────────────────────────────────────
// Council Schemas
// ──────────────────────────────────────────────

export const DomainConfigSchema = z.object({
  domain: DecisionDomainSchema,
  algorithm: ConsensusAlgorithmSchema,
  quorum_threshold: z.number().min(0).max(1),
  approval_threshold: z.number().min(0).max(1),
  veto_enabled: z.boolean(),
  max_voting_duration_seconds: z.number().int().positive(),
});

export const CreateCouncilSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  domains: z.array(DecisionDomainSchema).min(1),
  default_algorithm: ConsensusAlgorithmSchema,
  default_quorum: z.number().min(0).max(1).optional(),
  default_approval_threshold: z.number().min(0).max(1).optional(),
  domain_overrides: z.array(DomainConfigSchema).optional(),
  creator_id: z.string().min(1),
});

export const AddCouncilMemberSchema = z.object({
  agent_id: z.string().min(1),
  role: CouncilRoleSchema.optional(),
  weight_multiplier: z.number().positive().optional(),
  voting_domains: z.array(DecisionDomainSchema).optional(),
  added_by: z.string().min(1),
});

export const RemoveCouncilMemberSchema = z.object({
  agent_id: z.string().min(1),
  removed_by: z.string().min(1),
});

// ──────────────────────────────────────────────
// Proposal Schemas
// ──────────────────────────────────────────────

export const CreateProposalSchema = z.object({
  proposer_id: z.string().min(1),
  council_id: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  domain: DecisionDomainSchema,
  algorithm: ConsensusAlgorithmSchema.optional(),
  payload: z.record(z.unknown()),
  voting_opens_at: z.string().datetime().optional(),
  voting_closes_at: z.string().datetime(),
  quorum_threshold: z.number().min(0).max(1).optional(),
  approval_threshold: z.number().min(0).max(1).optional(),
  veto_enabled: z.boolean().optional(),
  veto_holders: z.array(z.string().min(1)).optional(),
});

export const OpenProposalSchema = z.object({
  actor_id: z.string().min(1),
});

export const CancelProposalSchema = z.object({
  actor_id: z.string().min(1),
});

export const ListProposalsSchema = z.object({
  council_id: z.string().min(1).optional(),
  status: ProposalStatusSchema.optional(),
});

// ──────────────────────────────────────────────
// Vote Schemas
// ──────────────────────────────────────────────

export const CastVoteSchema = z.object({
  proposal_id: z.string().min(1),
  voter_id: z.string().min(1),
  choice: VoteChoiceSchema,
  rationale: z.string().max(2000).optional(),
});

// ──────────────────────────────────────────────
// Delegation Schemas
// ──────────────────────────────────────────────

export const CreateDelegationSchema = z.object({
  delegator_id: z.string().min(1),
  delegate_id: z.string().min(1),
  domains: z.array(DecisionDomainSchema).optional(),
  council_id: z.string().min(1).optional(),
  transitive: z.boolean().optional(),
  max_depth: z.number().int().min(1).max(10).optional(),
  active_until: z.string().datetime().optional(),
});

export const RevokeDelegationSchema = z.object({
  actor_id: z.string().min(1),
});

// ──────────────────────────────────────────────
// Split-Brain Schemas
// ──────────────────────────────────────────────

const VoteTallySchema = z.object({
  total_eligible: z.number().int().min(0),
  total_cast: z.number().int().min(0),
  approve_weight: z.number().min(0),
  reject_weight: z.number().min(0),
  abstain_weight: z.number().min(0),
  veto_count: z.number().int().min(0),
  quorum_met: z.boolean(),
  approval_ratio: z.number().min(0).max(1),
});

const DecisionOutcomeSchema = z.object({
  approved: z.boolean(),
  tally: VoteTallySchema,
  resolution_method: z.string(),
  enforcement_actions: z.array(z.unknown()),
  resolved_at: z.string().datetime(),
});

const PartitionDecisionSchema = z.object({
  partition_id: z.string().min(1),
  member_ids: z.array(z.string().min(1)).min(1),
  outcome: DecisionOutcomeSchema,
});

export const DetectSplitBrainSchema = z.object({
  council_id: z.string().min(1),
  proposal_id: z.string().min(1),
  partitions: z.array(PartitionDecisionSchema).min(2),
  strategy: SplitBrainStrategySchema.optional(),
});

export const ResolveSplitBrainSchema = z.object({
  resolved_by: z.string().min(1),
  winning_partition_id: z.string().min(1),
  notes: z.string().min(1).max(2000),
});

// ──────────────────────────────────────────────
// Audit Schema
// ──────────────────────────────────────────────

export const AuditQuerySchema = z.object({
  council_id: z.string().min(1).optional(),
  proposal_id: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

// ──────────────────────────────────────────────
// Resolve / Execute Schemas
// ──────────────────────────────────────────────

export const ResolveProposalSchema = z.object({
  actor_id: z.string().min(1),
});

export const ExecuteProposalSchema = z.object({
  actor_id: z.string().min(1),
});

export const UpdateConvictionSchema = z.object({
  voter_id: z.string().min(1),
});
