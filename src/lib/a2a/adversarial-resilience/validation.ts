/**
 * A2A Adversarial Resilience — Zod Validation Schemas
 */

import { z } from 'zod';

// ── Shared Enums ────────────────────────────────────────────────────────────

const threatCategorySchema = z.enum([
  'prompt_injection', 'data_poisoning', 'capability_abuse', 'sybil_attack',
  'collusion', 'output_manipulation', 'resource_exhaustion', 'privilege_escalation',
  'cascade_corruption', 'replay_attack', 'eclipse_attack', 'model_extraction',
]);

const threatSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

const quarantineLevelSchema = z.enum([
  'shadow', 'restricted', 'quarantined', 'expelled',
]);

const evidenceTypeSchema = z.enum([
  'behavioral_anomaly', 'output_divergence', 'timing_anomaly', 'network_pattern',
  'content_analysis', 'cryptographic_failure', 'reputation_signal', 'honeypot_trigger',
]);

// ── Evidence Schema ─────────────────────────────────────────────────────────

const threatEvidenceInputSchema = z.object({
  type: evidenceTypeSchema,
  observation: z.string().min(1).max(5000),
  anomaly_score: z.number().min(0),
  data: z.record(z.unknown()).default({}),
});

// ── Report Threat ───────────────────────────────────────────────────────────

export const reportThreatSchema = z.object({
  reporter_agent_id: z.string().uuid(),
  suspect_agent_ids: z.array(z.string().uuid()).min(1).max(50),
  category: threatCategorySchema,
  description: z.string().min(1).max(10000),
  evidence: z.array(threatEvidenceInputSchema).min(1).max(100),
});
export type ReportThreatInput = z.infer<typeof reportThreatSchema>;

// ── Quarantine ──────────────────────────────────────────────────────────────

export const quarantineAgentSchema = z.object({
  agent_id: z.string().uuid(),
  level: quarantineLevelSchema,
  threat_ids: z.array(z.string().uuid()).min(1),
  reason: z.string().min(1).max(5000),
  ttl_seconds: z.number().int().min(0).max(86400 * 365).default(0),
});
export type QuarantineAgentInput = z.infer<typeof quarantineAgentSchema>;

export const escalateQuarantineSchema = z.object({
  agent_id: z.string().uuid(),
  new_level: quarantineLevelSchema,
  reason: z.string().min(1).max(5000),
});
export type EscalateQuarantineInput = z.infer<typeof escalateQuarantineSchema>;

export const releaseQuarantineSchema = z.object({
  agent_id: z.string().uuid(),
  reason: z.string().min(1).max(5000),
  shadow_monitor: z.boolean().default(true),
});
export type ReleaseQuarantineInput = z.infer<typeof releaseQuarantineSchema>;

// ── BFT Voting ──────────────────────────────────────────────────────────────

export const initiateBFTRoundSchema = z.object({
  proposal: z.string().min(1).max(10000),
  proposal_data: z.record(z.unknown()).default({}),
  participant_ids: z.array(z.string().uuid()).min(4), // Need at least 4 for BFT (f=1)
});
export type InitiateBFTRoundInput = z.infer<typeof initiateBFTRoundSchema>;

export const submitBFTVoteSchema = z.object({
  round_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  commitment: z.string().min(64).max(128), // SHA-256 hex string
});
export type SubmitBFTVoteInput = z.infer<typeof submitBFTVoteSchema>;

export const revealBFTVoteSchema = z.object({
  round_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  value: z.unknown(),
  nonce: z.string().min(16).max(128),
});
export type RevealBFTVoteInput = z.infer<typeof revealBFTVoteSchema>;

// ── Integrity Proofs ────────────────────────────────────────────────────────

export const generateIntegrityProofSchema = z.object({
  agent_id: z.string().uuid(),
  task_id: z.string().uuid(),
  output_content: z.string().min(1),
  input_content: z.string().min(1),
  capability_id: z.string().min(1).max(200),
});
export type GenerateIntegrityProofInput = z.infer<typeof generateIntegrityProofSchema>;

export const verifyIntegrityProofSchema = z.object({
  proof_id: z.string().uuid(),
  output_content: z.string().min(1),
});
export type VerifyIntegrityProofInput = z.infer<typeof verifyIntegrityProofSchema>;

// ── Threat Intelligence ─────────────────────────────────────────────────────

export const getThreatIntelligenceSchema = z.object({
  category: threatCategorySchema.optional(),
  min_severity: threatSeveritySchema.optional(),
  active_only: z.boolean().default(true),
});
export type GetThreatIntelligenceInput = z.infer<typeof getThreatIntelligenceSchema>;

// ── Agent Resilience Check ──────────────────────────────────────────────────

export const agentResilienceCheckSchema = z.object({
  agent_id: z.string().uuid(),
});
export type AgentResilienceCheckInput = z.infer<typeof agentResilienceCheckSchema>;
