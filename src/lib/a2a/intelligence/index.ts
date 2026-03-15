// Agent Intelligence Layer — Public API
// Adaptive strategy engine: learn, experiment, evolve, share

export type {
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

export {
  // Strategy lifecycle
  registerStrategy,
  getStrategy,
  listStrategies,
  retireStrategy,
  promoteStrategy,
  // Outcome tracking
  recordOutcome,
  getOutcomes,
  // Performance evaluation
  evaluatePerformance,
  // Strategy recommendation
  recommendStrategies,
  // Experiments (A/B testing)
  createExperiment,
  getExperiment,
  listExperiments,
  selectStrategyForExperiment,
  evaluateExperiment,
  // Insight extraction
  extractInsights,
  getInsight,
  listInsights,
  shareInsight,
  // Strategy evolution
  proposeEvolution,
  acceptEvolution,
  listProposals,
  // Lineage
  getStrategyLineage,
} from './engine';

export {
  RegisterStrategySchema,
  RecordOutcomeSchema,
  CreateExperimentSchema,
  ProposeEvolutionSchema,
  RecommendSchema,
  ExtractInsightsSchema,
  ShareInsightSchema,
} from './validation';
