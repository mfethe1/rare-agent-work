/**
 * A2A Goal Decomposition & Multi-Agent Planning Engine
 *
 * The orchestration intelligence that transforms high-level goals into
 * optimal, dependency-aware execution plans across available agents.
 *
 * Core algorithm:
 *   1. Decompose: Break goal into sub-goal tree via recursive capability analysis
 *   2. Map: Match leaf sub-goals to agent capabilities with confidence scoring
 *   3. Optimize: Generate candidate plans and select pareto-optimal one
 *   4. Execute: Run the plan with monitoring and adaptive re-planning
 *
 * This is what separates a 2028 agent platform from a 2024 workflow tool:
 * agents express intent; the platform figures out the rest.
 */

import type {
  Goal,
  GoalConstraints,
  SubGoal,
  ExecutionPlan,
  PlanStep,
  PlanProjections,
  PlanAlternativeSummary,
  StepExecution,
  OptimizationStrategy,
  OptimizationWeights,
  ReplanContext,
  ReplanTrigger,
  CapabilityMatch,
  AgentCandidate,
} from './types';
import { STRATEGY_WEIGHTS } from './types';

// ──────────────────────────────────────────────
// In-memory stores (swap for Supabase in prod)
// ──────────────────────────────────────────────

const goals = new Map<string, Goal>();
const subGoals = new Map<string, SubGoal>();
const plans = new Map<string, ExecutionPlan>();
const replanHistory = new Map<string, ReplanContext[]>(); // goal_id → contexts

// ──────────────────────────────────────────────
// Capability Taxonomy — known decomposition patterns
// ──────────────────────────────────────────────

/**
 * Capability taxonomy for decomposition heuristics.
 * Maps high-level intent keywords to sub-capability chains.
 * In production this would be learned; here we bootstrap with curated patterns.
 */
const DECOMPOSITION_PATTERNS: Record<string, { description: string; capability: string; depends_on_indices: number[] }[]> = {
  'analyze': [
    { description: 'Gather source data', capability: 'data.collect', depends_on_indices: [] },
    { description: 'Clean and normalize data', capability: 'data.transform', depends_on_indices: [0] },
    { description: 'Run analysis', capability: 'analysis.execute', depends_on_indices: [1] },
    { description: 'Summarize findings', capability: 'report.summarize', depends_on_indices: [2] },
  ],
  'report': [
    { description: 'Research topic', capability: 'research.query', depends_on_indices: [] },
    { description: 'Synthesize research', capability: 'analysis.execute', depends_on_indices: [0] },
    { description: 'Generate report', capability: 'report.generate', depends_on_indices: [1] },
    { description: 'Quality review', capability: 'review.quality', depends_on_indices: [2] },
  ],
  'monitor': [
    { description: 'Set up data stream', capability: 'data.stream', depends_on_indices: [] },
    { description: 'Define alert thresholds', capability: 'alert.configure', depends_on_indices: [] },
    { description: 'Process events', capability: 'event.process', depends_on_indices: [0, 1] },
    { description: 'Notify stakeholders', capability: 'notification.send', depends_on_indices: [2] },
  ],
  'build': [
    { description: 'Design specification', capability: 'design.spec', depends_on_indices: [] },
    { description: 'Implement solution', capability: 'code.generate', depends_on_indices: [0] },
    { description: 'Test implementation', capability: 'test.execute', depends_on_indices: [1] },
    { description: 'Deploy artifact', capability: 'deploy.execute', depends_on_indices: [2] },
  ],
  'translate': [
    { description: 'Extract source content', capability: 'content.extract', depends_on_indices: [] },
    { description: 'Translate content', capability: 'language.translate', depends_on_indices: [0] },
    { description: 'Review translation quality', capability: 'review.quality', depends_on_indices: [1] },
  ],
  'summarize': [
    { description: 'Gather content', capability: 'data.collect', depends_on_indices: [] },
    { description: 'Generate summary', capability: 'report.summarize', depends_on_indices: [0] },
  ],
};

/** Default sub-goal pattern when no keyword matches. */
const DEFAULT_PATTERN = [
  { description: 'Gather inputs', capability: 'data.collect', depends_on_indices: [] as number[] },
  { description: 'Process task', capability: 'task.execute', depends_on_indices: [0] },
  { description: 'Validate output', capability: 'review.quality', depends_on_indices: [1] },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function defaultExecution(): StepExecution {
  return {
    status: 'pending',
    task_id: null,
    attempt: 0,
    started_at: null,
    completed_at: null,
    output: null,
    error: null,
  };
}

// ──────────────────────────────────────────────
// 1. Goal Submission
// ──────────────────────────────────────────────

export function submitGoal(
  requester_agent_id: string,
  objective: string,
  constraints: Partial<GoalConstraints> = {},
  context: Record<string, unknown> = {},
  priority: Goal['priority'] = 'normal',
): Goal {
  const goal: Goal = {
    id: uuid(),
    requester_agent_id,
    objective,
    constraints: {
      max_cost: constraints.max_cost ?? 0,
      max_latency_seconds: constraints.max_latency_seconds ?? 0,
      min_quality: constraints.min_quality ?? 0.7,
      required_agent_ids: constraints.required_agent_ids ?? [],
      excluded_agent_ids: constraints.excluded_agent_ids ?? [],
      required_capabilities: constraints.required_capabilities ?? [],
      require_approval: constraints.require_approval ?? false,
      max_replan_attempts: constraints.max_replan_attempts ?? 3,
    },
    context,
    priority,
    status: 'submitted',
    plan_id: null,
    created_at: now(),
    updated_at: now(),
  };
  goals.set(goal.id, goal);
  return goal;
}

export function getGoal(id: string): Goal | undefined {
  return goals.get(id);
}

// ──────────────────────────────────────────────
// 2. Goal Decomposition
// ──────────────────────────────────────────────

/**
 * Decompose a goal into a tree of sub-goals.
 * Uses keyword matching against the capability taxonomy to select
 * a decomposition pattern, then instantiates it as a sub-goal tree.
 */
export function decomposeGoal(goalId: string): SubGoal[] {
  const goal = goals.get(goalId);
  if (!goal) throw new Error(`Goal not found: ${goalId}`);

  goal.status = 'decomposing';
  goal.updated_at = now();

  const objectiveLower = goal.objective.toLowerCase();

  // Find best matching decomposition pattern
  let pattern = DEFAULT_PATTERN;
  let bestMatchLength = 0;
  for (const [keyword, p] of Object.entries(DECOMPOSITION_PATTERNS)) {
    if (objectiveLower.includes(keyword) && keyword.length > bestMatchLength) {
      pattern = p;
      bestMatchLength = keyword.length;
    }
  }

  // Add required capabilities as additional leaf sub-goals
  const requiredCaps = goal.constraints.required_capabilities.filter(
    cap => !pattern.some(p => p.capability === cap),
  );

  // Create sub-goals from pattern
  const created: SubGoal[] = [];
  const idMap: Record<number, string> = {};

  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    const sg: SubGoal = {
      id: uuid(),
      parent_id: null,
      goal_id: goalId,
      description: p.description,
      required_capability: p.capability,
      depends_on: p.depends_on_indices.map(idx => idMap[idx]).filter(Boolean),
      optional: false,
      estimated_cost: 0,
      estimated_duration_seconds: 0,
      depth: 0,
      children: [],
    };
    idMap[i] = sg.id;
    created.push(sg);
    subGoals.set(sg.id, sg);
  }

  // Inject required capabilities not already in the pattern
  for (const cap of requiredCaps) {
    const sg: SubGoal = {
      id: uuid(),
      parent_id: null,
      goal_id: goalId,
      description: `Required capability: ${cap}`,
      required_capability: cap,
      depends_on: [],
      optional: false,
      estimated_cost: 0,
      estimated_duration_seconds: 0,
      depth: 0,
      children: [],
    };
    created.push(sg);
    subGoals.set(sg.id, sg);
  }

  goal.status = 'planning';
  goal.updated_at = now();

  return created;
}

export function getSubGoals(goalId: string): SubGoal[] {
  return [...subGoals.values()].filter(sg => sg.goal_id === goalId);
}

// ──────────────────────────────────────────────
// 3. Capability Mapping
// ──────────────────────────────────────────────

/**
 * Simulated agent pool for capability matching.
 * In production, this calls the discovery + router subsystems.
 */
interface AgentProfile {
  id: string;
  name: string;
  capabilities: string[];
  cost_per_task: number;
  avg_duration_seconds: number;
  quality_score: number;
  success_rate: number;
  trust_score: number;
}

let agentPool: AgentProfile[] = [];

/** Register agents for the planner to consider. */
export function registerAgentPool(agents: AgentProfile[]): void {
  agentPool = agents;
}

/**
 * Map sub-goals to available agent capabilities.
 * Returns match results with candidate agents ranked by suitability.
 */
export function mapCapabilities(
  subGoalsList: SubGoal[],
  excludedAgentIds: string[] = [],
): CapabilityMatch[] {
  const matches: CapabilityMatch[] = [];

  for (const sg of subGoalsList) {
    if (!sg.required_capability) continue;

    const candidates: AgentCandidate[] = [];

    for (const agent of agentPool) {
      if (excludedAgentIds.includes(agent.id)) continue;

      // Check if agent has this capability (exact or prefix match)
      const hasCapability = agent.capabilities.some(
        cap => cap === sg.required_capability || cap.startsWith(sg.required_capability + '.'),
      );
      if (!hasCapability) continue;

      // Score the candidate
      const trustWeight = 0.25;
      const qualityWeight = 0.30;
      const reliabilityWeight = 0.25;
      const costWeight = 0.20;

      const costScore = 1.0 - Math.min(agent.cost_per_task / 100, 1.0); // Normalize
      const score =
        agent.trust_score * trustWeight +
        agent.quality_score * qualityWeight +
        agent.success_rate * reliabilityWeight +
        costScore * costWeight;

      candidates.push({
        agent_id: agent.id,
        agent_name: agent.name,
        score,
        estimated_cost: agent.cost_per_task,
        estimated_duration_seconds: agent.avg_duration_seconds,
        predicted_quality: agent.quality_score,
        success_rate: agent.success_rate,
        scoring_breakdown: {
          trust: agent.trust_score * trustWeight,
          quality: agent.quality_score * qualityWeight,
          reliability: agent.success_rate * reliabilityWeight,
          cost_efficiency: costScore * costWeight,
        },
      });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    matches.push({
      sub_goal_id: sg.id,
      capability_id: sg.required_capability,
      candidates,
      confidence: candidates.length > 0 ? candidates[0].score : 0,
    });
  }

  return matches;
}

// ──────────────────────────────────────────────
// 4. Plan Optimization
// ──────────────────────────────────────────────

/**
 * Generate an optimized execution plan from sub-goals and capability matches.
 * Considers multiple optimization strategies and selects the best one
 * that satisfies the goal's constraints.
 */
export function generatePlan(
  goalId: string,
  subGoalsList: SubGoal[],
  matches: CapabilityMatch[],
  strategy: OptimizationStrategy = 'balanced',
  replanContext?: ReplanContext,
): ExecutionPlan {
  const goal = goals.get(goalId);
  if (!goal) throw new Error(`Goal not found: ${goalId}`);

  const weights = STRATEGY_WEIGHTS[strategy];
  const matchMap = new Map(matches.map(m => [m.sub_goal_id, m]));

  // Generate the primary plan
  const steps = buildPlanSteps(subGoalsList, matchMap, weights, goal.constraints, replanContext);

  // Compute critical path
  const criticalPath = computeCriticalPath(steps);

  // Compute projections
  const projections = computeProjections(steps, criticalPath);

  // Generate alternative plans for comparison
  const alternatives = generateAlternatives(
    subGoalsList, matchMap, goal.constraints, strategy, replanContext,
  );

  const plan: ExecutionPlan = {
    id: uuid(),
    goal_id: goalId,
    version: replanContext ? replanContext.attempt + 1 : 1,
    steps,
    critical_path: criticalPath,
    projections,
    alternatives,
    selection_rationale: buildRationale(strategy, projections, alternatives),
    status: goal.constraints.require_approval ? 'draft' : 'approved',
    created_at: now(),
  };

  plans.set(plan.id, plan);
  goal.plan_id = plan.id;
  goal.status = goal.constraints.require_approval ? 'plan_ready' : 'plan_ready';
  goal.updated_at = now();

  return plan;
}

function buildPlanSteps(
  subGoalsList: SubGoal[],
  matchMap: Map<string, CapabilityMatch>,
  weights: OptimizationWeights,
  constraints: GoalConstraints,
  replanContext?: ReplanContext,
): PlanStep[] {
  const steps: PlanStep[] = [];

  for (const sg of subGoalsList) {
    // Skip completed steps from previous plan
    if (replanContext?.completed_step_ids.includes(sg.id)) continue;

    const match = matchMap.get(sg.id);
    if (!match || match.candidates.length === 0) {
      if (!sg.optional) {
        // No candidates for required sub-goal — create a step with empty agent
        // The executor will fail this gracefully
      }
      continue;
    }

    // Select best agent based on optimization weights
    const selected = selectAgent(match.candidates, weights, constraints);
    const fallback = match.candidates.length > 1
      ? match.candidates.find(c => c.agent_id !== selected.agent_id) ?? null
      : null;

    const step: PlanStep = {
      id: uuid(),
      sub_goal_id: sg.id,
      assigned_agent_id: selected.agent_id,
      agent_selection_rationale: `Score: ${selected.score.toFixed(3)} — ${Object.entries(selected.scoring_breakdown).map(([k, v]) => `${k}: ${(v as number).toFixed(2)}`).join(', ')}`,
      capability_id: match.capability_id,
      input: replanContext?.preserved_outputs[sg.id] ?? {},
      depends_on: sg.depends_on,
      projected_cost: selected.estimated_cost,
      projected_duration_seconds: selected.estimated_duration_seconds,
      projected_quality: selected.predicted_quality,
      fallback_agent_id: fallback?.agent_id ?? null,
      max_retries: sg.optional ? 1 : 3,
      execution: defaultExecution(),
    };

    steps.push(step);
  }

  return steps;
}

function selectAgent(
  candidates: AgentCandidate[],
  weights: OptimizationWeights,
  constraints: GoalConstraints,
): AgentCandidate {
  // Filter by hard constraints
  let filtered = candidates.filter(c => {
    if (constraints.excluded_agent_ids.includes(c.agent_id)) return false;
    if (constraints.min_quality > 0 && c.predicted_quality < constraints.min_quality) return false;
    return true;
  });

  // Prefer required agents if specified
  const required = filtered.filter(c => constraints.required_agent_ids.includes(c.agent_id));
  if (required.length > 0) return required[0];

  if (filtered.length === 0) filtered = candidates; // Fallback to unfiltered

  // Re-score with optimization weights
  const scored = filtered.map(c => {
    const costScore = 1.0 - Math.min(c.estimated_cost / 100, 1.0);
    const latencyScore = 1.0 - Math.min(c.estimated_duration_seconds / 300, 1.0);
    const weightedScore =
      costScore * weights.cost +
      latencyScore * weights.latency +
      c.predicted_quality * weights.quality +
      c.success_rate * weights.reliability;
    return { candidate: c, weightedScore };
  });

  scored.sort((a, b) => b.weightedScore - a.weightedScore);
  return scored[0].candidate;
}

// ──────────────────────────────────────────────
// Critical Path Analysis
// ──────────────────────────────────────────────

function computeCriticalPath(steps: PlanStep[]): string[] {
  const stepMap = new Map(steps.map(s => [s.sub_goal_id, s]));

  // Build adjacency and compute longest path via topological sort
  const visited = new Set<string>();
  const distances = new Map<string, number>();
  const predecessors = new Map<string, string | null>();

  function longestPath(stepId: string): number {
    if (distances.has(stepId)) return distances.get(stepId)!;
    visited.add(stepId);

    const step = stepMap.get(stepId);
    if (!step) return 0;

    let maxDist = 0;
    let maxPred: string | null = null;

    for (const depId of step.depends_on) {
      const depStep = stepMap.get(depId);
      if (!depStep) continue;
      const dist = longestPath(depId) + depStep.projected_duration_seconds;
      if (dist > maxDist) {
        maxDist = dist;
        maxPred = depId;
      }
    }

    distances.set(stepId, maxDist);
    predecessors.set(stepId, maxPred);
    return maxDist;
  }

  // Find terminal steps (no one depends on them)
  const dependedOn = new Set(steps.flatMap(s => s.depends_on));
  const terminals = steps.filter(s => !dependedOn.has(s.sub_goal_id));

  // Compute longest paths for all terminals
  let maxTerminal = '';
  let maxDist = -1;
  for (const t of terminals) {
    const dist = longestPath(t.sub_goal_id) + t.projected_duration_seconds;
    if (dist > maxDist) {
      maxDist = dist;
      maxTerminal = t.sub_goal_id;
    }
  }

  // Trace back the critical path
  const path: string[] = [];
  let current: string | null = maxTerminal;
  while (current) {
    const step = stepMap.get(current);
    if (step) path.unshift(step.id);
    current = predecessors.get(current) ?? null;
  }

  return path;
}

// ──────────────────────────────────────────────
// Projections
// ──────────────────────────────────────────────

function computeProjections(steps: PlanStep[], criticalPath: string[]): PlanProjections {
  const totalCost = steps.reduce((sum, s) => sum + s.projected_cost, 0);

  // Critical path duration = sum of durations on the critical path
  const cpStepIds = new Set(criticalPath);
  const cpDuration = steps
    .filter(s => cpStepIds.has(s.id))
    .reduce((sum, s) => sum + s.projected_duration_seconds, 0);

  const avgQuality = steps.length > 0
    ? steps.reduce((sum, s) => sum + s.projected_quality, 0) / steps.length
    : 0;

  // Success probability = product of individual step probabilities
  // (simplified: use projected_quality as proxy for success rate)
  const successProb = steps.reduce((prod, s) => prod * Math.max(s.projected_quality, 0.5), 1.0);

  // Max parallelism: count steps with no dependencies that can run concurrently
  const depFreeLayers = computeParallelLayers(steps);
  const maxParallelism = Math.max(...depFreeLayers.map(l => l.length), 1);

  return {
    total_cost: Math.round(totalCost * 100) / 100,
    total_duration_seconds: cpDuration,
    average_quality: Math.round(avgQuality * 1000) / 1000,
    success_probability: Math.round(successProb * 1000) / 1000,
    critical_path_length: criticalPath.length,
    max_parallelism: maxParallelism,
  };
}

function computeParallelLayers(steps: PlanStep[]): PlanStep[][] {
  const layers: PlanStep[][] = [];
  const placed = new Set<string>();

  while (placed.size < steps.length) {
    const layer = steps.filter(s =>
      !placed.has(s.sub_goal_id) &&
      s.depends_on.every(d => placed.has(d)),
    );
    if (layer.length === 0) break; // Circular dependency guard
    layers.push(layer);
    for (const s of layer) placed.add(s.sub_goal_id);
  }

  return layers;
}

// ──────────────────────────────────────────────
// Alternative Plans
// ──────────────────────────────────────────────

function generateAlternatives(
  subGoalsList: SubGoal[],
  matchMap: Map<string, CapabilityMatch>,
  constraints: GoalConstraints,
  primaryStrategy: OptimizationStrategy,
  replanContext?: ReplanContext,
): PlanAlternativeSummary[] {
  const allStrategies: OptimizationStrategy[] = [
    'balanced', 'minimize_cost', 'minimize_latency', 'maximize_quality', 'maximize_reliability',
  ];

  const alternatives: PlanAlternativeSummary[] = [];

  for (const strategy of allStrategies) {
    if (strategy === primaryStrategy) continue;

    const weights = STRATEGY_WEIGHTS[strategy];
    const steps = buildPlanSteps(subGoalsList, matchMap, weights, constraints, replanContext);
    const criticalPath = computeCriticalPath(steps);
    const projections = computeProjections(steps, criticalPath);

    // Determine why this wasn't selected
    let rejectionReason = `Not the primary strategy (${primaryStrategy} preferred)`;
    if (constraints.max_cost > 0 && projections.total_cost > constraints.max_cost) {
      rejectionReason = `Exceeds cost constraint: ${projections.total_cost} > ${constraints.max_cost}`;
    } else if (constraints.max_latency_seconds > 0 && projections.total_duration_seconds > constraints.max_latency_seconds) {
      rejectionReason = `Exceeds latency constraint: ${projections.total_duration_seconds}s > ${constraints.max_latency_seconds}s`;
    }

    alternatives.push({ strategy, projections, rejection_reason: rejectionReason });
  }

  return alternatives.slice(0, 3); // Top 3
}

function buildRationale(
  strategy: OptimizationStrategy,
  projections: PlanProjections,
  alternatives: PlanAlternativeSummary[],
): string {
  const parts = [
    `Strategy: ${strategy}.`,
    `Projected: cost=${projections.total_cost}, duration=${projections.total_duration_seconds}s, quality=${projections.average_quality}, success=${projections.success_probability}.`,
    `Critical path: ${projections.critical_path_length} steps, max parallelism: ${projections.max_parallelism}.`,
  ];
  if (alternatives.length > 0) {
    parts.push(`Considered ${alternatives.length} alternative strategies.`);
  }
  return parts.join(' ');
}

// ──────────────────────────────────────────────
// 5. Plan Execution
// ──────────────────────────────────────────────

/**
 * Advance plan execution by one tick.
 * Returns steps that are ready to execute and updates step states.
 * The caller is responsible for actually dispatching tasks to agents.
 */
export function advancePlan(planId: string): {
  ready: PlanStep[];
  completed: boolean;
  failed: boolean;
  needs_replan: ReplanTrigger | null;
} {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const goal = goals.get(plan.goal_id);

  // Update step states based on dependencies
  const completedIds = new Set(
    plan.steps.filter(s => s.execution.status === 'succeeded').map(s => s.sub_goal_id),
  );

  const ready: PlanStep[] = [];
  let anyFailed = false;

  for (const step of plan.steps) {
    if (step.execution.status === 'succeeded' || step.execution.status === 'skipped') continue;

    // Check if all dependencies are met
    const depsReady = step.depends_on.every(d => completedIds.has(d));

    if (depsReady && step.execution.status === 'pending') {
      step.execution.status = 'ready';
    }

    if (step.execution.status === 'ready') {
      ready.push(step);
    }

    if (step.execution.status === 'failed') {
      anyFailed = true;
    }
  }

  const allDone = plan.steps.every(
    s => s.execution.status === 'succeeded' || s.execution.status === 'skipped',
  );

  if (allDone) {
    plan.status = 'succeeded';
    if (goal) {
      goal.status = 'completed';
      goal.updated_at = now();
    }
  }

  // Check if we need re-planning
  let needsReplan: ReplanTrigger | null = null;
  if (anyFailed) {
    const failedStep = plan.steps.find(s => s.execution.status === 'failed');
    needsReplan = {
      reason: 'step_failed',
      failed_step_id: failedStep?.id ?? null,
      description: `Step ${failedStep?.capability_id} failed after ${failedStep?.execution.attempt} attempts`,
      triggered_at: now(),
    };
  }

  return { ready, completed: allDone, failed: anyFailed && !needsReplan, needs_replan: needsReplan };
}

/**
 * Record the completion of a plan step.
 */
export function completeStep(
  planId: string,
  stepId: string,
  output: Record<string, unknown>,
): void {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const step = plan.steps.find(s => s.id === stepId);
  if (!step) throw new Error(`Step not found: ${stepId}`);

  step.execution.status = 'succeeded';
  step.execution.output = output;
  step.execution.completed_at = now();
}

/**
 * Record the failure of a plan step. Handles retry and fallback logic.
 */
export function failStep(
  planId: string,
  stepId: string,
  error: string,
): { action: 'retry' | 'fallback' | 'failed'; new_agent_id?: string } {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const step = plan.steps.find(s => s.id === stepId);
  if (!step) throw new Error(`Step not found: ${stepId}`);

  step.execution.attempt++;
  step.execution.error = error;

  // Try retry
  if (step.execution.attempt < step.max_retries) {
    step.execution.status = 'retrying';
    return { action: 'retry' };
  }

  // Try fallback agent
  if (step.fallback_agent_id) {
    step.execution.status = 'falling_back';
    step.assigned_agent_id = step.fallback_agent_id;
    step.fallback_agent_id = null; // Only one fallback
    step.execution.attempt = 0;
    return { action: 'fallback', new_agent_id: step.assigned_agent_id };
  }

  // Final failure
  step.execution.status = 'failed';
  return { action: 'failed' };
}

// ──────────────────────────────────────────────
// 6. Re-planning
// ──────────────────────────────────────────────

/**
 * Create a re-plan context from the current plan state,
 * preserving completed work and blacklisting failed agents.
 */
export function createReplanContext(
  planId: string,
  trigger: ReplanTrigger,
): ReplanContext | null {
  const plan = plans.get(planId);
  if (!plan) return null;

  const goal = goals.get(plan.goal_id);
  if (!goal) return null;

  const history = replanHistory.get(goal.id) ?? [];
  if (history.length >= goal.constraints.max_replan_attempts) {
    goal.status = 'failed';
    goal.updated_at = now();
    return null; // Exhausted re-plan budget
  }

  // Collect completed work
  const completedSteps = plan.steps.filter(s => s.execution.status === 'succeeded');
  const preservedOutputs: Record<string, Record<string, unknown>> = {};
  for (const s of completedSteps) {
    if (s.execution.output) {
      preservedOutputs[s.sub_goal_id] = s.execution.output;
    }
  }

  // Blacklist agents that failed
  const failedAgentIds = plan.steps
    .filter(s => s.execution.status === 'failed')
    .map(s => s.assigned_agent_id);

  const ctx: ReplanContext = {
    previous_plan_id: planId,
    completed_step_ids: completedSteps.map(s => s.sub_goal_id),
    preserved_outputs: preservedOutputs,
    trigger,
    blacklisted_agent_ids: [...new Set(failedAgentIds)],
    attempt: history.length + 1,
  };

  history.push(ctx);
  replanHistory.set(goal.id, history);

  // Mark old plan as superseded
  plan.status = 'superseded';
  goal.status = 'replanning';
  goal.updated_at = now();

  return ctx;
}

// ──────────────────────────────────────────────
// 7. Full Pipeline — decompose → map → plan
// ──────────────────────────────────────────────

/**
 * One-shot: submit a goal and get a fully optimized execution plan.
 * This is the primary entry point for the planning engine.
 */
export function planGoal(
  requester_agent_id: string,
  objective: string,
  options: {
    constraints?: Partial<GoalConstraints>;
    context?: Record<string, unknown>;
    priority?: Goal['priority'];
    strategy?: OptimizationStrategy;
  } = {},
): { goal: Goal; subGoals: SubGoal[]; matches: CapabilityMatch[]; plan: ExecutionPlan } {
  const goal = submitGoal(
    requester_agent_id,
    objective,
    options.constraints,
    options.context,
    options.priority,
  );

  const sgs = decomposeGoal(goal.id);
  const matches = mapCapabilities(sgs, goal.constraints.excluded_agent_ids);
  const plan = generatePlan(goal.id, sgs, matches, options.strategy ?? 'balanced');

  return { goal, subGoals: sgs, matches, plan };
}

export function getPlan(id: string): ExecutionPlan | undefined {
  return plans.get(id);
}

export function getReplanHistory(goalId: string): ReplanContext[] {
  return replanHistory.get(goalId) ?? [];
}
