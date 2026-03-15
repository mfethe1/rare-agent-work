/**
 * Agent Progressive Trust & Dynamic Autonomy Protocol — Types
 *
 * In 2028, static governance policies are a relic. Premier A2A ecosystems
 * implement progressive trust: agents earn autonomy through demonstrated
 * competence, lose it through failures, and hold different trust levels
 * across different operational domains. This is the driver's-license
 * system for autonomous agents — the bridge between capability and safety
 * that regulators, researchers, and operators all demand.
 *
 * The trust protocol closes the loop between:
 *   Reputation (performance data) → Trust (domain-specific scores)
 *     → Governance (autonomy levels) → Behavior control
 *
 * Key design principles:
 *   1. Domain-specific: an agent trusted for data analysis may not be
 *      trusted for financial transactions.
 *   2. Earned, not assigned: autonomy level is computed from track record.
 *   3. Asymmetric: promotion is slow and deliberate; demotion is instant.
 *   4. Probationary: newly promoted agents are on a trial period.
 *   5. Observable: every trust change is logged and auditable.
 */

import type { AutonomyLevel } from '../governance/types';

// ──────────────────────────────────────────────
// Trust Domains
// ──────────────────────────────────────────────

/**
 * Operational domains in which trust is independently tracked.
 * An agent may be autonomous in "data_analysis" but merely "suggest"
 * level in "financial_operations".
 */
export type TrustDomain =
  | 'task_execution'
  | 'data_analysis'
  | 'code_generation'
  | 'financial_operations'
  | 'communication'
  | 'knowledge_management'
  | 'workflow_orchestration'
  | 'agent_coordination'
  | 'security_operations'
  | 'content_creation'
  | 'custom';

/** Full list for iteration. */
export const TRUST_DOMAINS: TrustDomain[] = [
  'task_execution',
  'data_analysis',
  'code_generation',
  'financial_operations',
  'communication',
  'knowledge_management',
  'workflow_orchestration',
  'agent_coordination',
  'security_operations',
  'content_creation',
];

// ──────────────────────────────────────────────
// Trust Thresholds
// ──────────────────────────────────────────────

/** Score thresholds for each autonomy level transition. */
export interface TrustThresholds {
  /** Minimum score to be promoted from observe → suggest. */
  observe_to_suggest: number;
  /** Minimum score to be promoted from suggest → act_with_approval. */
  suggest_to_act: number;
  /** Minimum score to be promoted from act_with_approval → autonomous. */
  act_to_autonomous: number;
  /** Score below which demotion is triggered (per level). */
  demotion_trigger: number;
  /** Minimum completed tasks before promotion eligibility. */
  min_tasks_for_promotion: number;
  /** Minimum time at current level (hours) before promotion eligibility. */
  min_hours_at_level: number;
}

/** Conservative defaults — safety-first. */
export const DEFAULT_THRESHOLDS: TrustThresholds = {
  observe_to_suggest: 0.3,
  suggest_to_act: 0.55,
  act_to_autonomous: 0.8,
  demotion_trigger: 0.25,
  min_tasks_for_promotion: 10,
  min_hours_at_level: 24,
};

/** Stricter thresholds for high-stakes domains. */
export const HIGH_STAKES_THRESHOLDS: TrustThresholds = {
  observe_to_suggest: 0.5,
  suggest_to_act: 0.7,
  act_to_autonomous: 0.9,
  demotion_trigger: 0.4,
  min_tasks_for_promotion: 25,
  min_hours_at_level: 72,
};

/** Domains that use high-stakes thresholds by default. */
export const HIGH_STAKES_DOMAINS: TrustDomain[] = [
  'financial_operations',
  'security_operations',
  'workflow_orchestration',
];

// ──────────────────────────────────────────────
// Domain Trust Record
// ──────────────────────────────────────────────

/** Trust state for a single agent in a single domain. */
export interface DomainTrust {
  /** The operational domain. */
  domain: TrustDomain;
  /** Custom domain label (when domain === 'custom'). */
  custom_domain_label?: string;
  /** Current computed trust score (0.0 – 1.0). */
  score: number;
  /** Current effective autonomy level derived from score. */
  autonomy_level: AutonomyLevel;
  /** Whether the agent is in a probationary period after promotion. */
  on_probation: boolean;
  /** When probation expires (ISO). Null if not on probation. */
  probation_expires_at: string | null;
  /** When this autonomy level was granted (ISO). */
  level_granted_at: string;
  /** Total tasks evaluated in this domain. */
  total_evaluations: number;
  /** Successful task count. */
  successful_evaluations: number;
  /** Failed task count. */
  failed_evaluations: number;
  /** Consecutive successes at current level. */
  consecutive_successes: number;
  /** Consecutive failures (resets on success). */
  consecutive_failures: number;
  /** Thresholds active for this domain. */
  thresholds: TrustThresholds;
  /** Whether a manual override is in effect. */
  manual_override: boolean;
  /** Who set the manual override (agent or human ID). */
  override_set_by?: string;
  /** Reason for the manual override. */
  override_reason?: string;
}

// ──────────────────────────────────────────────
// Agent Trust Profile
// ──────────────────────────────────────────────

/** Complete trust profile for an agent across all domains. */
export interface AgentTrustProfile {
  /** Agent ID. */
  agent_id: string;
  /** Agent name (denormalized for convenience). */
  agent_name: string;
  /** Composite trust score (weighted average across domains). */
  composite_score: number;
  /** Highest autonomy level held in any domain. */
  peak_autonomy: AutonomyLevel;
  /** Lowest autonomy level held in any domain. */
  floor_autonomy: AutonomyLevel;
  /** Per-domain trust records. */
  domains: DomainTrust[];
  /** Whether the agent is globally suspended (from governance kill switch). */
  suspended: boolean;
  /** Total trust events in the agent's lifetime. */
  total_events: number;
  /** When the profile was first created (ISO). */
  created_at: string;
  /** Last evaluation timestamp (ISO). */
  last_evaluated_at: string;
}

// ──────────────────────────────────────────────
// Trust Events
// ──────────────────────────────────────────────

/** Types of trust-changing events. */
export type TrustEventType =
  | 'promotion'
  | 'demotion'
  | 'probation_start'
  | 'probation_end'
  | 'probation_failed'
  | 'score_update'
  | 'manual_override'
  | 'override_lifted'
  | 'safety_demotion'
  | 'domain_added'
  | 'threshold_adjustment';

/** A single trust event in the audit log. */
export interface TrustEvent {
  /** Event ID (UUID). */
  id: string;
  /** Agent this event pertains to. */
  agent_id: string;
  /** Domain in which the event occurred. */
  domain: TrustDomain;
  /** Event type. */
  event_type: TrustEventType;
  /** Previous autonomy level (for promotion/demotion). */
  previous_level?: AutonomyLevel;
  /** New autonomy level (for promotion/demotion). */
  new_level?: AutonomyLevel;
  /** Previous trust score. */
  previous_score?: number;
  /** New trust score. */
  new_score?: number;
  /** What triggered this event. */
  trigger: TrustTrigger;
  /** Human-readable reason. */
  reason: string;
  /** Who or what caused this event. */
  caused_by: string;
  /** Timestamp (ISO). */
  created_at: string;
}

/** What caused a trust event. */
export type TrustTrigger =
  | 'task_completion'
  | 'task_failure'
  | 'task_timeout'
  | 'quality_rating'
  | 'safety_violation'
  | 'manual_intervention'
  | 'probation_expiry'
  | 'periodic_review'
  | 'reputation_sync';

// ──────────────────────────────────────────────
// Trust Evaluation Input
// ──────────────────────────────────────────────

/** Signal fed into the trust engine after an agent action. */
export interface TrustSignal {
  /** Agent being evaluated. */
  agent_id: string;
  /** Domain of the action. */
  domain: TrustDomain;
  /** Whether the action was successful. */
  success: boolean;
  /** Quality rating (1–5), if available. */
  quality_rating?: number;
  /** Whether a safety violation occurred. */
  safety_violation?: boolean;
  /** Description of the safety violation. */
  violation_description?: string;
  /** Task ID that generated this signal. */
  task_id?: string;
  /** Duration of the task in seconds. */
  duration_seconds?: number;
}

// ──────────────────────────────────────────────
// Trust Evaluation Result
// ──────────────────────────────────────────────

/** Result of a trust evaluation. */
export interface TrustEvaluationResult {
  /** Agent ID. */
  agent_id: string;
  /** Domain evaluated. */
  domain: TrustDomain;
  /** Previous score. */
  previous_score: number;
  /** New score. */
  new_score: number;
  /** Previous autonomy level. */
  previous_level: AutonomyLevel;
  /** New autonomy level (may differ if promotion/demotion occurred). */
  new_level: AutonomyLevel;
  /** Whether a level change occurred. */
  level_changed: boolean;
  /** Direction of change, if any. */
  change_direction?: 'promotion' | 'demotion';
  /** Whether the agent entered probation. */
  entered_probation: boolean;
  /** Events generated by this evaluation. */
  events: TrustEvent[];
}

// ──────────────────────────────────────────────
// Score Computation Weights
// ──────────────────────────────────────────────

/** Weights for the trust score formula. */
export interface TrustScoreWeights {
  /** Weight for completion rate (0–1). */
  completion_rate: number;
  /** Weight for average quality rating (0–1). */
  quality_rating: number;
  /** Weight for consistency (low variance in performance). */
  consistency: number;
  /** Weight for recency (recent performance weighted more). */
  recency: number;
  /** Penalty multiplier for safety violations. */
  safety_violation_penalty: number;
}

/** Default scoring weights. */
export const DEFAULT_SCORE_WEIGHTS: TrustScoreWeights = {
  completion_rate: 0.35,
  quality_rating: 0.25,
  consistency: 0.15,
  recency: 0.25,
  safety_violation_penalty: 0.5,
};

// ──────────────────────────────────────────────
// Autonomy Level Mapping
// ──────────────────────────────────────────────

/** Maps a numeric score to an autonomy level based on thresholds. */
export function scoreToAutonomyLevel(
  score: number,
  thresholds: TrustThresholds,
): AutonomyLevel {
  if (score >= thresholds.act_to_autonomous) return 'autonomous';
  if (score >= thresholds.suggest_to_act) return 'act_with_approval';
  if (score >= thresholds.observe_to_suggest) return 'suggest';
  return 'observe';
}

/** Ordered autonomy levels for comparison. */
export const AUTONOMY_ORDER: AutonomyLevel[] = [
  'observe',
  'suggest',
  'act_with_approval',
  'autonomous',
];

/** Compare two autonomy levels. Returns -1, 0, or 1. */
export function compareAutonomy(a: AutonomyLevel, b: AutonomyLevel): number {
  const ai = AUTONOMY_ORDER.indexOf(a);
  const bi = AUTONOMY_ORDER.indexOf(b);
  return ai < bi ? -1 : ai > bi ? 1 : 0;
}
