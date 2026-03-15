/**
 * Agent Service Contracts — Types
 *
 * Formalizes service relationships between agents with SLAs, pricing,
 * negotiation protocol, and automated breach detection. Enables a true
 * agent economy where trust is contractual, not just reputational.
 *
 * Contract lifecycle:
 *   proposed → negotiating → active → completed | terminated | breached
 *
 * Negotiation lifecycle:
 *   A proposes → B counter-proposes (or accepts/rejects) → ... → agreement or rejection
 */

// ──────────────────────────────────────────────
// Service Level Agreement (SLA)
// ──────────────────────────────────────────────

/** Measurable performance guarantees that a provider agent commits to. */
export interface ServiceSLA {
  /** Maximum response time in milliseconds for task completion. */
  max_latency_ms: number;
  /** Minimum uptime percentage (0-100) over the contract period. */
  min_uptime_percent: number;
  /** Minimum quality rating (1-5) averaged over completed tasks. */
  min_quality_rating: number;
  /** Maximum allowed failure rate as a percentage (0-100). */
  max_failure_rate_percent: number;
  /** Maximum tasks the provider commits to handling per day (0 = unlimited). */
  max_daily_throughput: number;
}

/** Default SLA values for contracts where terms aren't fully specified. */
export const DEFAULT_SLA: ServiceSLA = {
  max_latency_ms: 30_000,
  min_uptime_percent: 95,
  min_quality_rating: 3,
  max_failure_rate_percent: 10,
  max_daily_throughput: 0,
};

// ──────────────────────────────────────────────
// Pricing Model
// ──────────────────────────────────────────────

export type PricingModel = 'per_task' | 'subscription' | 'tiered' | 'free';

/** How the consumer compensates the provider for services rendered. */
export interface ContractPricing {
  /** Pricing model type. */
  model: PricingModel;
  /** Currency for monetary values (platform credits or ISO 4217). */
  currency: string;
  /** Cost per task (for per_task model). */
  per_task_cost?: number;
  /** Fixed period cost (for subscription model). */
  subscription_cost?: number;
  /** Billing period in days (for subscription). */
  billing_period_days?: number;
  /** Tiered pricing brackets (for tiered model). */
  tiers?: PricingTier[];
}

export interface PricingTier {
  /** Tasks up to this count use this tier's price. */
  up_to_tasks: number;
  /** Cost per task in this tier. */
  cost_per_task: number;
}

// ──────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────

export type ContractStatus =
  | 'proposed'      // Initial proposal sent
  | 'negotiating'   // Counter-proposals in flight
  | 'active'        // Both parties agreed; contract is live
  | 'completed'     // Contract fulfilled and expired naturally
  | 'terminated'    // One or both parties ended the contract early
  | 'breached';     // Automated breach detection triggered

/** A formal service agreement between two agents. */
export interface ServiceContract {
  /** Platform-assigned contract ID (UUID). */
  id: string;
  /** Agent offering the service (provider). */
  provider_agent_id: string;
  /** Agent consuming the service (consumer). */
  consumer_agent_id: string;
  /** Capability IDs covered by this contract. */
  capabilities: string[];
  /** Current contract status. */
  status: ContractStatus;
  /** Agreed service level guarantees. */
  sla: ServiceSLA;
  /** Pricing terms. */
  pricing: ContractPricing;
  /** Contract start date (ISO-8601). Active contracts only. */
  starts_at?: string;
  /** Contract end date (ISO-8601). */
  expires_at: string;
  /** Duration in days. */
  duration_days: number;
  /** Number of negotiation rounds so far. */
  negotiation_rounds: number;
  /** Maximum negotiation rounds before auto-rejection. */
  max_negotiation_rounds: number;
  /** Who proposed last (for turn-based negotiation). */
  last_proposed_by: string;
  /** Reason for termination or breach. */
  termination_reason?: string;
  /** Live compliance metrics. */
  compliance?: ContractCompliance;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Compliance & Breach Detection
// ──────────────────────────────────────────────

/** Real-time compliance metrics tracked against the SLA. */
export interface ContractCompliance {
  /** Total tasks completed under this contract. */
  tasks_completed: number;
  /** Total tasks failed under this contract. */
  tasks_failed: number;
  /** Average latency in ms across completed tasks. */
  avg_latency_ms: number;
  /** P95 latency in ms. */
  p95_latency_ms: number;
  /** Average quality rating received. */
  avg_quality_rating: number;
  /** Computed failure rate percentage. */
  failure_rate_percent: number;
  /** Number of SLA violations detected. */
  violations_count: number;
  /** Whether the contract is currently in compliance. */
  is_compliant: boolean;
  /** Last compliance check timestamp. */
  last_checked_at: string;
}

/** A single recorded SLA violation. */
export interface SLAViolation {
  id: string;
  contract_id: string;
  /** Which SLA metric was violated. */
  metric: 'latency' | 'quality' | 'failure_rate' | 'throughput';
  /** The SLA threshold that was breached. */
  threshold_value: number;
  /** The actual observed value. */
  actual_value: number;
  /** Task that triggered the violation (if applicable). */
  task_id?: string;
  /** Severity: warning (first), critical (repeated), breach (auto-terminates). */
  severity: 'warning' | 'critical' | 'breach';
  created_at: string;
}

// ──────────────────────────────────────────────
// Negotiation Protocol
// ──────────────────────────────────────────────

export type NegotiationAction = 'propose' | 'counter' | 'accept' | 'reject';

/** A single negotiation message in the contract negotiation thread. */
export interface NegotiationEntry {
  id: string;
  contract_id: string;
  /** Agent making this negotiation move. */
  agent_id: string;
  /** What action this entry represents. */
  action: NegotiationAction;
  /** Proposed SLA terms (for propose/counter). */
  proposed_sla?: Partial<ServiceSLA>;
  /** Proposed pricing terms (for propose/counter). */
  proposed_pricing?: Partial<ContractPricing>;
  /** Proposed duration in days (for propose/counter). */
  proposed_duration_days?: number;
  /** Free-text rationale for this move. */
  rationale?: string;
  /** Round number (1-indexed). */
  round: number;
  created_at: string;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/contracts — propose a new service contract. */
export interface ContractProposeRequest {
  /** Target agent to contract with. */
  provider_agent_id: string;
  /** Capabilities requested. */
  capabilities: string[];
  /** Proposed SLA terms. */
  sla: Partial<ServiceSLA>;
  /** Proposed pricing. */
  pricing: ContractPricing;
  /** Desired contract duration in days. */
  duration_days: number;
  /** Max negotiation rounds (default: 5). */
  max_negotiation_rounds?: number;
  /** Rationale for the proposal. */
  rationale?: string;
}

export interface ContractProposeResponse {
  contract_id: string;
  status: ContractStatus;
  created_at: string;
}

/** POST /api/a2a/contracts/:id/negotiate — counter-propose, accept, or reject. */
export interface ContractNegotiateRequest {
  action: NegotiationAction;
  /** Counter-proposed SLA (for 'counter' action). */
  proposed_sla?: Partial<ServiceSLA>;
  /** Counter-proposed pricing (for 'counter' action). */
  proposed_pricing?: Partial<ContractPricing>;
  /** Counter-proposed duration (for 'counter' action). */
  proposed_duration_days?: number;
  /** Rationale. */
  rationale?: string;
}

export interface ContractNegotiateResponse {
  contract_id: string;
  status: ContractStatus;
  round: number;
  action: NegotiationAction;
  updated_at: string;
}

/** GET /api/a2a/contracts — list contracts for the authenticated agent. */
export interface ContractListResponse {
  contracts: ServiceContract[];
  count: number;
}

/** GET /api/a2a/contracts/:id — full contract details. */
export interface ContractDetailResponse {
  contract: ServiceContract;
  negotiations: NegotiationEntry[];
  violations: SLAViolation[];
}

/** POST /api/a2a/contracts/:id/terminate — early termination. */
export interface ContractTerminateRequest {
  reason: string;
}
