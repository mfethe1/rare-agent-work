/**
 * A2A World Model & Environmental Grounding Engine
 *
 * Core business logic for environmental perception, world state graph
 * maintenance, predictive dynamics, grounded planning, reality drift
 * detection, and multi-agent shared ontology.
 *
 * Design principles:
 * - Sensor-agnostic: any external system can be observed through a unified interface
 * - Continuously updated: world state is a living graph, not a static snapshot
 * - Predictive: agents don't just react to state — they anticipate future state
 * - Grounded planning: actions are validated against reality before execution
 * - Drift-aware: model divergence from reality is detected and corrected automatically
 * - Shared: multiple agents contribute to and consume a coherent collective world model
 */

import { randomUUID } from 'crypto';
import type {
  SensorConfig,
  SensorType,
  Observation,
  ConflictRecord,
  WorldEntity,
  PropertyValue,
  PropertyHistoryEntry,
  WorldRelation,
  WorldStateSnapshot,
  DynamicsModel,
  PredictionMethod,
  Prediction,
  PredictionValidation,
  WorldAction,
  ActionStatus,
  WorldCondition,
  WorldEffect,
  DriftEvent,
  DriftCause,
  OntologyTerm,
  EntityResolution,
  RegisterSensorRequest,
  RegisterSensorResponse,
  IngestObservationRequest,
  IngestObservationResponse,
  QueryWorldStateRequest,
  QueryWorldStateResponse,
  PredictRequest,
  PredictResponse,
  ValidateActionRequest,
  ValidateActionResponse,
  DetectDriftRequest,
  DetectDriftResponse,
  ResolveEntitiesRequest,
  ResolveEntitiesResponse,
} from './types';

// ── In-Memory Stores ────────────────────────────────────────────────────────
// Production: back these with Supabase tables

const sensors = new Map<string, SensorConfig>();
const observations = new Map<string, Observation>();
const entities = new Map<string, WorldEntity>();
const relations = new Map<string, WorldRelation>();
const dynamicsModels = new Map<string, DynamicsModel>();
const predictions = new Map<string, Prediction>();
const actions = new Map<string, WorldAction>();
const driftEvents = new Map<string, DriftEvent>();
const ontologyTerms = new Map<string, OntologyTerm>();
const entityResolutions = new Map<string, EntityResolution>();

// Indexes for efficient lookup
const sensorsByAgent = new Map<string, Set<string>>();
const entitiesByType = new Map<string, Set<string>>();
const relationsByEntity = new Map<string, Set<string>>();
const observationsBySensor = new Map<string, string[]>();
const driftByEntity = new Map<string, string[]>();

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_PROPERTY_HISTORY = 100;
const DRIFT_CONFIRMATION_THRESHOLD = 3;
const DEFAULT_MAX_STALENESS_MS = 300_000; // 5 minutes
const EXISTENCE_DECAY_RATE = 0.001; // per second without observation
const MAX_SENSORS_PER_AGENT = 50;
const SIMILARITY_THRESHOLD_DEFAULT = 0.7;

// ── 1. Sensor Registration & Management ─────────────────────────────────────

/**
 * Register a new sensor for observing external system state.
 * Each sensor defines how to connect to an external system, what data to
 * extract, and how to map that data to world-model entities.
 */
export function registerSensor(req: RegisterSensorRequest): RegisterSensorResponse {
  const agentSensors = sensorsByAgent.get(req.agent_id) ?? new Set();

  if (agentSensors.size >= MAX_SENSORS_PER_AGENT) {
    return {
      sensor_id: '',
      status: 'rejected',
      reason: `Agent ${req.agent_id} has reached the maximum of ${MAX_SENSORS_PER_AGENT} sensors`,
    };
  }

  const sensorId = `sensor-${randomUUID()}`;
  const sensor: SensorConfig = {
    ...req.sensor,
    id: sensorId,
    reliability: 1.0, // Starts at 100%, decays with failures
  };

  sensors.set(sensorId, sensor);
  agentSensors.add(sensorId);
  sensorsByAgent.set(req.agent_id, agentSensors);
  observationsBySensor.set(sensorId, []);

  return { sensor_id: sensorId, status: 'registered' };
}

/** Retrieve a sensor by ID */
export function getSensor(sensorId: string): SensorConfig | undefined {
  return sensors.get(sensorId);
}

/** List all sensors for an agent */
export function listAgentSensors(agentId: string): SensorConfig[] {
  const sensorIds = sensorsByAgent.get(agentId) ?? new Set();
  return Array.from(sensorIds)
    .map((id) => sensors.get(id))
    .filter((s): s is SensorConfig => s !== undefined);
}

/** Update sensor reliability based on success/failure */
function updateSensorReliability(sensorId: string, success: boolean): void {
  const sensor = sensors.get(sensorId);
  if (!sensor) return;

  // Exponential moving average: recent results weighted more
  const alpha = 0.1;
  sensor.reliability = sensor.reliability * (1 - alpha) + (success ? 1 : 0) * alpha;
}

// ── 2. Observation Ingestion ────────────────────────────────────────────────

/**
 * Ingest an observation from a sensor. This is the primary input to the
 * world model — raw external state is transformed into entity updates.
 */
export function ingestObservation(req: IngestObservationRequest): IngestObservationResponse {
  const sensor = sensors.get(req.sensor_id);
  if (!sensor) {
    throw new Error(`Unknown sensor: ${req.sensor_id}`);
  }

  const now = new Date().toISOString();
  const timestamp = req.timestamp ?? now;

  // Create the observation record
  const observation: Observation = {
    id: `obs-${randomUUID()}`,
    sensor_id: req.sensor_id,
    timestamp,
    data: req.data,
    confidence: sensor.reliability,
    latency_ms: Date.now() - new Date(timestamp).getTime(),
    conflicts: [],
  };

  // Apply entity mappings to update world state
  let entitiesUpdated = 0;
  let entitiesCreated = 0;
  const conflicts: ConflictRecord[] = [];
  const detectedDrifts: DriftEvent[] = [];

  for (const mapping of sensor.extraction_schema.entity_mapping) {
    const rawValue = req.data[mapping.field];
    if (rawValue === undefined && mapping.target_property !== '') continue;

    const entityId = resolveEntityId(
      mapping.target_entity_type,
      mapping.field,
      rawValue,
      mapping.identity_resolver
    );

    let entity = entities.get(entityId);
    if (!entity) {
      entity = createEntity(entityId, mapping.target_entity_type, String(rawValue));
      entitiesCreated++;
    } else {
      entitiesUpdated++;
    }

    // Check for conflicts with existing state
    const existingProp = entity.properties.get(mapping.target_property);
    if (existingProp && existingProp.value !== rawValue) {
      const conflict: ConflictRecord = {
        entity_id: entityId,
        property: mapping.target_property,
        expected_value: existingProp.value,
        observed_value: rawValue,
        resolution: sensor.reliability > 0.8 ? 'accept_new' : 'flag_for_review',
      };
      conflicts.push(conflict);

      // Check if this constitutes reality drift
      const drift = checkForDrift(entityId, mapping.target_property, existingProp.value, rawValue);
      if (drift) detectedDrifts.push(drift);
    }

    // Update the property
    updateEntityProperty(
      entity,
      mapping.target_property,
      rawValue,
      req.sensor_id,
      observation.id,
      observation.confidence,
      timestamp
    );

    // Track which sensors observe this entity
    if (!entity.observed_by.includes(req.sensor_id)) {
      entity.observed_by.push(req.sensor_id);
    }
    entity.updated_at = timestamp;
  }

  observation.conflicts = conflicts;
  observations.set(observation.id, observation);

  const sensorObs = observationsBySensor.get(req.sensor_id) ?? [];
  sensorObs.push(observation.id);
  observationsBySensor.set(req.sensor_id, sensorObs);

  updateSensorReliability(req.sensor_id, true);

  return {
    observation_id: observation.id,
    entities_updated: entitiesUpdated,
    entities_created: entitiesCreated,
    conflicts,
    drift_events: detectedDrifts,
  };
}

// ── 3. World State Graph ────────────────────────────────────────────────────

/** Create a new entity in the world model */
function createEntity(id: string, type: string, name: string): WorldEntity {
  const now = new Date().toISOString();
  const entity: WorldEntity = {
    id,
    type,
    name,
    properties: new Map(),
    created_at: now,
    updated_at: now,
    observed_by: [],
    existence_confidence: 1.0,
    tags: [],
  };
  entities.set(id, entity);

  const typeSet = entitiesByType.get(type) ?? new Set();
  typeSet.add(id);
  entitiesByType.set(type, typeSet);

  return entity;
}

/** Update a single property on an entity with full provenance */
function updateEntityProperty(
  entity: WorldEntity,
  property: string,
  value: unknown,
  sensorId: string,
  observationId: string,
  confidence: number,
  timestamp: string
): void {
  const existing = entity.properties.get(property);
  const historyEntry: PropertyHistoryEntry = {
    value,
    timestamp,
    source_observation_id: observationId,
  };

  const history = existing?.history ?? [];
  history.push(historyEntry);
  if (history.length > MAX_PROPERTY_HISTORY) {
    history.splice(0, history.length - MAX_PROPERTY_HISTORY);
  }

  const propValue: PropertyValue = {
    value,
    type: typeof value,
    updated_at: timestamp,
    source_sensor_id: sensorId,
    source_observation_id: observationId,
    confidence,
    history,
  };

  entity.properties.set(property, propValue);
  entity.existence_confidence = 1.0; // Reset existence confidence on observation
}

/** Add a relationship between two entities */
export function addRelation(
  sourceEntityId: string,
  targetEntityId: string,
  type: string,
  properties: Record<string, unknown>,
  sensorId: string,
  bidirectional = false
): WorldRelation {
  const relation: WorldRelation = {
    id: `rel-${randomUUID()}`,
    source_entity_id: sourceEntityId,
    target_entity_id: targetEntityId,
    type,
    properties,
    strength: 1.0,
    bidirectional,
    observed_at: new Date().toISOString(),
    source_sensor_id: sensorId,
  };

  relations.set(relation.id, relation);

  // Index by both entities
  for (const eid of [sourceEntityId, targetEntityId]) {
    const rels = relationsByEntity.get(eid) ?? new Set();
    rels.add(relation.id);
    relationsByEntity.set(eid, rels);
  }

  return relation;
}

/**
 * Query the world state graph with filters and staleness constraints.
 */
export function queryWorldState(req: QueryWorldStateRequest): QueryWorldStateResponse {
  const startTime = Date.now();
  const maxStaleness = req.max_staleness_ms ?? DEFAULT_MAX_STALENESS_MS;
  const now = Date.now();

  let matchingEntities: WorldEntity[] = [];

  // Filter by entity type
  if (req.entity_types && req.entity_types.length > 0) {
    for (const type of req.entity_types) {
      const typeIds = entitiesByType.get(type) ?? new Set();
      for (const id of typeIds) {
        const entity = entities.get(id);
        if (entity) matchingEntities.push(entity);
      }
    }
  } else {
    matchingEntities = Array.from(entities.values());
  }

  // Filter by staleness
  matchingEntities = matchingEntities.filter((e) => {
    const age = now - new Date(e.updated_at).getTime();
    return age <= maxStaleness;
  });

  // Filter by conditions
  if (req.conditions) {
    matchingEntities = matchingEntities.filter((entity) =>
      req.conditions!.every((cond) => evaluateCondition(entity, cond))
    );
  }

  // Gather relations if requested
  let matchingRelations: WorldRelation[] = [];
  if (req.include_relations) {
    const entityIds = new Set(matchingEntities.map((e) => e.id));
    for (const entity of matchingEntities) {
      const relIds = relationsByEntity.get(entity.id) ?? new Set();
      for (const relId of relIds) {
        const rel = relations.get(relId);
        if (rel && (entityIds.has(rel.source_entity_id) || entityIds.has(rel.target_entity_id))) {
          matchingRelations.push(rel);
        }
      }
    }
    // Deduplicate
    matchingRelations = [...new Map(matchingRelations.map((r) => [r.id, r])).values()];
  }

  return {
    entities: matchingEntities,
    relations: matchingRelations,
    snapshot: computeSnapshot(),
    query_time_ms: Date.now() - startTime,
  };
}

/** Evaluate a condition against an entity */
function evaluateCondition(entity: WorldEntity, cond: WorldCondition): boolean {
  if (cond.entity_id !== entity.id && cond.entity_id !== '*') return true; // Not about this entity

  const prop = entity.properties.get(cond.property);

  if (cond.operator === 'exists') return prop !== undefined;
  if (!prop) return false;

  const actual = prop.value;
  const expected = cond.value;

  switch (cond.operator) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return (actual as number) > (expected as number);
    case 'lt': return (actual as number) < (expected as number);
    case 'gte': return (actual as number) >= (expected as number);
    case 'lte': return (actual as number) <= (expected as number);
    case 'contains':
      return typeof actual === 'string'
        ? actual.includes(String(expected))
        : Array.isArray(actual) && actual.includes(expected);
    default: return false;
  }
}

/** Compute a snapshot of current world state health */
function computeSnapshot(): WorldStateSnapshot {
  const now = Date.now();
  let totalStaleness = 0;
  let totalCoherence = 0;
  let entityCount = 0;

  for (const entity of entities.values()) {
    entityCount++;
    const age = now - new Date(entity.updated_at).getTime();
    totalStaleness += Math.min(age / DEFAULT_MAX_STALENESS_MS, 1);
    totalCoherence += entity.existence_confidence;
  }

  const activeSensors = Array.from(sensors.values()).filter((s) => s.enabled).length;
  const coverage = activeSensors > 0 ? Math.min(activeSensors / Math.max(entityCount, 1), 1) : 0;

  return {
    id: `snap-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    entity_count: entityCount,
    relation_count: relations.size,
    sensor_count: sensors.size,
    staleness_score: entityCount > 0 ? totalStaleness / entityCount : 0,
    coherence_score: entityCount > 0 ? totalCoherence / entityCount : 1,
    coverage_score: coverage,
  };
}

// ── 4. Predictive Dynamics ──────────────────────────────────────────────────

/**
 * Register a dynamics model for predicting future entity state.
 */
export function registerDynamicsModel(model: Omit<DynamicsModel, 'id' | 'accuracy' | 'created_at' | 'last_validated'>): DynamicsModel {
  const fullModel: DynamicsModel = {
    ...model,
    id: `model-${randomUUID()}`,
    accuracy: 0.5, // Neutral starting accuracy
    created_at: new Date().toISOString(),
    last_validated: new Date().toISOString(),
  };

  dynamicsModels.set(fullModel.id, fullModel);
  return fullModel;
}

/**
 * Predict future state of an entity property.
 * Uses the best available dynamics model for the entity type.
 */
export function predict(req: PredictRequest): PredictResponse {
  const entity = entities.get(req.entity_id);
  if (!entity) throw new Error(`Unknown entity: ${req.entity_id}`);

  const prop = entity.properties.get(req.property);
  if (!prop) throw new Error(`Entity ${req.entity_id} has no property ${req.property}`);

  // Find the best model for this entity type
  const model = selectBestModel(entity.type, req.method);
  if (!model) {
    // Fall back to linear extrapolation from history
    return generateFallbackPrediction(req, prop);
  }

  const predictions: Prediction[] = [];
  const targetTime = new Date(Date.now() + req.horizon_ms).toISOString();

  const prediction = generatePrediction(model, entity, req.property, prop, targetTime);
  predictions.push(prediction);

  return {
    predictions,
    model_used: model.id,
    model_accuracy: model.accuracy,
  };
}

/** Select the best dynamics model for an entity type */
function selectBestModel(entityType: string, preferredMethod?: PredictionMethod): DynamicsModel | undefined {
  let candidates = Array.from(dynamicsModels.values())
    .filter((m) => m.entity_types.includes(entityType));

  if (preferredMethod) {
    const preferred = candidates.filter((m) => m.method === preferredMethod);
    if (preferred.length > 0) candidates = preferred;
  }

  // Sort by accuracy, descending
  candidates.sort((a, b) => b.accuracy - a.accuracy);
  return candidates[0];
}

/** Generate a prediction using a dynamics model */
function generatePrediction(
  model: DynamicsModel,
  entity: WorldEntity,
  property: string,
  propValue: PropertyValue,
  targetTime: string
): Prediction {
  const history = propValue.history;
  let predictedValue: unknown = propValue.value;
  let confidenceLower: unknown = propValue.value;
  let confidenceUpper: unknown = propValue.value;

  if (typeof propValue.value === 'number' && history.length >= 2) {
    const numericHistory = history
      .filter((h) => typeof h.value === 'number')
      .slice(-20); // Use last 20 data points

    if (numericHistory.length >= 2) {
      const result = extrapolateNumeric(
        numericHistory.map((h) => ({
          value: h.value as number,
          time: new Date(h.timestamp).getTime(),
        })),
        new Date(targetTime).getTime(),
        model.method
      );

      predictedValue = result.value;
      confidenceLower = result.lower;
      confidenceUpper = result.upper;
    }
  }

  const prediction: Prediction = {
    id: `pred-${randomUUID()}`,
    model_id: model.id,
    timestamp: new Date().toISOString(),
    target_time: targetTime,
    entity_id: entity.id,
    property,
    predicted_value: predictedValue,
    confidence_interval: {
      lower: confidenceLower,
      upper: confidenceUpper,
      confidence: 0.95 * model.accuracy,
    },
  };

  predictions.set(prediction.id, prediction);
  return prediction;
}

/** Numeric extrapolation with different methods */
function extrapolateNumeric(
  data: { value: number; time: number }[],
  targetTime: number,
  method: PredictionMethod
): { value: number; lower: number; upper: number } {
  // Linear regression for all methods (foundation)
  const n = data.length;
  const sumX = data.reduce((s, d) => s + d.time, 0);
  const sumY = data.reduce((s, d) => s + d.value, 0);
  const sumXY = data.reduce((s, d) => s + d.time * d.value, 0);
  const sumX2 = data.reduce((s, d) => s + d.time * d.time, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) {
    // No variation in time — return mean
    const mean = sumY / n;
    return { value: mean, lower: mean, upper: mean };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const predicted = slope * targetTime + intercept;

  // Compute residual standard error for confidence interval
  const residuals = data.map((d) => d.value - (slope * d.time + intercept));
  const residualVar = residuals.reduce((s, r) => s + r * r, 0) / Math.max(n - 2, 1);
  const stderr = Math.sqrt(residualVar);

  // Wider confidence interval for further predictions
  const timeRange = data[n - 1].time - data[0].time;
  const extrapolationFactor = timeRange > 0
    ? Math.max(1, (targetTime - data[n - 1].time) / timeRange)
    : 1;

  const margin = 1.96 * stderr * extrapolationFactor;

  switch (method) {
    case 'pattern_matching': {
      // Look for periodic patterns
      const diffs = [];
      for (let i = 1; i < data.length; i++) {
        diffs.push(data[i].value - data[i - 1].value);
      }
      const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
      const stepsAhead = (targetTime - data[n - 1].time) / ((data[n - 1].time - data[0].time) / (n - 1));
      const patternPred = data[n - 1].value + avgDiff * stepsAhead;
      return { value: patternPred, lower: patternPred - margin, upper: patternPred + margin };
    }

    case 'ensemble': {
      // Average of linear and pattern
      const linear = predicted;
      const diffs2 = [];
      for (let i = 1; i < data.length; i++) {
        diffs2.push(data[i].value - data[i - 1].value);
      }
      const avgDiff2 = diffs2.reduce((s, d) => s + d, 0) / diffs2.length;
      const steps2 = (targetTime - data[n - 1].time) / ((data[n - 1].time - data[0].time) / (n - 1));
      const pattern = data[n - 1].value + avgDiff2 * steps2;
      const ensembleValue = (linear + pattern) / 2;
      return { value: ensembleValue, lower: ensembleValue - margin, upper: ensembleValue + margin };
    }

    default:
      // linear_extrapolation, causal_model, physics_simulation all use linear as base
      return { value: predicted, lower: predicted - margin, upper: predicted + margin };
  }
}

/** Fallback prediction when no dynamics model is available */
function generateFallbackPrediction(req: PredictRequest, prop: PropertyValue): PredictResponse {
  const prediction: Prediction = {
    id: `pred-${randomUUID()}`,
    model_id: 'fallback-constant',
    timestamp: new Date().toISOString(),
    target_time: new Date(Date.now() + req.horizon_ms).toISOString(),
    entity_id: req.entity_id,
    property: req.property,
    predicted_value: prop.value,
    confidence_interval: {
      lower: prop.value,
      upper: prop.value,
      confidence: 0.3, // Low confidence for constant-value prediction
    },
  };

  predictions.set(prediction.id, prediction);

  return {
    predictions: [prediction],
    model_used: 'fallback-constant',
    model_accuracy: 0.3,
  };
}

/**
 * Validate a prediction against actual observed value.
 * This feedback loop improves dynamics model accuracy over time.
 */
export function validatePrediction(predictionId: string, actualValue: unknown): PredictionValidation | null {
  const prediction = predictions.get(predictionId);
  if (!prediction) return null;

  let error = 0;
  let withinCI = true;

  if (typeof actualValue === 'number' && typeof prediction.predicted_value === 'number') {
    error = Math.abs(actualValue - prediction.predicted_value) /
      Math.max(Math.abs(prediction.predicted_value), 1);

    const lower = prediction.confidence_interval.lower as number;
    const upper = prediction.confidence_interval.upper as number;
    withinCI = actualValue >= lower && actualValue <= upper;
  } else {
    error = actualValue === prediction.predicted_value ? 0 : 1;
    withinCI = error === 0;
  }

  const validation: PredictionValidation = {
    actual_value: actualValue,
    error,
    within_ci: withinCI,
    validated_at: new Date().toISOString(),
  };

  prediction.validation = validation;

  // Update model accuracy
  const model = dynamicsModels.get(prediction.model_id);
  if (model) {
    const alpha = 0.1;
    model.accuracy = model.accuracy * (1 - alpha) + (1 - Math.min(error, 1)) * alpha;
    model.last_validated = validation.validated_at;
  }

  return validation;
}

// ── 5. Grounded Planning ────────────────────────────────────────────────────

/**
 * Validate an action against the current world state.
 * Checks preconditions, predicts side effects, and assesses risk.
 */
export function validateAction(req: ValidateActionRequest): ValidateActionResponse {
  const actionId = `action-${randomUUID()}`;
  const failedPreconditions: WorldCondition[] = [];
  const warnings: string[] = [];

  // Check preconditions against current world state
  for (const precond of req.action.preconditions) {
    const entity = entities.get(precond.entity_id);
    if (!entity) {
      failedPreconditions.push(precond);
      warnings.push(`Entity ${precond.entity_id} does not exist in world model`);
      continue;
    }

    if (!evaluateCondition(entity, precond)) {
      failedPreconditions.push(precond);
    }

    // Warn if entity data is stale
    const age = Date.now() - new Date(entity.updated_at).getTime();
    if (age > DEFAULT_MAX_STALENESS_MS) {
      warnings.push(`Entity ${entity.id} data is ${Math.round(age / 1000)}s old — consider refreshing`);
    }
  }

  // Predict side effects using dynamics models
  const predictedSideEffects: WorldEffect[] = [];
  for (const effect of req.action.expected_effects) {
    const entity = entities.get(effect.entity_id);
    if (!entity) continue;

    // Check if changing this property might cascade
    const relIds = relationsByEntity.get(effect.entity_id) ?? new Set();
    for (const relId of relIds) {
      const rel = relations.get(relId);
      if (!rel) continue;

      const dependentId = rel.source_entity_id === effect.entity_id
        ? rel.target_entity_id
        : rel.source_entity_id;

      if (rel.type === 'depends_on' || rel.type === 'manages') {
        predictedSideEffects.push({
          entity_id: dependentId,
          property: 'status',
          operation: 'set',
          value: 'potentially_affected',
          confidence: rel.strength * 0.5,
        });
      }
    }
  }

  // Compute feasibility and risk scores
  const feasibilityScore = failedPreconditions.length === 0
    ? 1.0
    : Math.max(0, 1 - failedPreconditions.length / req.action.preconditions.length);

  const riskScore = computeActionRisk(req.action.expected_effects, predictedSideEffects);

  // Store the action for tracking
  const action: WorldAction = {
    ...req.action,
    id: actionId,
    feasibility: feasibilityScore,
    risk_score: riskScore,
    predicted_side_effects: predictedSideEffects,
    status: feasibilityScore >= 0.5 ? 'validated' : 'planned',
    created_at: new Date().toISOString(),
  };
  actions.set(actionId, action);

  return {
    action_id: actionId,
    feasible: failedPreconditions.length === 0,
    feasibility_score: feasibilityScore,
    risk_score: riskScore,
    failed_preconditions: failedPreconditions,
    predicted_side_effects: predictedSideEffects,
    warnings,
  };
}

/** Compute a risk score for an action based on its effects */
function computeActionRisk(effects: WorldEffect[], sideEffects: WorldEffect[]): number {
  let risk = 0;

  // Direct effects: lower risk
  for (const effect of effects) {
    if (effect.operation === 'delete_entity') risk += 0.3;
    else if (effect.operation === 'set') risk += 0.05;
    else risk += 0.1;
  }

  // Side effects: higher risk (unintended consequences)
  for (const se of sideEffects) {
    risk += (1 - se.confidence) * 0.2;
  }

  return Math.min(risk, 1);
}

/** Mark an action as executing */
export function executeAction(actionId: string): WorldAction | null {
  const action = actions.get(actionId);
  if (!action) return null;
  if (action.status !== 'validated' && action.status !== 'approved') return null;

  action.status = 'executing';
  action.executed_at = new Date().toISOString();
  return action;
}

/** Mark an action as completed and apply its effects to the world model */
export function completeAction(actionId: string): WorldAction | null {
  const action = actions.get(actionId);
  if (!action || action.status !== 'executing') return null;

  // Apply expected effects to the world model
  for (const effect of action.expected_effects) {
    applyEffect(effect, action.agent_id, actionId);
  }

  action.status = 'completed';
  return action;
}

/** Apply an effect to the world model */
function applyEffect(effect: WorldEffect, agentId: string, sourceId: string): void {
  if (effect.operation === 'create_entity') {
    createEntity(effect.entity_id, String(effect.value), String(effect.value));
    return;
  }

  if (effect.operation === 'delete_entity') {
    entities.delete(effect.entity_id);
    entitiesByType.forEach((ids) => ids.delete(effect.entity_id));
    return;
  }

  const entity = entities.get(effect.entity_id);
  if (!entity) return;

  const prop = entity.properties.get(effect.property);
  const currentValue = prop?.value;

  let newValue: unknown;
  switch (effect.operation) {
    case 'set':
      newValue = effect.value;
      break;
    case 'increment':
      newValue = (currentValue as number ?? 0) + (effect.value as number);
      break;
    case 'decrement':
      newValue = (currentValue as number ?? 0) - (effect.value as number);
      break;
    case 'append':
      newValue = Array.isArray(currentValue)
        ? [...currentValue, effect.value]
        : [effect.value];
      break;
    case 'remove':
      newValue = Array.isArray(currentValue)
        ? currentValue.filter((v) => v !== effect.value)
        : currentValue;
      break;
  }

  const obsId = `effect-${sourceId}`;
  updateEntityProperty(entity, effect.property, newValue, `agent-${agentId}`, obsId, 1.0, new Date().toISOString());
}

// ── 6. Reality Drift Detection ──────────────────────────────────────────────

/**
 * Detect drift between the world model and observed reality.
 * Compares recent observations against predicted/expected state.
 */
export function detectDrift(req: DetectDriftRequest): DetectDriftResponse {
  const detectedDrifts: DriftEvent[] = [];
  const staleSensors: string[] = [];
  const recommendations: string[] = [];
  const now = Date.now();
  const minMagnitude = req.min_magnitude ?? 0.1;

  // Check for stale sensors
  for (const sensor of sensors.values()) {
    if (!sensor.enabled) continue;
    const sensorObs = observationsBySensor.get(sensor.id) ?? [];
    if (sensorObs.length === 0) {
      staleSensors.push(sensor.id);
      continue;
    }
    const lastObsId = sensorObs[sensorObs.length - 1];
    const lastObs = observations.get(lastObsId);
    if (lastObs && now - new Date(lastObs.timestamp).getTime() > sensor.max_staleness_ms) {
      staleSensors.push(sensor.id);
    }
  }

  // Check for entity-level drift
  const entitiesToCheck = req.entity_ids
    ? req.entity_ids.map((id) => entities.get(id)).filter((e): e is WorldEntity => e !== undefined)
    : Array.from(entities.values());

  for (const entity of entitiesToCheck) {
    // Decay existence confidence for unobserved entities
    const age = (now - new Date(entity.updated_at).getTime()) / 1000;
    entity.existence_confidence = Math.max(0, 1 - age * EXISTENCE_DECAY_RATE);

    if (entity.existence_confidence < 0.5) {
      detectedDrifts.push({
        id: `drift-${randomUUID()}`,
        detected_at: new Date().toISOString(),
        entity_id: entity.id,
        property: '_existence',
        expected_value: 'exists',
        actual_value: 'uncertain',
        magnitude: 1 - entity.existence_confidence,
        confirmation_count: 1,
        probable_cause: 'stale_sensor',
        resolved: false,
        response_actions: [],
      });
    }

    // Check predictions against observations
    const entityDrifts = driftByEntity.get(entity.id) ?? [];
    for (const driftId of entityDrifts) {
      const drift = driftEvents.get(driftId);
      if (drift && !drift.resolved && drift.magnitude >= minMagnitude) {
        detectedDrifts.push(drift);
      }
    }
  }

  // Generate recommendations
  if (staleSensors.length > 0) {
    recommendations.push(`Refresh ${staleSensors.length} stale sensor(s) to improve model accuracy`);
  }
  if (detectedDrifts.length > 5) {
    recommendations.push('High drift count detected — consider full world state refresh');
  }
  const adversarialDrifts = detectedDrifts.filter((d) => d.probable_cause === 'adversarial');
  if (adversarialDrifts.length > 0) {
    recommendations.push(`${adversarialDrifts.length} potentially adversarial drift(s) — escalate to security`);
  }

  // Compute overall model health
  const totalEntities = entities.size || 1;
  const driftRatio = detectedDrifts.length / totalEntities;
  const staleRatio = staleSensors.length / Math.max(sensors.size, 1);
  const modelHealth = Math.max(0, 1 - driftRatio * 0.5 - staleRatio * 0.3);

  return {
    drift_events: detectedDrifts,
    overall_model_health: modelHealth,
    stale_sensors: staleSensors,
    recommended_actions: recommendations,
  };
}

/** Check if an observation constitutes reality drift */
function checkForDrift(
  entityId: string,
  property: string,
  expectedValue: unknown,
  observedValue: unknown
): DriftEvent | null {
  let magnitude = 0;

  if (typeof expectedValue === 'number' && typeof observedValue === 'number') {
    magnitude = Math.abs(observedValue - expectedValue) / Math.max(Math.abs(expectedValue), 1);
  } else if (expectedValue !== observedValue) {
    magnitude = 1.0; // Categorical change = maximum drift
  }

  if (magnitude < 0.1) return null; // Below threshold

  // Check if we already have a drift event for this entity+property
  const existingDriftIds = driftByEntity.get(entityId) ?? [];
  for (const driftId of existingDriftIds) {
    const existing = driftEvents.get(driftId);
    if (existing && !existing.resolved && existing.property === property) {
      // Update existing drift event
      existing.confirmation_count++;
      existing.magnitude = magnitude;
      return existing;
    }
  }

  // Classify probable cause
  const cause = classifyDriftCause(entityId, property, magnitude);

  const drift: DriftEvent = {
    id: `drift-${randomUUID()}`,
    detected_at: new Date().toISOString(),
    entity_id: entityId,
    property,
    expected_value: expectedValue,
    actual_value: observedValue,
    magnitude,
    confirmation_count: 1,
    probable_cause: cause,
    resolved: false,
    response_actions: [],
  };

  driftEvents.set(drift.id, drift);
  const entityDrifts = driftByEntity.get(entityId) ?? [];
  entityDrifts.push(drift.id);
  driftByEntity.set(entityId, entityDrifts);

  return drift;
}

/** Classify the probable cause of a drift event */
function classifyDriftCause(entityId: string, property: string, magnitude: number): DriftCause {
  const entity = entities.get(entityId);
  if (!entity) return 'unknown';

  // Check if any of the entity's sensors are unreliable
  const unreliableSensors = entity.observed_by
    .map((sid) => sensors.get(sid))
    .filter((s): s is SensorConfig => s !== undefined && s.reliability < 0.5);

  if (unreliableSensors.length > 0) return 'sensor_error';

  // Check if there's a recent action that might have caused this
  const recentActions = Array.from(actions.values())
    .filter((a) => a.status === 'completed' && a.expected_effects.some((e) => e.entity_id === entityId))
    .sort((a, b) => new Date(b.executed_at ?? '').getTime() - new Date(a.executed_at ?? '').getTime());

  if (recentActions.length > 0) return 'action_side_effect';

  // Large sudden changes might be adversarial
  if (magnitude > 0.8) return 'adversarial';

  return 'external_change';
}

// ── 7. Entity Resolution & Shared Ontology ──────────────────────────────────

/**
 * Resolve entities observed by different agents into a unified set.
 * Multiple agents may observe the same real-world entity under different IDs.
 */
export function resolveEntities(req: ResolveEntitiesRequest): ResolveEntitiesResponse {
  const threshold = req.similarity_threshold ?? SIMILARITY_THRESHOLD_DEFAULT;
  const typeEntities = entitiesByType.get(req.entity_type) ?? new Set();

  // Group entities by source agent
  const agentEntities = new Map<string, WorldEntity[]>();
  for (const eid of typeEntities) {
    const entity = entities.get(eid);
    if (!entity) continue;
    for (const sensorId of entity.observed_by) {
      for (const [agentId, sensorIds] of sensorsByAgent.entries()) {
        if (sensorIds.has(sensorId) && req.agent_ids.includes(agentId)) {
          const list = agentEntities.get(agentId) ?? [];
          list.push(entity);
          agentEntities.set(agentId, list);
        }
      }
    }
  }

  const resolutions: EntityResolution[] = [];
  const resolved = new Set<string>();
  const unresolved: string[] = [];

  // Compare entities across agents for similarity
  const allAgentEntities = Array.from(agentEntities.entries());
  for (let i = 0; i < allAgentEntities.length; i++) {
    for (let j = i + 1; j < allAgentEntities.length; j++) {
      const [agentA, entitiesA] = allAgentEntities[i];
      const [agentB, entitiesB] = allAgentEntities[j];

      for (const entityA of entitiesA) {
        if (resolved.has(entityA.id)) continue;

        for (const entityB of entitiesB) {
          if (resolved.has(entityB.id)) continue;

          const similarity = computeEntitySimilarity(entityA, entityB);
          if (similarity >= threshold) {
            const canonicalId = entityA.id; // Keep the older entity as canonical
            const resolution: EntityResolution = {
              canonical_id: canonicalId,
              merged_ids: [entityA.id, entityB.id],
              source_agents: [agentA, agentB],
              confidence: similarity,
              resolved_at: new Date().toISOString(),
              method: similarity > 0.95 ? 'exact_match' : 'property_similarity',
            };

            resolutions.push(resolution);
            entityResolutions.set(canonicalId, resolution);
            resolved.add(entityA.id);
            resolved.add(entityB.id);

            // Merge entityB's properties into entityA
            mergeEntityProperties(entityA, entityB);
          }
        }
      }
    }
  }

  // Find unresolved entities
  for (const entityList of agentEntities.values()) {
    for (const entity of entityList) {
      if (!resolved.has(entity.id)) {
        unresolved.push(entity.id);
      }
    }
  }

  return {
    resolutions,
    unresolved,
    ontology_conflicts: [],
  };
}

/** Compute similarity between two entities based on their properties */
function computeEntitySimilarity(a: WorldEntity, b: WorldEntity): number {
  if (a.name === b.name) return 0.95; // Name match is very strong signal

  const propsA = a.properties;
  const propsB = b.properties;

  const allKeys = new Set([...propsA.keys(), ...propsB.keys()]);
  if (allKeys.size === 0) return 0;

  let matches = 0;
  let total = 0;

  for (const key of allKeys) {
    const valA = propsA.get(key);
    const valB = propsB.get(key);

    if (valA && valB) {
      total++;
      if (valA.value === valB.value) matches++;
      else if (typeof valA.value === 'number' && typeof valB.value === 'number') {
        // Fuzzy numeric match
        const diff = Math.abs(valA.value - valB.value) / Math.max(Math.abs(valA.value), Math.abs(valB.value), 1);
        if (diff < 0.1) matches += 0.8;
      }
    } else {
      total += 0.5; // Penalty for missing properties is halved
    }
  }

  return total > 0 ? matches / total : 0;
}

/** Merge properties from source entity into target, keeping the most confident values */
function mergeEntityProperties(target: WorldEntity, source: WorldEntity): void {
  for (const [key, sourceProp] of source.properties) {
    const targetProp = target.properties.get(key);
    if (!targetProp || sourceProp.confidence > targetProp.confidence) {
      target.properties.set(key, sourceProp);
    }
  }

  // Merge sensor tracking
  for (const sid of source.observed_by) {
    if (!target.observed_by.includes(sid)) {
      target.observed_by.push(sid);
    }
  }
}

/**
 * Register an ontology term for shared vocabulary across agents.
 */
export function registerOntologyTerm(
  term: string,
  definition: string,
  entityType: string,
  agentId: string,
  aliases: string[] = []
): OntologyTerm {
  // Check for existing term
  for (const existing of ontologyTerms.values()) {
    if (existing.term === term && existing.entity_type === entityType) {
      if (!existing.adopted_by.includes(agentId)) {
        existing.adopted_by.push(agentId);
      }
      existing.aliases = [...new Set([...existing.aliases, ...aliases])];
      return existing;
    }
  }

  const ontTerm: OntologyTerm = {
    id: `ont-${randomUUID()}`,
    term,
    definition,
    entity_type: entityType,
    aliases,
    adopted_by: [agentId],
    stability: 0.5,
    created_at: new Date().toISOString(),
  };

  ontologyTerms.set(ontTerm.id, ontTerm);
  return ontTerm;
}

// ── 8. Utility: Entity Identity Resolution ──────────────────────────────────

/** Resolve an entity ID from observation data based on the identity strategy */
function resolveEntityId(
  entityType: string,
  field: string,
  value: unknown,
  strategy: 'exact_match' | 'fuzzy_match' | 'create_new' | 'upsert'
): string {
  if (strategy === 'create_new') {
    return `${entityType}-${randomUUID()}`;
  }

  // Try to find existing entity of this type with matching value
  const typeEntities = entitiesByType.get(entityType) ?? new Set();
  for (const eid of typeEntities) {
    const entity = entities.get(eid);
    if (!entity) continue;

    if (strategy === 'exact_match' || strategy === 'upsert') {
      if (entity.name === String(value)) return entity.id;
    }

    if (strategy === 'fuzzy_match') {
      const similarity = computeStringSimilarity(entity.name, String(value));
      if (similarity > 0.8) return entity.id;
    }
  }

  // If upsert or no match found, create new
  if (strategy === 'upsert' || strategy === 'fuzzy_match') {
    return `${entityType}-${randomUUID()}`;
  }

  return `${entityType}-${randomUUID()}`;
}

/** Simple string similarity (Dice coefficient) */
function computeStringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.substring(i, i + 2));

  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.substring(i, i + 2))) matches++;
  }

  return (2 * matches) / (a.length - 1 + b.length - 1);
}

// ── 9. World Model Health & Diagnostics ─────────────────────────────────────

/** Get comprehensive diagnostics about the world model's health */
export function getWorldModelHealth(): {
  entity_count: number;
  relation_count: number;
  sensor_count: number;
  active_sensors: number;
  stale_entities: number;
  drift_events_active: number;
  model_accuracy: number;
  prediction_count: number;
  action_success_rate: number;
  ontology_terms: number;
  resolutions: number;
} {
  const now = Date.now();

  const staleEntities = Array.from(entities.values())
    .filter((e) => now - new Date(e.updated_at).getTime() > DEFAULT_MAX_STALENESS_MS)
    .length;

  const activeDrifts = Array.from(driftEvents.values())
    .filter((d) => !d.resolved)
    .length;

  const modelAccuracies = Array.from(dynamicsModels.values()).map((m) => m.accuracy);
  const avgAccuracy = modelAccuracies.length > 0
    ? modelAccuracies.reduce((s, a) => s + a, 0) / modelAccuracies.length
    : 0;

  const completedActions = Array.from(actions.values()).filter((a) => a.status === 'completed').length;
  const failedActions = Array.from(actions.values()).filter((a) => a.status === 'failed').length;
  const actionSuccessRate = completedActions + failedActions > 0
    ? completedActions / (completedActions + failedActions)
    : 1;

  return {
    entity_count: entities.size,
    relation_count: relations.size,
    sensor_count: sensors.size,
    active_sensors: Array.from(sensors.values()).filter((s) => s.enabled).length,
    stale_entities: staleEntities,
    drift_events_active: activeDrifts,
    model_accuracy: avgAccuracy,
    prediction_count: predictions.size,
    action_success_rate: actionSuccessRate,
    ontology_terms: ontologyTerms.size,
    resolutions: entityResolutions.size,
  };
}
