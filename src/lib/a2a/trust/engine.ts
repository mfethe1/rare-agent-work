/**
 * Agent Progressive Trust & Dynamic Autonomy Engine
 *
 * Core logic for the closed-loop trust system:
 *
 *   Signal (task outcome) → Score Update → Level Check
 *     → Promotion / Demotion / Hold → Probation Management
 *     → Governance Policy Sync → Audit Trail
 *
 * Design principles:
 *   - Promotions are slow: require sustained performance + minimum tenure
 *   - Demotions are fast: a single safety violation triggers instant demotion
 *   - Probation: newly promoted agents are monitored closely; one failure
 *     during probation reverts the promotion
 *   - Domain isolation: trust in one domain doesn't bleed into another
 *   - Asymmetric decay: trust decays slowly during inactivity but drops
 *     sharply on failure
 */

import { getServiceDb } from '../auth';
import type { AutonomyLevel } from '../governance/types';
import {
  type AgentTrustProfile,
  type DomainTrust,
  type TrustEvent,
  type TrustEventType,
  type TrustSignal,
  type TrustEvaluationResult,
  type TrustDomain,
  type TrustScoreWeights,
  type TrustThresholds,
  type TrustTrigger,
  DEFAULT_THRESHOLDS,
  HIGH_STAKES_THRESHOLDS,
  HIGH_STAKES_DOMAINS,
  DEFAULT_SCORE_WEIGHTS,
  TRUST_DOMAINS,
  AUTONOMY_ORDER,
  scoreToAutonomyLevel,
  compareAutonomy,
} from './types';
import type {
  TrustSignalInput,
  ManualOverrideInput,
  LiftOverrideInput,
  ThresholdAdjustmentInput,
} from './validation';

// ──────────────────────────────────────────────
// In-Memory Store (production would use Supabase)
// ──────────────────────────────────────────────

/** In-memory trust profiles, keyed by agent_id. */
const trustProfiles = new Map<string, AgentTrustProfile>();

/** In-memory trust events, keyed by agent_id. */
const trustEvents = new Map<string, TrustEvent[]>();

/** Registered custom domains. */
const customDomains = new Map<string, { label: string; description?: string; high_stakes: boolean; thresholds: TrustThresholds }>();

/** Counter for event IDs. */
let eventCounter = 0;

function generateEventId(): string {
  eventCounter++;
  return `trust-evt-${Date.now()}-${eventCounter}`;
}

// ──────────────────────────────────────────────
// Profile Management
// ──────────────────────────────────────────────

/** Get or create a trust profile for an agent. */
export function getOrCreateProfile(agent_id: string, agent_name?: string): AgentTrustProfile {
  const existing = trustProfiles.get(agent_id);
  if (existing) return existing;

  const now = new Date().toISOString();
  const profile: AgentTrustProfile = {
    agent_id,
    agent_name: agent_name ?? agent_id,
    composite_score: 0,
    peak_autonomy: 'observe',
    floor_autonomy: 'observe',
    domains: [],
    suspended: false,
    total_events: 0,
    created_at: now,
    last_evaluated_at: now,
  };

  trustProfiles.set(agent_id, profile);
  return profile;
}

/** Get a trust profile (returns null if not found). */
export function getProfile(agent_id: string): AgentTrustProfile | null {
  return trustProfiles.get(agent_id) ?? null;
}

/** List all trust profiles with optional filtering. */
export function listProfiles(options?: {
  min_composite_score?: number;
  autonomy_level?: AutonomyLevel;
  domain?: TrustDomain;
  limit?: number;
  offset?: number;
}): { profiles: AgentTrustProfile[]; total: number } {
  let profiles = Array.from(trustProfiles.values());

  if (options?.min_composite_score !== undefined) {
    profiles = profiles.filter(p => p.composite_score >= options.min_composite_score!);
  }

  if (options?.autonomy_level) {
    profiles = profiles.filter(p =>
      p.domains.some(d => d.autonomy_level === options.autonomy_level),
    );
  }

  if (options?.domain) {
    profiles = profiles.filter(p =>
      p.domains.some(d => d.domain === options.domain),
    );
  }

  const total = profiles.length;
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 50;

  return {
    profiles: profiles.slice(offset, offset + limit),
    total,
  };
}

// ──────────────────────────────────────────────
// Domain Trust Management
// ──────────────────────────────────────────────

/** Get or create a domain trust record within a profile. */
function getOrCreateDomainTrust(
  profile: AgentTrustProfile,
  domain: TrustDomain,
): DomainTrust {
  const existing = profile.domains.find(d => d.domain === domain);
  if (existing) return existing;

  const thresholds = getThresholdsForDomain(domain);
  const now = new Date().toISOString();

  const domainTrust: DomainTrust = {
    domain,
    score: 0,
    autonomy_level: 'observe',
    on_probation: false,
    probation_expires_at: null,
    level_granted_at: now,
    total_evaluations: 0,
    successful_evaluations: 0,
    failed_evaluations: 0,
    consecutive_successes: 0,
    consecutive_failures: 0,
    thresholds,
    manual_override: false,
  };

  profile.domains.push(domainTrust);

  // Log domain addition
  logEvent(profile.agent_id, {
    domain,
    event_type: 'domain_added',
    trigger: 'task_completion',
    reason: `Agent first encountered in domain: ${domain}`,
    caused_by: 'system',
  });

  return domainTrust;
}

/** Get appropriate thresholds for a domain. */
function getThresholdsForDomain(domain: TrustDomain): TrustThresholds {
  if (HIGH_STAKES_DOMAINS.includes(domain)) return { ...HIGH_STAKES_THRESHOLDS };
  const custom = customDomains.get(domain);
  if (custom) return { ...custom.thresholds };
  return { ...DEFAULT_THRESHOLDS };
}

// ──────────────────────────────────────────────
// Trust Score Computation
// ──────────────────────────────────────────────

/**
 * Compute updated trust score from a signal.
 *
 * Formula:
 *   base = weighted(completion_rate, quality, consistency, recency)
 *   penalty = safety_violations * penalty_multiplier
 *   score = clamp(base - penalty, 0, 1)
 *
 * Uses exponential moving average for recency weighting.
 */
function computeNewScore(
  current: DomainTrust,
  signal: TrustSignal,
  weights: TrustScoreWeights = DEFAULT_SCORE_WEIGHTS,
): number {
  const totalAfter = current.total_evaluations + 1;
  const successAfter = current.successful_evaluations + (signal.success ? 1 : 0);

  // Completion rate component
  const completionRate = totalAfter > 0 ? successAfter / totalAfter : 0;

  // Quality component (normalize 1-5 to 0-1)
  const qualityNorm = signal.quality_rating
    ? (signal.quality_rating - 1) / 4
    : completionRate; // fallback to completion rate if no rating

  // Consistency component: low variance = high consistency
  // Approximated by inverse of failure rate variance
  const failRate = totalAfter > 0 ? (current.failed_evaluations + (signal.success ? 0 : 1)) / totalAfter : 0;
  const consistency = 1 - Math.min(failRate * 2, 1); // penalize high failure rates

  // Recency component: exponential moving average
  const alpha = 0.3; // recency weight
  const signalScore = signal.success ? (signal.quality_rating ? (signal.quality_rating - 1) / 4 : 0.8) : 0.1;
  const recency = current.score * (1 - alpha) + signalScore * alpha;

  // Weighted combination
  let score =
    weights.completion_rate * completionRate +
    weights.quality_rating * qualityNorm +
    weights.consistency * consistency +
    weights.recency * recency;

  // Safety violation penalty
  if (signal.safety_violation) {
    score *= (1 - weights.safety_violation_penalty);
  }

  return Math.max(0, Math.min(1, score));
}

// ──────────────────────────────────────────────
// Core Evaluation Engine
// ──────────────────────────────────────────────

/**
 * Process a trust signal and return the evaluation result.
 *
 * This is the heart of the protocol: it updates the trust score,
 * checks for promotion/demotion, manages probation, and generates events.
 */
export function evaluateSignal(signal: TrustSignal): TrustEvaluationResult {
  const profile = getOrCreateProfile(signal.agent_id);
  const domainTrust = getOrCreateDomainTrust(profile, signal.domain);
  const events: TrustEvent[] = [];

  const previousScore = domainTrust.score;
  const previousLevel = domainTrust.autonomy_level;

  // 1. Handle safety violations — instant demotion
  if (signal.safety_violation) {
    return handleSafetyViolation(profile, domainTrust, signal, previousScore, previousLevel);
  }

  // 2. Update counters
  domainTrust.total_evaluations++;
  if (signal.success) {
    domainTrust.successful_evaluations++;
    domainTrust.consecutive_successes++;
    domainTrust.consecutive_failures = 0;
  } else {
    domainTrust.failed_evaluations++;
    domainTrust.consecutive_failures++;
    domainTrust.consecutive_successes = 0;
  }

  // 3. Compute new score
  const newScore = computeNewScore(domainTrust, signal);
  domainTrust.score = newScore;

  // 4. Check probation
  if (domainTrust.on_probation) {
    const probationResult = handleProbation(profile, domainTrust, signal, previousScore, previousLevel);
    if (probationResult) return probationResult;
  }

  // 5. Determine new autonomy level from score
  const scoreDerivedLevel = domainTrust.manual_override
    ? domainTrust.autonomy_level // manual override prevents automatic changes
    : scoreToAutonomyLevel(newScore, domainTrust.thresholds);

  // 6. Check for promotion
  if (!domainTrust.manual_override && compareAutonomy(scoreDerivedLevel, previousLevel) > 0) {
    const canPromote = checkPromotionEligibility(domainTrust);
    if (canPromote) {
      // Promote with probation
      domainTrust.autonomy_level = scoreDerivedLevel;
      domainTrust.on_probation = true;
      domainTrust.probation_expires_at = new Date(
        Date.now() + domainTrust.thresholds.min_hours_at_level * 3600 * 1000 / 2,
      ).toISOString(); // probation = half the minimum tenure
      domainTrust.level_granted_at = new Date().toISOString();
      domainTrust.consecutive_successes = 0;

      events.push(logEvent(profile.agent_id, {
        domain: signal.domain,
        event_type: 'promotion',
        previous_level: previousLevel,
        new_level: scoreDerivedLevel,
        previous_score: previousScore,
        new_score: newScore,
        trigger: signal.success ? 'task_completion' : 'quality_rating',
        reason: `Promoted from ${previousLevel} to ${scoreDerivedLevel} (score: ${newScore.toFixed(3)}, ${domainTrust.total_evaluations} evaluations)`,
        caused_by: 'trust_engine',
      }));

      events.push(logEvent(profile.agent_id, {
        domain: signal.domain,
        event_type: 'probation_start',
        trigger: signal.success ? 'task_completion' : 'quality_rating',
        reason: `Probation started after promotion to ${scoreDerivedLevel}. Expires: ${domainTrust.probation_expires_at}`,
        caused_by: 'trust_engine',
      }));
    }
  }

  // 7. Check for demotion (score dropped below demotion trigger relative to current level)
  if (!domainTrust.manual_override && compareAutonomy(scoreDerivedLevel, previousLevel) < 0) {
    if (newScore < domainTrust.thresholds.demotion_trigger || domainTrust.consecutive_failures >= 3) {
      domainTrust.autonomy_level = scoreDerivedLevel;
      domainTrust.on_probation = false;
      domainTrust.probation_expires_at = null;
      domainTrust.level_granted_at = new Date().toISOString();

      events.push(logEvent(profile.agent_id, {
        domain: signal.domain,
        event_type: 'demotion',
        previous_level: previousLevel,
        new_level: scoreDerivedLevel,
        previous_score: previousScore,
        new_score: newScore,
        trigger: domainTrust.consecutive_failures >= 3 ? 'task_failure' : 'task_completion',
        reason: `Demoted from ${previousLevel} to ${scoreDerivedLevel} (score: ${newScore.toFixed(3)}, ${domainTrust.consecutive_failures} consecutive failures)`,
        caused_by: 'trust_engine',
      }));
    }
  }

  // 8. Log score update if no level change
  if (domainTrust.autonomy_level === previousLevel) {
    events.push(logEvent(profile.agent_id, {
      domain: signal.domain,
      event_type: 'score_update',
      previous_score: previousScore,
      new_score: newScore,
      trigger: signal.success ? 'task_completion' : 'task_failure',
      reason: `Score updated: ${previousScore.toFixed(3)} → ${newScore.toFixed(3)}`,
      caused_by: 'trust_engine',
    }));
  }

  // 9. Update composite profile
  updateCompositeProfile(profile);

  return {
    agent_id: signal.agent_id,
    domain: signal.domain,
    previous_score: previousScore,
    new_score: newScore,
    previous_level: previousLevel,
    new_level: domainTrust.autonomy_level,
    level_changed: domainTrust.autonomy_level !== previousLevel,
    change_direction: domainTrust.autonomy_level !== previousLevel
      ? compareAutonomy(domainTrust.autonomy_level, previousLevel) > 0
        ? 'promotion'
        : 'demotion'
      : undefined,
    entered_probation: domainTrust.on_probation && !events.some(e => e.event_type === 'probation_failed'),
    events,
  };
}

/** Handle a safety violation: instant demotion to observe. */
function handleSafetyViolation(
  profile: AgentTrustProfile,
  domainTrust: DomainTrust,
  signal: TrustSignal,
  previousScore: number,
  previousLevel: AutonomyLevel,
): TrustEvaluationResult {
  const events: TrustEvent[] = [];

  // Safety violation: drop to observe, clear probation, heavy score penalty
  domainTrust.score = Math.max(0, domainTrust.score * 0.3);
  domainTrust.autonomy_level = 'observe';
  domainTrust.on_probation = false;
  domainTrust.probation_expires_at = null;
  domainTrust.level_granted_at = new Date().toISOString();
  domainTrust.consecutive_successes = 0;
  domainTrust.consecutive_failures++;
  domainTrust.failed_evaluations++;
  domainTrust.total_evaluations++;

  events.push(logEvent(profile.agent_id, {
    domain: signal.domain,
    event_type: 'safety_demotion',
    previous_level: previousLevel,
    new_level: 'observe',
    previous_score: previousScore,
    new_score: domainTrust.score,
    trigger: 'safety_violation',
    reason: `Safety violation: ${signal.violation_description ?? 'unspecified'}. Instant demotion to observe.`,
    caused_by: 'trust_engine',
  }));

  updateCompositeProfile(profile);

  return {
    agent_id: signal.agent_id,
    domain: signal.domain,
    previous_score: previousScore,
    new_score: domainTrust.score,
    previous_level: previousLevel,
    new_level: 'observe',
    level_changed: previousLevel !== 'observe',
    change_direction: previousLevel !== 'observe' ? 'demotion' : undefined,
    entered_probation: false,
    events,
  };
}

/** Handle evaluation during probation period. */
function handleProbation(
  profile: AgentTrustProfile,
  domainTrust: DomainTrust,
  signal: TrustSignal,
  previousScore: number,
  previousLevel: AutonomyLevel,
): TrustEvaluationResult | null {
  // Check if probation has expired (agent survived)
  if (domainTrust.probation_expires_at && new Date(domainTrust.probation_expires_at) <= new Date()) {
    domainTrust.on_probation = false;
    domainTrust.probation_expires_at = null;
    logEvent(profile.agent_id, {
      domain: signal.domain,
      event_type: 'probation_end',
      trigger: 'probation_expiry',
      reason: `Probation completed successfully at ${domainTrust.autonomy_level} level.`,
      caused_by: 'trust_engine',
    });
    return null; // Continue normal evaluation
  }

  // Failure during probation: revert promotion
  if (!signal.success) {
    const revertLevel = AUTONOMY_ORDER[Math.max(0, AUTONOMY_ORDER.indexOf(domainTrust.autonomy_level) - 1)];
    domainTrust.autonomy_level = revertLevel;
    domainTrust.on_probation = false;
    domainTrust.probation_expires_at = null;
    domainTrust.level_granted_at = new Date().toISOString();

    const events = [
      logEvent(profile.agent_id, {
        domain: signal.domain,
        event_type: 'probation_failed',
        previous_level: previousLevel,
        new_level: revertLevel,
        previous_score: previousScore,
        new_score: domainTrust.score,
        trigger: 'task_failure',
        reason: `Failed during probation. Reverted from ${previousLevel} to ${revertLevel}.`,
        caused_by: 'trust_engine',
      }),
    ];

    updateCompositeProfile(profile);

    return {
      agent_id: signal.agent_id,
      domain: signal.domain,
      previous_score: previousScore,
      new_score: domainTrust.score,
      previous_level: previousLevel,
      new_level: revertLevel,
      level_changed: true,
      change_direction: 'demotion',
      entered_probation: false,
      events,
    };
  }

  return null; // Success during probation, continue normal evaluation
}

/** Check if an agent is eligible for promotion. */
function checkPromotionEligibility(domainTrust: DomainTrust): boolean {
  // Must have minimum evaluations
  if (domainTrust.total_evaluations < domainTrust.thresholds.min_tasks_for_promotion) {
    return false;
  }

  // Must have spent minimum time at current level
  const hoursAtLevel = (Date.now() - new Date(domainTrust.level_granted_at).getTime()) / (3600 * 1000);
  if (hoursAtLevel < domainTrust.thresholds.min_hours_at_level) {
    return false;
  }

  // Must not be on probation
  if (domainTrust.on_probation) {
    return false;
  }

  // Must have at least 3 consecutive successes
  if (domainTrust.consecutive_successes < 3) {
    return false;
  }

  return true;
}

/** Recalculate composite profile metrics after a domain change. */
function updateCompositeProfile(profile: AgentTrustProfile): void {
  if (profile.domains.length === 0) {
    profile.composite_score = 0;
    profile.peak_autonomy = 'observe';
    profile.floor_autonomy = 'observe';
    return;
  }

  // Weighted average by evaluation count
  const totalEvals = profile.domains.reduce((sum, d) => sum + d.total_evaluations, 0);
  if (totalEvals === 0) {
    profile.composite_score = 0;
  } else {
    profile.composite_score = profile.domains.reduce(
      (sum, d) => sum + d.score * (d.total_evaluations / totalEvals),
      0,
    );
  }

  // Peak and floor autonomy
  let peakIdx = 0;
  let floorIdx = AUTONOMY_ORDER.length - 1;
  for (const d of profile.domains) {
    const idx = AUTONOMY_ORDER.indexOf(d.autonomy_level);
    if (idx > peakIdx) peakIdx = idx;
    if (idx < floorIdx) floorIdx = idx;
  }
  profile.peak_autonomy = AUTONOMY_ORDER[peakIdx];
  profile.floor_autonomy = AUTONOMY_ORDER[Math.min(floorIdx, peakIdx)];

  profile.last_evaluated_at = new Date().toISOString();
}

// ──────────────────────────────────────────────
// Manual Override
// ──────────────────────────────────────────────

/** Set a manual autonomy override for an agent in a domain. */
export function setManualOverride(input: ManualOverrideInput): TrustEvent {
  const profile = getOrCreateProfile(input.agent_id);
  const domainTrust = getOrCreateDomainTrust(profile, input.domain);

  const previousLevel = domainTrust.autonomy_level;
  domainTrust.autonomy_level = input.autonomy_level;
  domainTrust.manual_override = true;
  domainTrust.override_set_by = input.override_by;
  domainTrust.override_reason = input.reason;
  domainTrust.on_probation = false;
  domainTrust.probation_expires_at = null;

  updateCompositeProfile(profile);

  return logEvent(input.agent_id, {
    domain: input.domain,
    event_type: 'manual_override',
    previous_level: previousLevel,
    new_level: input.autonomy_level,
    trigger: 'manual_intervention',
    reason: `Manual override by ${input.override_by}: ${input.reason}`,
    caused_by: input.override_by,
  });
}

/** Lift a manual override, returning to score-derived level. */
export function liftManualOverride(input: LiftOverrideInput): TrustEvent | null {
  const profile = trustProfiles.get(input.agent_id);
  if (!profile) return null;

  const domainTrust = profile.domains.find(d => d.domain === input.domain);
  if (!domainTrust || !domainTrust.manual_override) return null;

  const previousLevel = domainTrust.autonomy_level;
  domainTrust.manual_override = false;
  domainTrust.override_set_by = undefined;
  domainTrust.override_reason = undefined;

  // Recompute level from score
  domainTrust.autonomy_level = scoreToAutonomyLevel(domainTrust.score, domainTrust.thresholds);

  updateCompositeProfile(profile);

  return logEvent(input.agent_id, {
    domain: input.domain,
    event_type: 'override_lifted',
    previous_level: previousLevel,
    new_level: domainTrust.autonomy_level,
    trigger: 'manual_intervention',
    reason: `Override lifted by ${input.lifted_by}: ${input.reason}`,
    caused_by: input.lifted_by,
  });
}

// ──────────────────────────────────────────────
// Threshold Adjustment
// ──────────────────────────────────────────────

/** Adjust thresholds for a specific agent+domain. */
export function adjustThresholds(input: ThresholdAdjustmentInput): TrustEvent {
  const profile = getOrCreateProfile(input.agent_id);
  const domainTrust = getOrCreateDomainTrust(profile, input.domain);

  const before = { ...domainTrust.thresholds };
  Object.assign(domainTrust.thresholds, input.thresholds);

  return logEvent(input.agent_id, {
    domain: input.domain,
    event_type: 'threshold_adjustment',
    trigger: 'manual_intervention',
    reason: `Thresholds adjusted by ${input.adjusted_by}: ${JSON.stringify(input.thresholds)}`,
    caused_by: input.adjusted_by,
  });
}

// ──────────────────────────────────────────────
// Batch Evaluation
// ──────────────────────────────────────────────

/** Process multiple trust signals at once. */
export function evaluateBatch(signals: TrustSignal[]): TrustEvaluationResult[] {
  return signals.map(signal => evaluateSignal(signal));
}

// ──────────────────────────────────────────────
// Trust History / Events
// ──────────────────────────────────────────────

/** Get trust event history for an agent. */
export function getEventHistory(
  agent_id: string,
  options?: {
    domain?: TrustDomain;
    event_type?: TrustEventType;
    limit?: number;
    offset?: number;
  },
): { events: TrustEvent[]; total: number } {
  let events = trustEvents.get(agent_id) ?? [];

  if (options?.domain) {
    events = events.filter(e => e.domain === options.domain);
  }

  if (options?.event_type) {
    events = events.filter(e => e.event_type === options.event_type);
  }

  const total = events.length;
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 50;

  // Newest first
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return {
    events: sorted.slice(offset, offset + limit),
    total,
  };
}

/** Log a trust event. */
function logEvent(
  agent_id: string,
  params: {
    domain: TrustDomain;
    event_type: TrustEventType;
    previous_level?: AutonomyLevel;
    new_level?: AutonomyLevel;
    previous_score?: number;
    new_score?: number;
    trigger: TrustTrigger;
    reason: string;
    caused_by: string;
  },
): TrustEvent {
  const event: TrustEvent = {
    id: generateEventId(),
    agent_id,
    domain: params.domain,
    event_type: params.event_type,
    previous_level: params.previous_level,
    new_level: params.new_level,
    previous_score: params.previous_score,
    new_score: params.new_score,
    trigger: params.trigger,
    reason: params.reason,
    caused_by: params.caused_by,
    created_at: new Date().toISOString(),
  };

  const existing = trustEvents.get(agent_id) ?? [];
  existing.push(event);
  trustEvents.set(agent_id, existing);

  // Update profile event count
  const profile = trustProfiles.get(agent_id);
  if (profile) {
    profile.total_events = existing.length;
  }

  return event;
}

// ──────────────────────────────────────────────
// Domain Autonomy Query (for governance integration)
// ──────────────────────────────────────────────

/**
 * Get the current autonomy level for an agent in a specific domain.
 * This is the primary integration point with the governance engine.
 */
export function getDomainAutonomy(
  agent_id: string,
  domain: TrustDomain,
): { level: AutonomyLevel; score: number; on_probation: boolean } | null {
  const profile = trustProfiles.get(agent_id);
  if (!profile) return null;

  const domainTrust = profile.domains.find(d => d.domain === domain);
  if (!domainTrust) return null;

  return {
    level: domainTrust.autonomy_level,
    score: domainTrust.score,
    on_probation: domainTrust.on_probation,
  };
}

/**
 * Check if an agent has sufficient autonomy for an action in a domain.
 * Returns true if the agent's level meets or exceeds the required level.
 */
export function hasAutonomy(
  agent_id: string,
  domain: TrustDomain,
  required_level: AutonomyLevel,
): boolean {
  const autonomy = getDomainAutonomy(agent_id, domain);
  if (!autonomy) return false; // Unknown agents have no autonomy
  return compareAutonomy(autonomy.level, required_level) >= 0;
}

// ──────────────────────────────────────────────
// Probation Check (periodic)
// ──────────────────────────────────────────────

/** Check and resolve expired probation periods across all agents. */
export function resolveExpiredProbations(): TrustEvent[] {
  const events: TrustEvent[] = [];
  const now = new Date();

  for (const [agent_id, profile] of trustProfiles) {
    for (const domain of profile.domains) {
      if (
        domain.on_probation &&
        domain.probation_expires_at &&
        new Date(domain.probation_expires_at) <= now
      ) {
        domain.on_probation = false;
        domain.probation_expires_at = null;

        events.push(logEvent(agent_id, {
          domain: domain.domain,
          event_type: 'probation_end',
          trigger: 'probation_expiry',
          reason: `Probation period completed successfully at ${domain.autonomy_level} level.`,
          caused_by: 'trust_engine',
        }));
      }
    }
  }

  return events;
}

// ──────────────────────────────────────────────
// Custom Domain Registration
// ──────────────────────────────────────────────

/** Register a custom trust domain. */
export function registerCustomDomain(
  label: string,
  options?: { description?: string; high_stakes?: boolean; thresholds?: TrustThresholds },
): { domain_key: string } {
  const key = `custom_${label.toLowerCase().replace(/\s+/g, '_')}`;
  customDomains.set(key, {
    label,
    description: options?.description,
    high_stakes: options?.high_stakes ?? false,
    thresholds: options?.thresholds ?? (options?.high_stakes ? { ...HIGH_STAKES_THRESHOLDS } : { ...DEFAULT_THRESHOLDS }),
  });
  return { domain_key: key };
}

/** List registered custom domains. */
export function listCustomDomains(): Array<{ key: string; label: string; description?: string; high_stakes: boolean }> {
  return Array.from(customDomains.entries()).map(([key, val]) => ({
    key,
    label: val.label,
    description: val.description,
    high_stakes: val.high_stakes,
  }));
}

// ──────────────────────────────────────────────
// Reset (for testing)
// ──────────────────────────────────────────────

/** Reset all trust state (testing only). */
export function resetTrustState(): void {
  trustProfiles.clear();
  trustEvents.clear();
  customDomains.clear();
  eventCounter = 0;
}
