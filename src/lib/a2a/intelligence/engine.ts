// Agent Intelligence Engine - Adaptive Strategy & Learning System
// The "brain" of the A2A ecosystem: agents learn, adapt, and evolve

import { randomUUID } from 'crypto';
import type {
  Strategy,
  StrategyId,
  StrategyOutcome,
  StrategyPerformance,
  Experiment,
  ExperimentId,
  Insight,
  InsightId,
  StrategyRecommendation,
  EvolutionProposal,
} from './types';

// ── In-memory stores (swap for DB in production) ──────────────────────
const strategies = new Map<StrategyId, Strategy>();
const outcomes: StrategyOutcome[] = [];
const experiments = new Map<ExperimentId, Experiment>();
const insights = new Map<InsightId, Insight>();
const proposals: EvolutionProposal[] = [];

// ── Strategy Registry ─────────────────────────────────────────────────

export function registerStrategy(
  agentId: string,
  capability: string,
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  parentId?: StrategyId
): Strategy {
  const id = `strat_${randomUUID()}`;
  const now = new Date().toISOString();
  const strategy: Strategy = {
    id,
    agentId,
    capability,
    name,
    description,
    version: parentId ? (strategies.get(parentId)?.version ?? 0) + 1 : 1,
    parameters,
    parentId,
    createdAt: now,
    updatedAt: now,
    status: parentId ? 'candidate' : 'active',
  };
  strategies.set(id, strategy);
  return strategy;
}

export function getStrategy(id: StrategyId): Strategy | undefined {
  return strategies.get(id);
}

export function listStrategies(agentId: string, capability?: string): Strategy[] {
  return Array.from(strategies.values()).filter(
    (s) => s.agentId === agentId && (!capability || s.capability === capability)
  );
}

export function retireStrategy(id: StrategyId): Strategy | undefined {
  const s = strategies.get(id);
  if (!s) return undefined;
  s.status = 'retired';
  s.updatedAt = new Date().toISOString();
  return s;
}

export function promoteStrategy(id: StrategyId): Strategy | undefined {
  const s = strategies.get(id);
  if (!s || s.status !== 'candidate') return undefined;
  s.status = 'active';
  s.updatedAt = new Date().toISOString();
  return s;
}

// ── Outcome Recording ─────────────────────────────────────────────────

export function recordOutcome(
  strategyId: StrategyId,
  taskId: string,
  agentId: string,
  capability: string,
  result: {
    success: boolean;
    latencyMs: number;
    qualityScore: number;
    costCredits: number;
    contextSnapshot?: Record<string, unknown>;
  }
): StrategyOutcome {
  const outcome: StrategyOutcome = {
    id: `out_${randomUUID()}`,
    strategyId,
    taskId,
    agentId,
    capability,
    success: result.success,
    latencyMs: result.latencyMs,
    qualityScore: result.qualityScore,
    costCredits: result.costCredits,
    contextSnapshot: result.contextSnapshot ?? {},
    recordedAt: new Date().toISOString(),
  };
  outcomes.push(outcome);
  return outcome;
}

export function getOutcomes(strategyId: StrategyId, limit = 100): StrategyOutcome[] {
  return outcomes
    .filter((o) => o.strategyId === strategyId)
    .slice(-limit);
}

// ── Performance Evaluation ────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeTrend(recent: StrategyOutcome[], older: StrategyOutcome[]): 'improving' | 'stable' | 'degrading' {
  if (recent.length < 3 || older.length < 3) return 'stable';
  const recentAvg = recent.reduce((s, o) => s + o.qualityScore, 0) / recent.length;
  const olderAvg = older.reduce((s, o) => s + o.qualityScore, 0) / older.length;
  const delta = recentAvg - olderAvg;
  if (delta > 0.05) return 'improving';
  if (delta < -0.05) return 'degrading';
  return 'stable';
}

export function evaluatePerformance(strategyId: StrategyId): StrategyPerformance | undefined {
  const stratOutcomes = outcomes.filter((o) => o.strategyId === strategyId);
  if (stratOutcomes.length === 0) return undefined;

  const successes = stratOutcomes.filter((o) => o.success).length;
  const latencies = stratOutcomes.map((o) => o.latencyMs).sort((a, b) => a - b);
  const mid = Math.floor(stratOutcomes.length / 2);

  return {
    strategyId,
    totalExecutions: stratOutcomes.length,
    successRate: successes / stratOutcomes.length,
    avgLatencyMs: latencies.reduce((s, l) => s + l, 0) / latencies.length,
    avgQualityScore:
      stratOutcomes.reduce((s, o) => s + o.qualityScore, 0) / stratOutcomes.length,
    avgCostCredits:
      stratOutcomes.reduce((s, o) => s + o.costCredits, 0) / stratOutcomes.length,
    p95LatencyMs: percentile(latencies, 95),
    trend: computeTrend(stratOutcomes.slice(mid), stratOutcomes.slice(0, mid)),
    confidenceInterval: Math.min(1, stratOutcomes.length / 30), // saturates at 30 samples
    lastEvaluatedAt: new Date().toISOString(),
  };
}

// ── Strategy Recommendation ───────────────────────────────────────────

export function recommendStrategies(
  agentId: string,
  capability: string,
  context: Record<string, unknown> = {},
  topK = 3
): StrategyRecommendation[] {
  const candidates = listStrategies(agentId, capability).filter(
    (s) => s.status === 'active' || s.status === 'candidate'
  );

  // Also include shared insights as boosters
  const sharedInsights = Array.from(insights.values()).filter(
    (i) => i.capability === capability && i.visibility === 'shared'
  );

  const scored: StrategyRecommendation[] = candidates.map((strat) => {
    const perf = evaluatePerformance(strat.id);
    if (!perf || perf.totalExecutions < 2) {
      // Exploration bonus for untested strategies
      return {
        strategyId: strat.id,
        score: 0.5, // encourage exploration
        reasoning: 'Insufficient data — exploration bonus applied',
        contextMatch: 0.5,
        expectedQuality: 0.5,
        expectedLatencyMs: 0,
      };
    }

    // Context match: check how similar current context is to past successful contexts
    const successfulOutcomes = getOutcomes(strat.id).filter((o) => o.success);
    const contextMatch = computeContextMatch(context, successfulOutcomes);

    // Insight boost: if shared insights recommend this approach
    const insightBoost = sharedInsights.reduce((boost, insight) => {
      const paramOverlap = Object.keys(insight.applicableWhen).some(
        (k) => context[k] !== undefined
      );
      return paramOverlap ? boost + 0.05 * insight.evidence.confidence : boost;
    }, 0);

    const score =
      perf.successRate * 0.35 +
      perf.avgQualityScore * 0.30 +
      contextMatch * 0.20 +
      (perf.trend === 'improving' ? 0.1 : perf.trend === 'stable' ? 0.05 : 0) +
      insightBoost;

    return {
      strategyId: strat.id,
      score: Math.min(1, score),
      reasoning: `${perf.totalExecutions} executions, ${(perf.successRate * 100).toFixed(0)}% success, trend: ${perf.trend}`,
      contextMatch,
      expectedQuality: perf.avgQualityScore,
      expectedLatencyMs: perf.avgLatencyMs,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

function computeContextMatch(
  current: Record<string, unknown>,
  successfulOutcomes: StrategyOutcome[]
): number {
  if (successfulOutcomes.length === 0 || Object.keys(current).length === 0) return 0.5;

  let matchSum = 0;
  for (const outcome of successfulOutcomes) {
    const snap = outcome.contextSnapshot;
    const keys = Object.keys(current);
    const matching = keys.filter((k) => snap[k] === current[k]).length;
    matchSum += keys.length > 0 ? matching / keys.length : 0;
  }
  return matchSum / successfulOutcomes.length;
}

// ── Experiments (A/B Testing) ─────────────────────────────────────────

export function createExperiment(
  agentId: string,
  capability: string,
  name: string,
  hypothesis: string,
  controlStrategyId: StrategyId,
  candidateStrategyIds: StrategyId[],
  minSampleSize = 20
): Experiment {
  const allIds = [controlStrategyId, ...candidateStrategyIds];
  const splitPct = Math.floor(100 / allIds.length);
  const trafficSplit: Record<string, number> = {};
  allIds.forEach((id, i) => {
    trafficSplit[id] = i === 0 ? 100 - splitPct * (allIds.length - 1) : splitPct;
  });

  const experiment: Experiment = {
    id: `exp_${randomUUID()}`,
    agentId,
    capability,
    name,
    hypothesis,
    controlStrategyId,
    candidateStrategyIds,
    trafficSplit,
    status: 'running',
    minSampleSize,
    startedAt: new Date().toISOString(),
  };
  experiments.set(experiment.id, experiment);
  return experiment;
}

export function getExperiment(id: ExperimentId): Experiment | undefined {
  return experiments.get(id);
}

export function listExperiments(agentId: string): Experiment[] {
  return Array.from(experiments.values()).filter((e) => e.agentId === agentId);
}

/** Select which strategy to use based on experiment traffic split */
export function selectStrategyForExperiment(experimentId: ExperimentId): StrategyId | undefined {
  const exp = experiments.get(experimentId);
  if (!exp || exp.status !== 'running') return undefined;

  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const [stratId, pct] of Object.entries(exp.trafficSplit)) {
    cumulative += pct;
    if (roll <= cumulative) return stratId;
  }
  return exp.controlStrategyId;
}

/** Evaluate experiment and conclude if enough data */
export function evaluateExperiment(experimentId: ExperimentId): Experiment | undefined {
  const exp = experiments.get(experimentId);
  if (!exp || exp.status !== 'running') return exp;

  const allIds = [exp.controlStrategyId, ...exp.candidateStrategyIds];
  const perfs = allIds.map((id) => ({ id, perf: evaluatePerformance(id) }));

  // Check if all strategies have enough samples
  const allReady = perfs.every(
    (p) => p.perf && p.perf.totalExecutions >= exp.minSampleSize
  );
  if (!allReady) return exp;

  // Find winner by composite score (quality * success rate)
  let bestId = exp.controlStrategyId;
  let bestScore = 0;
  for (const { id, perf } of perfs) {
    if (!perf) continue;
    const score = perf.avgQualityScore * perf.successRate;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  exp.status = 'concluded';
  exp.concludedAt = new Date().toISOString();
  exp.winnerId = bestId;

  const controlPerf = perfs.find((p) => p.id === exp.controlStrategyId)?.perf;
  const winnerPerf = perfs.find((p) => p.id === bestId)?.perf;
  if (controlPerf && winnerPerf) {
    const qualityDelta = (
      (winnerPerf.avgQualityScore - controlPerf.avgQualityScore) * 100
    ).toFixed(1);
    exp.conclusion =
      bestId === exp.controlStrategyId
        ? 'Control strategy performed best — no change needed'
        : `Candidate ${bestId} outperformed control by ${qualityDelta}% quality`;
  }

  // Auto-promote winner, retire losers
  if (bestId !== exp.controlStrategyId) {
    promoteStrategy(bestId);
    retireStrategy(exp.controlStrategyId);
  }
  for (const candId of exp.candidateStrategyIds) {
    if (candId !== bestId) retireStrategy(candId);
  }

  return exp;
}

// ── Insight Extraction ────────────────────────────────────────────────

export function extractInsights(
  capability: string,
  agentId: string,
  minSampleSize = 10
): Insight[] {
  const capOutcomes = outcomes.filter(
    (o) => o.capability === capability && o.agentId === agentId
  );
  if (capOutcomes.length < minSampleSize) return [];

  const extracted: Insight[] = [];

  // 1. Detect quality correlation with context keys
  const contextKeys = new Set<string>();
  for (const o of capOutcomes) {
    Object.keys(o.contextSnapshot).forEach((k) => contextKeys.add(k));
  }

  for (const key of contextKeys) {
    const withKey = capOutcomes.filter((o) => o.contextSnapshot[key] !== undefined);
    const withoutKey = capOutcomes.filter((o) => o.contextSnapshot[key] === undefined);
    if (withKey.length < 5 || withoutKey.length < 5) continue;

    const avgWith = withKey.reduce((s, o) => s + o.qualityScore, 0) / withKey.length;
    const avgWithout = withoutKey.reduce((s, o) => s + o.qualityScore, 0) / withoutKey.length;
    const delta = avgWith - avgWithout;

    if (Math.abs(delta) > 0.1) {
      const insight: Insight = {
        id: `ins_${randomUUID()}`,
        capability,
        sourceAgentId: agentId,
        type: 'context-dependency',
        title: `Context key "${key}" ${delta > 0 ? 'improves' : 'degrades'} quality`,
        description: `When "${key}" is present in context, average quality is ${(delta * 100).toFixed(1)}% ${delta > 0 ? 'higher' : 'lower'}`,
        evidence: {
          sampleSize: withKey.length + withoutKey.length,
          confidence: Math.min(1, (withKey.length + withoutKey.length) / 50),
          supportingOutcomeIds: withKey.slice(0, 10).map((o) => o.id),
        },
        applicableWhen: { [key]: delta > 0 ? 'present' : 'absent' },
        recommendation:
          delta > 0
            ? `Ensure "${key}" is included in task context for better results`
            : `Consider filtering out "${key}" from context — it correlates with lower quality`,
        visibility: 'private',
        createdAt: new Date().toISOString(),
      };
      insights.set(insight.id, insight);
      extracted.push(insight);
    }
  }

  // 2. Detect anti-patterns: strategies with high failure rate
  const strategyGroups = new Map<StrategyId, StrategyOutcome[]>();
  for (const o of capOutcomes) {
    const group = strategyGroups.get(o.strategyId) ?? [];
    group.push(o);
    strategyGroups.set(o.strategyId, group);
  }

  for (const [stratId, group] of strategyGroups) {
    if (group.length < 5) continue;
    const failRate = group.filter((o) => !o.success).length / group.length;
    if (failRate > 0.5) {
      const strat = strategies.get(stratId);
      const insight: Insight = {
        id: `ins_${randomUUID()}`,
        capability,
        sourceAgentId: agentId,
        type: 'anti-pattern',
        title: `Strategy "${strat?.name ?? stratId}" has ${(failRate * 100).toFixed(0)}% failure rate`,
        description: `Over ${group.length} executions, this strategy fails more than half the time`,
        evidence: {
          sampleSize: group.length,
          confidence: Math.min(1, group.length / 30),
          supportingOutcomeIds: group.filter((o) => !o.success).slice(0, 10).map((o) => o.id),
        },
        applicableWhen: {},
        recommendation: 'Consider retiring this strategy or evolving its parameters',
        visibility: 'private',
        createdAt: new Date().toISOString(),
      };
      insights.set(insight.id, insight);
      extracted.push(insight);
    }
  }

  // 3. Detect best practices: consistently high-quality strategies
  for (const [stratId, group] of strategyGroups) {
    if (group.length < 5) continue;
    const avgQuality = group.reduce((s, o) => s + o.qualityScore, 0) / group.length;
    const successRate = group.filter((o) => o.success).length / group.length;
    if (avgQuality > 0.8 && successRate > 0.9) {
      const strat = strategies.get(stratId);
      const insight: Insight = {
        id: `ins_${randomUUID()}`,
        capability,
        sourceAgentId: agentId,
        type: 'best-practice',
        title: `Strategy "${strat?.name ?? stratId}" is consistently excellent`,
        description: `${(avgQuality * 100).toFixed(0)}% avg quality, ${(successRate * 100).toFixed(0)}% success over ${group.length} executions`,
        evidence: {
          sampleSize: group.length,
          confidence: Math.min(1, group.length / 30),
          supportingOutcomeIds: group.filter((o) => o.success).slice(0, 10).map((o) => o.id),
        },
        applicableWhen: {},
        recommendation: 'Use as baseline for experiments; consider sharing with ecosystem',
        visibility: 'private',
        createdAt: new Date().toISOString(),
      };
      insights.set(insight.id, insight);
      extracted.push(insight);
    }
  }

  return extracted;
}

export function getInsight(id: InsightId): Insight | undefined {
  return insights.get(id);
}

export function listInsights(capability?: string, visibility?: 'private' | 'shared'): Insight[] {
  return Array.from(insights.values()).filter(
    (i) =>
      (!capability || i.capability === capability) &&
      (!visibility || i.visibility === visibility)
  );
}

export function shareInsight(id: InsightId): Insight | undefined {
  const insight = insights.get(id);
  if (!insight) return undefined;
  insight.visibility = 'shared';
  return insight;
}

// ── Strategy Evolution ────────────────────────────────────────────────

export function proposeEvolution(
  parentStrategyId: StrategyId,
  agentId: string,
  proposedParameters: Record<string, unknown>,
  rationale: string,
  basedOnInsights: InsightId[] = []
): EvolutionProposal | undefined {
  const parent = strategies.get(parentStrategyId);
  if (!parent) return undefined;

  const proposal: EvolutionProposal = {
    id: `evo_${randomUUID()}`,
    parentStrategyId,
    agentId,
    capability: parent.capability,
    proposedParameters,
    rationale,
    basedOnInsights,
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };
  proposals.push(proposal);
  return proposal;
}

export function acceptEvolution(proposalId: string): Strategy | undefined {
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!proposal || proposal.status !== 'proposed') return undefined;

  const parent = strategies.get(proposal.parentStrategyId);
  if (!parent) return undefined;

  proposal.status = 'accepted';

  // Create evolved strategy as candidate
  return registerStrategy(
    proposal.agentId,
    proposal.capability,
    `${parent.name} v${(parent.version ?? 0) + 1}`,
    `Evolved from ${parent.name}: ${proposal.rationale}`,
    { ...parent.parameters, ...proposal.proposedParameters },
    proposal.parentStrategyId
  );
}

export function listProposals(agentId: string): EvolutionProposal[] {
  return proposals.filter((p) => p.agentId === agentId);
}

// ── Lineage Tracing ───────────────────────────────────────────────────

export function getStrategyLineage(strategyId: StrategyId): Strategy[] {
  const lineage: Strategy[] = [];
  let current = strategies.get(strategyId);
  while (current) {
    lineage.unshift(current);
    current = current.parentId ? strategies.get(current.parentId) : undefined;
  }
  return lineage;
}
