/**
 * Autonomic Agent Nervous System — Type Definitions
 *
 * A self-aware, predictive runtime layer that gives the A2A ecosystem
 * homeostatic properties: vital signs monitoring, anomaly detection,
 * predictive health forecasting, and autonomous self-healing.
 *
 * Loop 29: Autonomic intelligence for the agent mesh.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Vital Signs — continuous health metrics for agents & system
// ---------------------------------------------------------------------------

export type VitalSignCategory =
  | 'latency'
  | 'throughput'
  | 'error_rate'
  | 'saturation'
  | 'availability'
  | 'cost_efficiency'
  | 'reputation_drift'
  | 'queue_depth';

export interface VitalSign {
  agent_id: string;
  category: VitalSignCategory;
  value: number;
  unit: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface VitalSignWindow {
  agent_id: string;
  category: VitalSignCategory;
  samples: number[];
  timestamps: number[];
  window_ms: number;
}

export interface VitalSignSummary {
  agent_id: string;
  category: VitalSignCategory;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  std_dev: number;
  min: number;
  max: number;
  trend: 'improving' | 'stable' | 'degrading' | 'critical';
  sample_count: number;
}

// ---------------------------------------------------------------------------
// Anomaly Detection — statistical anomaly detection with classification
// ---------------------------------------------------------------------------

export type AnomalyType =
  | 'spike'           // sudden increase
  | 'drop'            // sudden decrease
  | 'drift'           // gradual shift from baseline
  | 'oscillation'     // unstable oscillation pattern
  | 'flatline'        // unexpected lack of variation
  | 'correlation'     // correlated anomaly across agents
  | 'cascade';        // anomaly propagating through the mesh

export type AnomalySeverity = 'info' | 'warning' | 'critical' | 'emergency';

export interface Anomaly {
  id: string;
  agent_id: string;
  category: VitalSignCategory;
  type: AnomalyType;
  severity: AnomalySeverity;
  detected_at: number;
  z_score: number;
  expected_value: number;
  actual_value: number;
  confidence: number; // 0-1
  description: string;
  correlated_anomalies: string[]; // other anomaly IDs
  resolved: boolean;
  resolved_at?: number;
  resolution?: string;
}

// ---------------------------------------------------------------------------
// Predictive Health — forecasting failures before they happen
// ---------------------------------------------------------------------------

export type PredictionType =
  | 'failure_imminent'       // agent likely to fail soon
  | 'capacity_exhaustion'    // resource saturation approaching
  | 'sla_breach'             // SLA violation predicted
  | 'cost_overrun'           // spending trajectory exceeds budget
  | 'cascade_risk'           // failure may cascade to dependents
  | 'performance_degradation'; // gradual slowdown detected

export interface HealthPrediction {
  id: string;
  agent_id: string;
  type: PredictionType;
  probability: number;       // 0-1
  estimated_time_ms: number; // time until predicted event
  confidence_interval: { low: number; high: number };
  contributing_factors: ContributingFactor[];
  recommended_actions: RecommendedAction[];
  created_at: number;
  expires_at: number;
}

export interface ContributingFactor {
  category: VitalSignCategory;
  weight: number;            // 0-1, how much this contributes
  current_value: number;
  threshold_value: number;
  trend: 'improving' | 'stable' | 'degrading' | 'critical';
}

// ---------------------------------------------------------------------------
// Self-Healing — autonomous remediation actions
// ---------------------------------------------------------------------------

export type HealingActionType =
  | 'reroute_traffic'        // shift load away from degraded agent
  | 'circuit_break'          // open circuit breaker preemptively
  | 'scale_ensemble'         // add agents to handle load
  | 'throttle_intake'        // reduce incoming task rate
  | 'evacuate_workflows'     // migrate in-flight workflows
  | 'quarantine_agent'       // isolate misbehaving agent
  | 'restart_agent'          // request agent restart
  | 'rollback_strategy'      // revert agent to previous strategy
  | 'notify_operator';       // escalate to human

export type HealingStatus =
  | 'proposed'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export interface RecommendedAction {
  type: HealingActionType;
  target_agent_id: string;
  priority: number;          // 1-10
  estimated_impact: number;  // predicted improvement 0-1
  risk_level: 'low' | 'medium' | 'high';
  description: string;
  params?: Record<string, unknown>;
}

export interface HealingAction {
  id: string;
  anomaly_id?: string;
  prediction_id?: string;
  type: HealingActionType;
  target_agent_id: string;
  status: HealingStatus;
  auto_approved: boolean;    // within autonomy policy
  priority: number;
  created_at: number;
  executed_at?: number;
  completed_at?: number;
  result?: HealingResult;
  rollback_action_id?: string;
}

export interface HealingResult {
  success: boolean;
  metrics_before: Record<string, number>;
  metrics_after: Record<string, number>;
  improvement: number;       // -1 to 1
  side_effects: string[];
}

// ---------------------------------------------------------------------------
// Homeostatic Regulation — optimal operating range maintenance
// ---------------------------------------------------------------------------

export interface HomeostasisPolicy {
  id: string;
  name: string;
  description: string;
  target_category: VitalSignCategory;
  optimal_range: { min: number; max: number };
  warning_range: { min: number; max: number };
  critical_range: { min: number; max: number };
  auto_heal_enabled: boolean;
  max_auto_actions_per_hour: number;
  cooldown_ms: number;
  escalation_after_failures: number;
  applies_to: 'all' | string[]; // agent IDs or 'all'
}

export interface SystemHomeostasis {
  timestamp: number;
  overall_health: number;    // 0-1 composite score
  agent_count: number;
  healthy_agents: number;
  degraded_agents: number;
  critical_agents: number;
  active_anomalies: number;
  active_predictions: number;
  healing_actions_24h: number;
  healing_success_rate: number;
  policies: HomeostasisPolicy[];
}

// ---------------------------------------------------------------------------
// Dependency Graph — agent interdependency mapping
// ---------------------------------------------------------------------------

export interface AgentDependency {
  from_agent_id: string;
  to_agent_id: string;
  dependency_type: 'hard' | 'soft' | 'optional';
  interaction_count: number;
  avg_latency_ms: number;
  failure_correlation: number; // 0-1
  last_interaction: number;
}

export interface DependencyGraph {
  agents: string[];
  edges: AgentDependency[];
  clusters: AgentCluster[];
  critical_paths: string[][];
  single_points_of_failure: string[];
}

export interface AgentCluster {
  id: string;
  agents: string[];
  cohesion: number;          // 0-1, how tightly coupled
  label: string;
}

// ---------------------------------------------------------------------------
// Zod Schemas for API validation
// ---------------------------------------------------------------------------

export const recordVitalSignSchema = z.object({
  agent_id: z.string().min(1),
  category: z.enum([
    'latency', 'throughput', 'error_rate', 'saturation',
    'availability', 'cost_efficiency', 'reputation_drift', 'queue_depth',
  ]),
  value: z.number(),
  unit: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const queryAnomaliesSchema = z.object({
  agent_id: z.string().optional(),
  category: z.enum([
    'latency', 'throughput', 'error_rate', 'saturation',
    'availability', 'cost_efficiency', 'reputation_drift', 'queue_depth',
  ]).optional(),
  severity: z.enum(['info', 'warning', 'critical', 'emergency']).optional(),
  resolved: z.boolean().optional(),
  since: z.number().optional(),
});

export const createPolicySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  target_category: z.enum([
    'latency', 'throughput', 'error_rate', 'saturation',
    'availability', 'cost_efficiency', 'reputation_drift', 'queue_depth',
  ]),
  optimal_range: z.object({ min: z.number(), max: z.number() }),
  warning_range: z.object({ min: z.number(), max: z.number() }),
  critical_range: z.object({ min: z.number(), max: z.number() }),
  auto_heal_enabled: z.boolean().default(true),
  max_auto_actions_per_hour: z.number().int().min(0).max(100).default(10),
  cooldown_ms: z.number().int().min(0).default(60_000),
  escalation_after_failures: z.number().int().min(1).max(10).default(3),
  applies_to: z.union([z.literal('all'), z.array(z.string().min(1))]).default('all'),
});

export const triggerHealingSchema = z.object({
  action_type: z.enum([
    'reroute_traffic', 'circuit_break', 'scale_ensemble', 'throttle_intake',
    'evacuate_workflows', 'quarantine_agent', 'restart_agent',
    'rollback_strategy', 'notify_operator',
  ]),
  target_agent_id: z.string().min(1),
  reason: z.string().min(1).max(500),
  params: z.record(z.unknown()).optional(),
});

export const getPredictionsSchema = z.object({
  agent_id: z.string().optional(),
  type: z.enum([
    'failure_imminent', 'capacity_exhaustion', 'sla_breach',
    'cost_overrun', 'cascade_risk', 'performance_degradation',
  ]).optional(),
  min_probability: z.number().min(0).max(1).default(0.5),
});

export const buildDependencyGraphSchema = z.object({
  agent_ids: z.array(z.string().min(1)).optional(),
  min_interaction_count: z.number().int().min(1).default(3),
  include_optional: z.boolean().default(false),
});
