// Agent Intelligence Layer - Adaptive Strategy Engine
// Loop 10: The missing "brain" — agents learn from outcomes and evolve strategies

export type StrategyId = string;
export type ExperimentId = string;
export type InsightId = string;

/** A strategy is a named approach an agent uses for a task type */
export interface Strategy {
  id: StrategyId;
  agentId: string;
  capability: string; // which capability this strategy applies to
  name: string;
  description: string;
  version: number;
  parameters: Record<string, unknown>; // tunable knobs
  parentId?: StrategyId; // lineage — which strategy this evolved from
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'candidate' | 'retired' | 'archived';
}

/** Outcome of a task executed with a specific strategy */
export interface StrategyOutcome {
  id: string;
  strategyId: StrategyId;
  taskId: string;
  agentId: string;
  capability: string;
  success: boolean;
  latencyMs: number;
  qualityScore: number; // 0-1, from task feedback
  costCredits: number;
  contextSnapshot: Record<string, unknown>; // conditions when strategy was used
  recordedAt: string;
}

/** Aggregated performance stats for a strategy */
export interface StrategyPerformance {
  strategyId: StrategyId;
  totalExecutions: number;
  successRate: number;
  avgLatencyMs: number;
  avgQualityScore: number;
  avgCostCredits: number;
  p95LatencyMs: number;
  trend: 'improving' | 'stable' | 'degrading'; // computed from recent window
  confidenceInterval: number; // 0-1, based on sample size
  lastEvaluatedAt: string;
}

/** An experiment pits strategies against each other */
export interface Experiment {
  id: ExperimentId;
  agentId: string;
  capability: string;
  name: string;
  hypothesis: string;
  controlStrategyId: StrategyId;
  candidateStrategyIds: StrategyId[];
  trafficSplit: Record<StrategyId, number>; // percentage allocation
  status: 'running' | 'concluded' | 'cancelled';
  minSampleSize: number;
  startedAt: string;
  concludedAt?: string;
  winnerId?: StrategyId;
  conclusion?: string;
}

/** An insight is a learned pattern extracted from outcomes */
export interface Insight {
  id: InsightId;
  capability: string;
  sourceAgentId: string;
  type: 'correlation' | 'anti-pattern' | 'best-practice' | 'threshold' | 'context-dependency';
  title: string;
  description: string;
  evidence: {
    sampleSize: number;
    confidence: number; // 0-1
    supportingOutcomeIds: string[];
  };
  applicableWhen: Record<string, unknown>; // context conditions
  recommendation: string;
  visibility: 'private' | 'shared'; // shared = available to all agents
  createdAt: string;
}

/** Recommendation from the intelligence layer */
export interface StrategyRecommendation {
  strategyId: StrategyId;
  score: number; // 0-1 composite
  reasoning: string;
  contextMatch: number; // how well the strategy fits current context
  expectedQuality: number;
  expectedLatencyMs: number;
}

/** Evolution proposal — suggested mutation of a strategy */
export interface EvolutionProposal {
  id: string;
  parentStrategyId: StrategyId;
  agentId: string;
  capability: string;
  proposedParameters: Record<string, unknown>;
  rationale: string;
  basedOnInsights: InsightId[];
  status: 'proposed' | 'accepted' | 'rejected';
  createdAt: string;
}
