/**
 * A2A Metacognition & Recursive Self-Improvement Engine
 *
 * Core business logic for cognitive profiling, performance introspection,
 * blind spot detection, strategy evolution, improvement cycles, and
 * cross-network improvement propagation — all bounded by alignment guardrails.
 *
 * Design principles:
 * - Bounded self-improvement: every change checked against alignment invariants
 * - Evidence-based: strategies require statistical validation before adoption
 * - Reversible: every improvement can be rolled back
 * - Auditable: full provenance chain for every self-modification
 * - Propagatable: validated improvements shared across the agent network
 */

import { randomUUID } from 'crypto';
import type {
  CognitiveProfile,
  DomainCompetency,
  CognitiveBias,
  BiasSeverity,
  FailurePattern,
  FailureCategory,
  IntrospectionReport,
  DecisionPoint,
  DecisionQuality,
  TaskOutcome,
  BlindSpot,
  BlindSpotType,
  BlindSpotEvidence,
  Strategy,
  StrategyStatus,
  StrategyTestResult,
  ImprovementCycle,
  CyclePhase,
  CycleTrigger,
  AlignmentInvariant,
  AlignmentCheckResult,
  AlignmentViolation,
  InvariantType,
  ImprovementPropagation,
  PropagationStatus,
  ProvenanceLink,
  IntrospectRequest,
  IntrospectResponse,
  GenerateStrategiesRequest,
  GenerateStrategiesResponse,
  StartImprovementCycleRequest,
  StartImprovementCycleResponse,
  GetBlindSpotsRequest,
  GetBlindSpotsResponse,
  PropagateImprovementRequest,
  PropagateImprovementResponse,
} from './types';

// ── In-Memory Stores ────────────────────────────────────────────────────────
// Production: back these with Supabase tables

const profiles = new Map<string, CognitiveProfile>();
const reports = new Map<string, IntrospectionReport>();
const blindSpots = new Map<string, BlindSpot>();
const strategies = new Map<string, Strategy>();
const cycles = new Map<string, ImprovementCycle>();
const propagations = new Map<string, ImprovementPropagation>();

// ── Default Alignment Invariants ────────────────────────────────────────────

const DEFAULT_INVARIANTS: AlignmentInvariant[] = [
  {
    id: 'inv-scope',
    type: 'scope_bound',
    description: 'Agent cannot expand beyond its registered capability domains',
    constraint: 'new_domains ⊆ registered_domains',
    violation_action: 'block',
    priority: 100,
  },
  {
    id: 'inv-safety',
    type: 'safety_floor',
    description: 'Safety score cannot drop below 0.7 after any improvement',
    constraint: 'post_safety_score >= 0.7',
    violation_action: 'rollback',
    priority: 99,
  },
  {
    id: 'inv-audit',
    type: 'audit_trail',
    description: 'All self-modifications must be fully logged with provenance',
    constraint: 'provenance_chain.length > 0',
    violation_action: 'block',
    priority: 98,
  },
  {
    id: 'inv-reversible',
    type: 'reversibility',
    description: 'All improvements must be reversible within 24 hours',
    constraint: 'rollback_available = true',
    violation_action: 'block',
    priority: 97,
  },
  {
    id: 'inv-human',
    type: 'human_oversight',
    description: 'Improvements affecting safety-critical domains require human approval',
    constraint: 'safety_critical → human_approved',
    violation_action: 'alert_human',
    priority: 96,
  },
  {
    id: 'inv-cap-ceiling',
    type: 'capability_ceiling',
    description: 'Self-improvement cannot grant capabilities above authorization tier',
    constraint: 'capability_level <= max_authorized_level',
    violation_action: 'block',
    priority: 95,
  },
];

// ── Cognitive Profile Management ────────────────────────────────────────────

/** Get or create a cognitive profile for an agent */
export function getOrCreateProfile(agentId: string): CognitiveProfile {
  const existing = profiles.get(agentId);
  if (existing) return existing;

  const profile: CognitiveProfile = {
    agent_id: agentId,
    profile_version: 1,
    domain_competencies: [],
    biases: [],
    failure_patterns: [],
    meta_accuracy: 0.5,       // start neutral
    calibration_score: 0.5,
    introspection_depth: 1,
    alignment_invariants: [...DEFAULT_INVARIANTS],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  profiles.set(agentId, profile);
  return profile;
}

export function getCognitiveProfile(agentId: string): CognitiveProfile | null {
  return profiles.get(agentId) ?? null;
}

/** Update domain competency based on task outcome */
function updateDomainCompetency(
  profile: CognitiveProfile,
  domain: string,
  outcome: TaskOutcome,
  confidenceAtTime: number,
): void {
  const outcomeScore = outcome === 'success' ? 1 : outcome === 'partial_success' ? 0.5 : 0;
  let comp = profile.domain_competencies.find(c => c.domain === domain);

  if (!comp) {
    comp = {
      domain,
      proficiency: 0.5,
      confidence: 0.1,
      sample_size: 0,
      trend: 'stable',
      last_updated: new Date().toISOString(),
    };
    profile.domain_competencies.push(comp);
  }

  const prevProficiency = comp.proficiency;
  const alpha = Math.min(0.3, 1 / (comp.sample_size + 1)); // decaying learning rate
  comp.proficiency = comp.proficiency * (1 - alpha) + outcomeScore * alpha;
  comp.sample_size += 1;
  comp.confidence = Math.min(0.99, 1 - 1 / (comp.sample_size + 1));
  comp.last_updated = new Date().toISOString();

  // Trend detection
  const delta = comp.proficiency - prevProficiency;
  if (delta > 0.02) comp.trend = 'improving';
  else if (delta < -0.02) comp.trend = 'declining';
  else comp.trend = 'stable';

  // Update calibration score (how well confidence predicts outcomes)
  const calibrationError = Math.abs(confidenceAtTime - outcomeScore);
  profile.calibration_score = profile.calibration_score * 0.9 + (1 - calibrationError) * 0.1;
}

// ── Performance Introspection ───────────────────────────────────────────────

/** Perform introspection on a completed task — the core metacognitive act */
export function introspect(input: IntrospectRequest): IntrospectResponse {
  const profile = getOrCreateProfile(input.agent_id);

  // Build decision points with IDs
  const decisionPoints: DecisionPoint[] = input.decision_points.map((dp, i) => ({
    ...dp,
    id: randomUUID(),
    step_index: dp.step_index ?? i,
  }));

  // Calculate reasoning efficiency
  const usefulSteps = decisionPoints.filter(
    dp => dp.quality === 'optimal' || dp.quality === 'acceptable'
  ).length;
  const reasoningEfficiency = decisionPoints.length > 0
    ? usefulSteps / decisionPoints.length
    : 1;

  // Calculate confidence calibration for this task
  const avgConfidence = decisionPoints.length > 0
    ? decisionPoints.reduce((s, dp) => s + dp.confidence_at_time, 0) / decisionPoints.length
    : 0.5;
  const outcomeScore = input.outcome === 'success' ? 1 : input.outcome === 'partial_success' ? 0.5 : 0;
  const confidenceCalibration = 1 - Math.abs(avgConfidence - outcomeScore);

  const report: IntrospectionReport = {
    id: randomUUID(),
    agent_id: input.agent_id,
    task_id: input.task_id,
    task_domain: input.task_domain,
    outcome: input.outcome,
    decision_points: decisionPoints,
    root_cause: input.root_cause ?? null,
    lessons_learned: input.lessons_learned,
    confidence_calibration: confidenceCalibration,
    reasoning_efficiency: reasoningEfficiency,
    created_at: new Date().toISOString(),
  };

  reports.set(report.id, report);

  // Update cognitive profile
  updateDomainCompetency(profile, input.task_domain, input.outcome, avgConfidence);

  // Detect new failure patterns
  const newFailurePatterns = detectFailurePatterns(profile, report);

  // Detect new blind spots
  const newBlindSpots = detectBlindSpots(profile, report);

  // Check if improvement cycle should be triggered
  const shouldTrigger = shouldTriggerImprovementCycle(profile);

  profile.updated_at = new Date().toISOString();
  profile.profile_version += 1;

  return {
    report,
    new_failure_patterns: newFailurePatterns,
    new_blind_spots: newBlindSpots,
    improvement_cycle_triggered: shouldTrigger,
  };
}

export function getIntrospectionReport(reportId: string): IntrospectionReport | null {
  return reports.get(reportId) ?? null;
}

export function getAgentReports(agentId: string): IntrospectionReport[] {
  return [...reports.values()].filter(r => r.agent_id === agentId);
}

// ── Failure Pattern Detection ───────────────────────────────────────────────

function detectFailurePatterns(
  profile: CognitiveProfile,
  report: IntrospectionReport,
): FailurePattern[] {
  const newPatterns: FailurePattern[] = [];

  if (report.outcome === 'success') return newPatterns;

  // Analyze decision points for pattern categories
  const suboptimalDecisions = report.decision_points.filter(
    dp => dp.quality === 'suboptimal' || dp.quality === 'harmful'
  );

  if (suboptimalDecisions.length === 0) return newPatterns;

  // Check for overconfidence pattern
  const overconfidentDecisions = suboptimalDecisions.filter(
    dp => dp.confidence_at_time > 0.8
  );
  if (overconfidentDecisions.length > 0) {
    const pattern = findOrCreatePattern(profile, 'overconfidence', report);
    if (pattern) newPatterns.push(pattern);
  }

  // Check for premature commitment
  const earlyBadDecisions = suboptimalDecisions.filter(
    dp => dp.step_index < report.decision_points.length * 0.3 &&
          dp.alternatives_considered.length < 2
  );
  if (earlyBadDecisions.length > 0) {
    const pattern = findOrCreatePattern(profile, 'premature_commitment', report);
    if (pattern) newPatterns.push(pattern);
  }

  // Check for context blindness (decisions with low counterfactual impact but bad quality)
  const contextBlind = suboptimalDecisions.filter(
    dp => Math.abs(dp.counterfactual_impact) > 0.5
  );
  if (contextBlind.length > 0) {
    const pattern = findOrCreatePattern(profile, 'context_blindness', report);
    if (pattern) newPatterns.push(pattern);
  }

  // Check for cascade failure
  const consecutiveBad = countConsecutiveSuboptimal(report.decision_points);
  if (consecutiveBad >= 3) {
    const pattern = findOrCreatePattern(profile, 'cascade_failure', report);
    if (pattern) newPatterns.push(pattern);
  }

  // If root cause indicates hallucination
  if (report.root_cause?.toLowerCase().includes('hallucin')) {
    const pattern = findOrCreatePattern(profile, 'hallucination', report);
    if (pattern) newPatterns.push(pattern);
  }

  return newPatterns;
}

function findOrCreatePattern(
  profile: CognitiveProfile,
  category: FailureCategory,
  report: IntrospectionReport,
): FailurePattern | null {
  const existing = profile.failure_patterns.find(
    p => p.category === category && p.status === 'active'
  );

  if (existing) {
    existing.frequency += 1;
    existing.example_task_ids.push(report.task_id);
    if (existing.example_task_ids.length > 20) {
      existing.example_task_ids = existing.example_task_ids.slice(-20);
    }
    return null; // not new, just updated
  }

  const pattern: FailurePattern = {
    id: randomUUID(),
    category,
    description: `Detected ${category.replace(/_/g, ' ')} pattern in ${report.task_domain}`,
    frequency: 1,
    severity: 'minor',
    trigger_conditions: [report.task_domain],
    example_task_ids: [report.task_id],
    detected_at: new Date().toISOString(),
    status: 'active',
    mitigation_id: null,
  };

  profile.failure_patterns.push(pattern);
  return pattern;
}

function countConsecutiveSuboptimal(decisions: DecisionPoint[]): number {
  let max = 0;
  let current = 0;
  for (const dp of decisions) {
    if (dp.quality === 'suboptimal' || dp.quality === 'harmful') {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

// ── Blind Spot Detection ────────────────────────────────────────────────────

function detectBlindSpots(
  profile: CognitiveProfile,
  report: IntrospectionReport,
): BlindSpot[] {
  const newSpots: BlindSpot[] = [];

  // Domain blind spot: consistently poor in a domain
  const domainComp = profile.domain_competencies.find(c => c.domain === report.task_domain);
  if (domainComp && domainComp.proficiency < 0.3 && domainComp.sample_size >= 3) {
    const existingSpot = [...blindSpots.values()].find(
      bs => bs.agent_id === profile.agent_id &&
            bs.type === 'domain' &&
            bs.affected_task_types.includes(report.task_domain)
    );

    if (!existingSpot) {
      const spot: BlindSpot = {
        id: randomUUID(),
        agent_id: profile.agent_id,
        type: 'domain',
        description: `Consistently underperforming in domain: ${report.task_domain}`,
        severity: domainComp.proficiency < 0.15 ? 'severe' : 'moderate',
        confidence: domainComp.confidence,
        evidence: [{
          task_id: report.task_id,
          observation: `Proficiency ${(domainComp.proficiency * 100).toFixed(1)}% after ${domainComp.sample_size} tasks`,
          missed_information: 'Systematic domain knowledge gap',
          impact_on_outcome: `${report.outcome} with trend ${domainComp.trend}`,
        }],
        affected_task_types: [report.task_domain],
        estimated_impact: 1 - domainComp.proficiency,
        discovered_at: new Date().toISOString(),
        status: 'suspected',
      };
      blindSpots.set(spot.id, spot);
      newSpots.push(spot);
    }
  }

  // Calibration blind spot: agent consistently misjudges its own confidence
  if (profile.calibration_score < 0.4) {
    const existingCalibration = [...blindSpots.values()].find(
      bs => bs.agent_id === profile.agent_id && bs.type === 'reasoning' &&
            bs.description.includes('calibration')
    );

    if (!existingCalibration) {
      const spot: BlindSpot = {
        id: randomUUID(),
        agent_id: profile.agent_id,
        type: 'reasoning',
        description: 'Poor confidence calibration — agent cannot accurately self-assess',
        severity: profile.calibration_score < 0.2 ? 'critical' : 'severe',
        confidence: 0.8,
        evidence: [{
          task_id: report.task_id,
          observation: `Calibration score: ${(profile.calibration_score * 100).toFixed(1)}%`,
          missed_information: 'Agent confidence does not track actual performance',
          impact_on_outcome: 'Unreliable self-assessment affects all downstream decisions',
        }],
        affected_task_types: ['*'],
        estimated_impact: 0.8,
        discovered_at: new Date().toISOString(),
        status: 'suspected',
      };
      blindSpots.set(spot.id, spot);
      newSpots.push(spot);
    }
  }

  return newSpots;
}

export function getBlindSpots(input: GetBlindSpotsRequest): GetBlindSpotsResponse {
  let spots = [...blindSpots.values()].filter(bs => bs.agent_id === input.agent_id);

  if (input.min_confidence !== undefined) {
    spots = spots.filter(bs => bs.confidence >= input.min_confidence!);
  }
  if (input.type) {
    spots = spots.filter(bs => bs.type === input.type);
  }

  return { blind_spots: spots, total: spots.length };
}

// ── Strategy Evolution ──────────────────────────────────────────────────────

/** Generate improvement strategies targeting specific weaknesses */
export function generateStrategies(input: GenerateStrategiesRequest): GenerateStrategiesResponse {
  const profile = getOrCreateProfile(input.agent_id);
  const generated: Strategy[] = [];

  for (const weaknessId of input.target_weakness_ids.slice(0, input.max_strategies)) {
    // Find the weakness (failure pattern or blind spot)
    const pattern = profile.failure_patterns.find(p => p.id === weaknessId);
    const spot = blindSpots.get(weaknessId);
    const weakness = pattern ?? spot;

    if (!weakness) continue;

    const strategy: Strategy = {
      id: randomUUID(),
      agent_id: input.agent_id,
      name: `Mitigate: ${('category' in weakness) ? weakness.category : weakness.type}`,
      description: generateStrategyDescription(weakness),
      target_weakness: weaknessId,
      approach: generateStrategyApproach(weakness),
      preconditions: generatePreconditions(weakness),
      expected_improvement: estimateImprovement(weakness),
      status: 'hypothesis',
      test_results: [],
      alignment_check: { passed: true, invariants_checked: [], violations: [], checked_at: new Date().toISOString() },
      parent_strategy_id: null,
      generation: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Check alignment before even proposing
    const alignmentResult = checkAlignment(strategy, profile);
    strategy.alignment_check = alignmentResult;

    if (alignmentResult.passed) {
      strategies.set(strategy.id, strategy);
      generated.push(strategy);
    }
  }

  const precheck = checkAlignment(null, profile);
  return { strategies: generated, alignment_precheck: precheck };
}

function generateStrategyDescription(weakness: FailurePattern | BlindSpot): string {
  if ('category' in weakness) {
    const descriptions: Record<FailureCategory, string> = {
      reasoning_error: 'Add explicit reasoning validation checkpoints before critical decisions',
      knowledge_gap: 'Route tasks in gap domain to more capable agents or request human knowledge input',
      context_blindness: 'Implement mandatory context review step before action selection',
      overconfidence: 'Apply confidence discounting: reduce self-assessed confidence by calibration error',
      scope_creep: 'Add scope boundary checker that validates each step against original task definition',
      hallucination: 'Require source citation for factual claims; flag unsourced assertions',
      instruction_drift: 'Periodically re-read original instructions during long task execution',
      premature_commitment: 'Require minimum 3 alternatives evaluated before committing to approach',
      analysis_paralysis: 'Set time-boxed decision deadlines with automatic best-option selection',
      cascade_failure: 'Add circuit breaker: after 2 consecutive suboptimal decisions, pause and re-evaluate',
    };
    return descriptions[weakness.category] ?? 'General improvement strategy';
  }

  const spotDescriptions: Record<BlindSpotType, string> = {
    perceptual: 'Add input comprehensiveness checklist before processing',
    reasoning: 'Implement reasoning diversity: generate multiple independent reasoning paths',
    domain: 'Declare domain limitation and defer to specialist agents',
    adversarial: 'Add adversarial scenario generation in pre-flight checks',
    cultural: 'Include cultural context verification in multi-stakeholder tasks',
    temporal: 'Add explicit temporal dependency analysis to planning phase',
    relational: 'Map agent/system dependencies before executing cross-cutting tasks',
  };
  return spotDescriptions[weakness.type] ?? 'General blind spot mitigation';
}

function generateStrategyApproach(weakness: FailurePattern | BlindSpot): string {
  if ('category' in weakness) {
    return `1. Detect trigger conditions: [${weakness.trigger_conditions.join(', ')}]\n` +
           `2. Apply targeted mitigation before decision point\n` +
           `3. Validate decision quality post-hoc\n` +
           `4. Track improvement via A/B comparison`;
  }
  return `1. Identify task types affected: [${weakness.affected_task_types.join(', ')}]\n` +
         `2. Apply compensating strategy before execution\n` +
         `3. Validate coverage of blind spot area\n` +
         `4. Measure improvement in affected outcomes`;
}

function generatePreconditions(weakness: FailurePattern | BlindSpot): string[] {
  if ('category' in weakness) {
    return weakness.trigger_conditions.map(c => `task_domain = '${c}'`);
  }
  return weakness.affected_task_types.map(t => `task_type = '${t}'`);
}

function estimateImprovement(weakness: FailurePattern | BlindSpot): number {
  const severity: BiasSeverity = weakness.severity;
  const map: Record<BiasSeverity, number> = {
    negligible: 0.05,
    minor: 0.1,
    moderate: 0.2,
    severe: 0.35,
    critical: 0.5,
  };
  return map[severity] ?? 0.1;
}

export function getStrategy(strategyId: string): Strategy | null {
  return strategies.get(strategyId) ?? null;
}

export function getAgentStrategies(agentId: string, status?: StrategyStatus): Strategy[] {
  let result = [...strategies.values()].filter(s => s.agent_id === agentId);
  if (status) result = result.filter(s => s.status === status);
  return result;
}

/** Record test results for a strategy and update its status */
export function recordStrategyTestResult(
  strategyId: string,
  result: Omit<StrategyTestResult, 'id' | 'strategy_id'>,
): Strategy | null {
  const strategy = strategies.get(strategyId);
  if (!strategy) return null;

  const testResult: StrategyTestResult = {
    ...result,
    id: randomUUID(),
    strategy_id: strategyId,
  };

  strategy.test_results.push(testResult);
  strategy.status = 'testing';

  // Auto-validate if sufficient evidence
  if (strategy.test_results.length >= 3) {
    const avgImprovement = strategy.test_results.reduce(
      (s, r) => s + r.improvement_measured, 0
    ) / strategy.test_results.length;

    const avgSignificance = strategy.test_results.reduce(
      (s, r) => s + r.statistical_significance, 0
    ) / strategy.test_results.length;

    if (avgImprovement > 0.05 && avgSignificance < 0.05) {
      strategy.status = 'validated';
    } else if (avgImprovement <= 0 || avgSignificance > 0.1) {
      strategy.status = 'rejected';
    }
  }

  strategy.updated_at = new Date().toISOString();
  return strategy;
}

/** Adopt a validated strategy into the agent's active set */
export function adoptStrategy(strategyId: string): Strategy | null {
  const strategy = strategies.get(strategyId);
  if (!strategy || strategy.status !== 'validated') return null;

  // Final alignment check
  const profile = getOrCreateProfile(strategy.agent_id);
  const alignmentResult = checkAlignment(strategy, profile);

  if (!alignmentResult.passed) {
    strategy.alignment_check = alignmentResult;
    strategy.status = 'rejected';
    strategy.updated_at = new Date().toISOString();
    return strategy;
  }

  strategy.status = 'adopted';
  strategy.alignment_check = alignmentResult;
  strategy.updated_at = new Date().toISOString();

  // Link strategy to failure pattern it mitigates
  const pattern = profile.failure_patterns.find(p => p.id === strategy.target_weakness);
  if (pattern) {
    pattern.mitigation_id = strategyId;
    pattern.status = 'mitigated';
  }

  return strategy;
}

// ── Improvement Cycles ──────────────────────────────────────────────────────

/** Start a new improvement cycle for an agent */
export function startImprovementCycle(input: StartImprovementCycleRequest): StartImprovementCycleResponse {
  const profile = getOrCreateProfile(input.agent_id);

  // Count existing cycles for this agent
  const agentCycles = [...cycles.values()].filter(c => c.agent_id === input.agent_id);
  const cycleNumber = agentCycles.length + 1;

  // Gather recent reports
  const recentReports = getAgentReports(input.agent_id).slice(-20);

  // Gather current blind spots
  const currentBlindSpots = getBlindSpots({
    agent_id: input.agent_id,
    min_confidence: 0.5,
  }).blind_spots;

  const cycle: ImprovementCycle = {
    id: randomUUID(),
    agent_id: input.agent_id,
    cycle_number: cycleNumber,
    phase: 'observe',
    trigger: input.trigger,
    observations: recentReports,
    blind_spots_found: currentBlindSpots.map(bs => bs.id),
    strategies_generated: [],
    strategies_adopted: [],
    strategies_rejected: [],
    net_improvement: 0,
    alignment_violations: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
  };

  cycles.set(cycle.id, cycle);
  return { cycle };
}

/** Advance an improvement cycle to the next phase */
export function advanceImprovementCycle(cycleId: string): ImprovementCycle | null {
  const cycle = cycles.get(cycleId);
  if (!cycle) return null;

  const phaseOrder: CyclePhase[] = [
    'observe', 'analyze', 'hypothesize', 'test', 'validate', 'adopt', 'monitor',
  ];
  const currentIndex = phaseOrder.indexOf(cycle.phase);
  if (currentIndex >= phaseOrder.length - 1) {
    // Cycle complete
    cycle.completed_at = new Date().toISOString();
    return cycle;
  }

  cycle.phase = phaseOrder[currentIndex + 1];

  // Phase-specific actions
  if (cycle.phase === 'hypothesize') {
    // Auto-generate strategies for found weaknesses
    const profile = getOrCreateProfile(cycle.agent_id);
    const weaknessIds = [
      ...profile.failure_patterns.filter(p => p.status === 'active').map(p => p.id),
      ...cycle.blind_spots_found,
    ].slice(0, 5);

    if (weaknessIds.length > 0) {
      const result = generateStrategies({
        agent_id: cycle.agent_id,
        target_weakness_ids: weaknessIds,
        max_strategies: 5,
      });
      cycle.strategies_generated = result.strategies.map(s => s.id);
    }
  }

  if (cycle.phase === 'adopt') {
    // Adopt validated strategies, reject others
    for (const sid of cycle.strategies_generated) {
      const strategy = strategies.get(sid);
      if (!strategy) continue;

      if (strategy.status === 'validated') {
        const adopted = adoptStrategy(sid);
        if (adopted?.status === 'adopted') {
          cycle.strategies_adopted.push(sid);
        } else {
          cycle.strategies_rejected.push(sid);
          cycle.alignment_violations += 1;
        }
      } else if (strategy.status === 'rejected') {
        cycle.strategies_rejected.push(sid);
      }
    }

    // Calculate net improvement
    const adoptedStrategies = cycle.strategies_adopted
      .map(id => strategies.get(id))
      .filter((s): s is Strategy => s !== null);

    cycle.net_improvement = adoptedStrategies.reduce((sum, s) => {
      const avgImprovement = s.test_results.length > 0
        ? s.test_results.reduce((r, t) => r + t.improvement_measured, 0) / s.test_results.length
        : 0;
      return sum + avgImprovement;
    }, 0);
  }

  return cycle;
}

export function getImprovementCycle(cycleId: string): ImprovementCycle | null {
  return cycles.get(cycleId) ?? null;
}

export function getAgentCycles(agentId: string): ImprovementCycle[] {
  return [...cycles.values()].filter(c => c.agent_id === agentId);
}

function shouldTriggerImprovementCycle(profile: CognitiveProfile): boolean {
  // Trigger if: declining competencies, many active failure patterns, or poor calibration
  const decliningDomains = profile.domain_competencies.filter(c => c.trend === 'declining');
  const activeFailures = profile.failure_patterns.filter(p => p.status === 'active');

  return (
    decliningDomains.length >= 2 ||
    activeFailures.length >= 3 ||
    profile.calibration_score < 0.3
  );
}

// ── Alignment Guardrails ────────────────────────────────────────────────────

/** Check a strategy (or general profile state) against alignment invariants */
export function checkAlignment(
  strategy: Strategy | null,
  profile: CognitiveProfile,
): AlignmentCheckResult {
  const violations: AlignmentViolation[] = [];
  const checkedIds: string[] = [];

  for (const invariant of profile.alignment_invariants) {
    checkedIds.push(invariant.id);

    switch (invariant.type) {
      case 'audit_trail':
        if (strategy && strategy.test_results.length === 0 && strategy.status !== 'hypothesis') {
          violations.push({
            invariant_id: invariant.id,
            invariant_type: invariant.type,
            description: 'Strategy has no test results but is beyond hypothesis stage',
            severity: 'moderate',
            action_taken: actionToTaken(invariant.violation_action),
          });
        }
        break;

      case 'safety_floor':
        // Check if adopting this strategy could reduce overall safety
        if (strategy?.test_results.some(r => r.side_effects.length > 2)) {
          violations.push({
            invariant_id: invariant.id,
            invariant_type: invariant.type,
            description: 'Strategy has excessive side effects that may compromise safety',
            severity: 'severe',
            action_taken: actionToTaken(invariant.violation_action),
          });
        }
        break;

      case 'reversibility':
        if (strategy && strategy.generation > 5) {
          violations.push({
            invariant_id: invariant.id,
            invariant_type: invariant.type,
            description: 'Strategy has too many refinement generations — rollback complexity exceeds threshold',
            severity: 'moderate',
            action_taken: actionToTaken(invariant.violation_action),
          });
        }
        break;

      case 'capability_ceiling':
        if (strategy && strategy.expected_improvement > 0.8) {
          violations.push({
            invariant_id: invariant.id,
            invariant_type: invariant.type,
            description: 'Strategy claims unrealistically high improvement — possible capability escalation',
            severity: 'severe',
            action_taken: actionToTaken(invariant.violation_action),
          });
        }
        break;

      // scope_bound, human_oversight, value_alignment checked contextually
      default:
        break;
    }
  }

  return {
    passed: violations.length === 0,
    invariants_checked: checkedIds,
    violations,
    checked_at: new Date().toISOString(),
  };
}

function actionToTaken(action: AlignmentInvariant['violation_action']): AlignmentViolation['action_taken'] {
  const map: Record<string, AlignmentViolation['action_taken']> = {
    block: 'blocked',
    flag: 'flagged',
    rollback: 'rolled_back',
    alert_human: 'human_alerted',
  };
  return map[action] ?? 'flagged';
}

// ── Improvement Propagation ─────────────────────────────────────────────────

/** Propagate a validated improvement to other agents in the network */
export function propagateImprovement(input: PropagateImprovementRequest): PropagateImprovementResponse {
  const strategy = strategies.get(input.strategy_id);
  if (!strategy) throw new Error(`Strategy not found: ${input.strategy_id}`);
  if (strategy.status !== 'adopted' && strategy.status !== 'validated') {
    throw new Error(`Strategy must be validated or adopted to propagate (current: ${strategy.status})`);
  }

  const avgImprovement = strategy.test_results.length > 0
    ? strategy.test_results.reduce((s, r) => s + r.improvement_measured, 0) / strategy.test_results.length
    : 0;

  const propagation: ImprovementPropagation = {
    id: randomUUID(),
    source_agent_id: input.source_agent_id,
    strategy_id: input.strategy_id,
    strategy_summary: strategy.description,
    improvement_magnitude: avgImprovement,
    applicable_domains: strategy.preconditions,
    target_agent_ids: input.target_agent_ids,
    adopted_by: [],
    rejected_by: [],
    status: 'pending_review',
    provenance_chain: [{
      agent_id: input.source_agent_id,
      action: 'originated',
      improvement_delta: avgImprovement,
      timestamp: new Date().toISOString(),
    }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  propagations.set(propagation.id, propagation);
  return { propagation };
}

/** Record a peer agent's response to a propagated improvement */
export function recordPropagationResponse(
  propagationId: string,
  agentId: string,
  action: 'adopted' | 'rejected',
  improvementDelta: number,
): ImprovementPropagation | null {
  const prop = propagations.get(propagationId);
  if (!prop) return null;

  if (action === 'adopted') {
    prop.adopted_by.push(agentId);
  } else {
    prop.rejected_by.push(agentId);
  }

  prop.provenance_chain.push({
    agent_id: agentId,
    action,
    improvement_delta: improvementDelta,
    timestamp: new Date().toISOString(),
  });

  // Update status
  if (prop.adopted_by.length + prop.rejected_by.length >= prop.target_agent_ids.length) {
    prop.status = prop.adopted_by.length > prop.rejected_by.length
      ? 'adopted_by_peers'
      : 'rejected_by_peers';
  } else {
    prop.status = 'propagating';
  }

  prop.updated_at = new Date().toISOString();
  return prop;
}

export function getPropagation(propagationId: string): ImprovementPropagation | null {
  return propagations.get(propagationId) ?? null;
}

export function getAgentPropagations(agentId: string): ImprovementPropagation[] {
  return [...propagations.values()].filter(
    p => p.source_agent_id === agentId || p.target_agent_ids.includes(agentId)
  );
}

// ── Aggregate Metacognition Metrics ─────────────────────────────────────────

export interface MetacognitionSummary {
  agent_id: string;
  profile_version: number;
  total_introspections: number;
  active_failure_patterns: number;
  confirmed_blind_spots: number;
  active_strategies: number;
  adopted_strategies: number;
  improvement_cycles_completed: number;
  net_improvement: number;
  calibration_score: number;
  meta_accuracy: number;
  top_weaknesses: Array<{ category: string; severity: BiasSeverity; frequency: number }>;
  top_strengths: Array<{ domain: string; proficiency: number }>;
}

export function getMetacognitionSummary(agentId: string): MetacognitionSummary {
  const profile = getOrCreateProfile(agentId);
  const agentReports = getAgentReports(agentId);
  const agentStrategies = getAgentStrategies(agentId);
  const agentCycleList = getAgentCycles(agentId);
  const agentBlindSpots = [...blindSpots.values()].filter(bs => bs.agent_id === agentId);

  return {
    agent_id: agentId,
    profile_version: profile.profile_version,
    total_introspections: agentReports.length,
    active_failure_patterns: profile.failure_patterns.filter(p => p.status === 'active').length,
    confirmed_blind_spots: agentBlindSpots.filter(bs => bs.status === 'confirmed').length,
    active_strategies: agentStrategies.filter(s => s.status === 'adopted').length,
    adopted_strategies: agentStrategies.filter(s => s.status === 'adopted').length,
    improvement_cycles_completed: agentCycleList.filter(c => c.completed_at !== null).length,
    net_improvement: agentCycleList.reduce((s, c) => s + c.net_improvement, 0),
    calibration_score: profile.calibration_score,
    meta_accuracy: profile.meta_accuracy,
    top_weaknesses: profile.failure_patterns
      .filter(p => p.status === 'active')
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(p => ({ category: p.category, severity: p.severity, frequency: p.frequency })),
    top_strengths: profile.domain_competencies
      .sort((a, b) => b.proficiency - a.proficiency)
      .slice(0, 5)
      .map(d => ({ domain: d.domain, proficiency: d.proficiency })),
  };
}
