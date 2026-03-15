/**
 * Autonomic Agent Nervous System
 *
 * Self-aware, predictive runtime intelligence for the A2A ecosystem.
 * Provides vital signs monitoring, anomaly detection, predictive health
 * forecasting, autonomous self-healing, and dependency graph analysis.
 *
 * Loop 29.
 */

export { AutonomicEngine } from './engine';

export type {
  Anomaly,
  AnomalySeverity,
  AnomalyType,
  AgentCluster,
  AgentDependency,
  ContributingFactor,
  DependencyGraph,
  HealingAction,
  HealingActionType,
  HealingResult,
  HealingStatus,
  HealthPrediction,
  HomeostasisPolicy,
  PredictionType,
  RecommendedAction,
  SystemHomeostasis,
  VitalSign,
  VitalSignCategory,
  VitalSignSummary,
  VitalSignWindow,
} from './types';

export {
  recordVitalSignSchema,
  queryAnomaliesSchema,
  createPolicySchema,
  triggerHealingSchema,
  getPredictionsSchema,
  buildDependencyGraphSchema,
} from './types';
