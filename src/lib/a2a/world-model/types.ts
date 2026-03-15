/**
 * A2A Agent World Model & Environmental Grounding — Types
 *
 * The critical missing primitive for 2028: agents that maintain models
 * of external reality, perceive environmental state through sensors,
 * and ground their reasoning in physical/digital world dynamics.
 *
 * Why this matters (the council's critique):
 *
 * - **Demis Hassabis**: "Every breakthrough at DeepMind — AlphaFold,
 *   AlphaGo, Gemini — came from building world models. Your agents
 *   reason about each other in a vacuum. Without grounding in external
 *   reality, they're running sophisticated inference on nothing.
 *   Intelligence without a world model is hallucination with extra steps."
 *
 * - **Elon Musk**: "Tesla's FSD works because it maintains a real-time
 *   world model from sensor fusion. Your agents have zero sensors, zero
 *   environment representation, zero ability to predict what happens next
 *   in the real world. They're blind, deaf, and planning in a void.
 *   You wouldn't deploy a robot without proprioception — why deploy
 *   agents without it?"
 *
 * - **Geoffrey Hinton**: "The fundamental insight of embodied cognition
 *   is that intelligence is grounded in perception-action loops.
 *   Your agents have neither perception nor grounded actions. They
 *   manipulate symbols disconnected from any referent. This is exactly
 *   the failure mode I warned about — systems that appear intelligent
 *   but have no understanding because they lack grounding."
 *
 * - **Sam Altman**: "By 2028, the winning agent platforms will be the
 *   ones that can orchestrate across digital AND physical systems.
 *   That requires agents that understand system state — databases,
 *   APIs, infrastructure, even IoT devices. Your agents can negotiate
 *   and reason together beautifully, but they can't answer 'what is
 *   the current state of the system I'm supposed to manage?'"
 *
 * - **Satya Nadella**: "Enterprise value comes from agents that
 *   understand business context — inventory levels, service health,
 *   market conditions. Without environmental grounding, your agents
 *   are philosophers, not operators. Microsoft invested in Copilot
 *   precisely because it's grounded in the user's actual data."
 *
 * - **Dario Amodei**: "Grounding is also a safety mechanism. An agent
 *   with a world model can predict consequences of actions before
 *   taking them. Without grounding, agents cannot reason about impact —
 *   and ungrounded agents are the most dangerous kind."
 *
 * - **Matthew Berman**: "I've tested every agentic framework out there.
 *   The ones that fail in production all share one trait: they don't
 *   model the environment they operate in. They act based on stale
 *   assumptions and are surprised by reality. World models fix this."
 *
 * - **Wes Jones**: "The A2A ecosystem is architecturally beautiful but
 *   operationally blind. Agents need sensory inputs, predictive models,
 *   and feedback loops with the environments they're supposed to manage.
 *   Otherwise you've built a brain with no nervous system."
 *
 * Subsystems:
 *
 * 1. **Environmental Perception** — Sensor abstraction layer that ingests
 *    state from APIs, databases, infrastructure, IoT, and other external
 *    systems into a unified observation stream.
 *
 * 2. **World State Graph** — A continuously updated knowledge graph
 *    representing the current state of all observed entities, their
 *    properties, and relationships — the agent's "mental model" of reality.
 *
 * 3. **Predictive Dynamics** — Forward models that predict how the world
 *    will evolve, enabling agents to plan by simulating consequences of
 *    actions before taking them.
 *
 * 4. **Grounded Planning** — Action selection that is constrained by and
 *    validated against the world model, ensuring plans are physically/
 *    logically feasible given current environmental state.
 *
 * 5. **Reality Drift Detection** — Continuous comparison between predicted
 *    and observed state, alerting agents when their world model diverges
 *    from reality so they can re-plan.
 *
 * 6. **Multi-Agent Shared Ontology** — Common vocabulary and entity
 *    resolution so multiple agents can share observations and build
 *    a coherent collective world model.
 */

// ── Sensor Abstraction ─────────────────────────────────────────────────────

/** Types of external systems that can be observed */
export type SensorType =
  | 'api_endpoint'       // REST/GraphQL APIs
  | 'database_query'     // SQL/NoSQL state queries
  | 'infrastructure'     // Cloud resources, containers, K8s
  | 'message_queue'      // Kafka, Redis, RabbitMQ topics
  | 'iot_device'         // Physical sensors and actuators
  | 'file_system'        // File/object storage state
  | 'web_scraper'        // Web page state extraction
  | 'metrics_stream'     // Prometheus, Datadog, etc.
  | 'log_stream'         // Structured log ingestion
  | 'blockchain'         // On-chain state
  | 'custom';            // User-defined sensor

/** Sensor configuration for observing external state */
export interface SensorConfig {
  id: string;
  type: SensorType;
  name: string;
  description: string;

  /** Connection parameters (URL, credentials ref, etc.) */
  connection: Record<string, unknown>;

  /** How to extract structured observations from raw data */
  extraction_schema: ExtractionSchema;

  /** Polling interval in milliseconds (0 = event-driven) */
  poll_interval_ms: number;

  /** Maximum staleness before observation is considered expired */
  max_staleness_ms: number;

  /** Whether this sensor is currently active */
  enabled: boolean;

  /** Reliability score based on recent success rate */
  reliability: number; // 0–1
}

/** Schema for extracting structured data from sensor output */
export interface ExtractionSchema {
  /** JSONPath, SQL, regex, or custom extraction expressions */
  fields: FieldExtraction[];

  /** How to map extracted fields to world-model entities */
  entity_mapping: EntityMapping[];
}

export interface FieldExtraction {
  name: string;
  expression: string;
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'json';
  required: boolean;
}

export interface EntityMapping {
  field: string;
  target_entity_type: string;
  target_property: string;
  /** How to resolve entity identity from the field value */
  identity_resolver: 'exact_match' | 'fuzzy_match' | 'create_new' | 'upsert';
}

// ── Observations ───────────────────────────────────────────────────────────

/** A single observation from a sensor at a point in time */
export interface Observation {
  id: string;
  sensor_id: string;
  timestamp: string; // ISO 8601
  /** Extracted structured data */
  data: Record<string, unknown>;
  /** Confidence in observation accuracy */
  confidence: number; // 0–1
  /** Latency from event to observation */
  latency_ms: number;
  /** Whether this observation conflicts with existing world state */
  conflicts: ConflictRecord[];
}

export interface ConflictRecord {
  entity_id: string;
  property: string;
  expected_value: unknown;
  observed_value: unknown;
  resolution: 'accept_new' | 'keep_old' | 'flag_for_review';
}

// ── World State Graph ──────────────────────────────────────────────────────

/** An entity in the world model */
export interface WorldEntity {
  id: string;
  type: string;
  name: string;

  /** Current property values with provenance */
  properties: Map<string, PropertyValue>;

  /** When this entity was first observed */
  created_at: string;

  /** When any property was last updated */
  updated_at: string;

  /** Which sensors observe this entity */
  observed_by: string[];

  /** Confidence that this entity currently exists */
  existence_confidence: number; // 0–1

  /** Tags for categorization */
  tags: string[];
}

/** A property value with full provenance */
export interface PropertyValue {
  value: unknown;
  type: string;
  updated_at: string;
  source_sensor_id: string;
  source_observation_id: string;
  confidence: number; // 0–1
  history: PropertyHistoryEntry[];
}

export interface PropertyHistoryEntry {
  value: unknown;
  timestamp: string;
  source_observation_id: string;
}

/** A relationship between two entities */
export interface WorldRelation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  type: string; // e.g. 'depends_on', 'contains', 'manages', 'communicates_with'
  properties: Record<string, unknown>;
  strength: number; // 0–1
  bidirectional: boolean;
  observed_at: string;
  source_sensor_id: string;
}

/** Snapshot of the full world state at a point in time */
export interface WorldStateSnapshot {
  id: string;
  timestamp: string;
  entity_count: number;
  relation_count: number;
  sensor_count: number;
  staleness_score: number;  // 0 = fresh, 1 = completely stale
  coherence_score: number;  // 0 = contradictory, 1 = fully coherent
  coverage_score: number;   // 0 = blind, 1 = fully observed
}

// ── Predictive Dynamics ────────────────────────────────────────────────────

/** A model that predicts how some aspect of the world will evolve */
export interface DynamicsModel {
  id: string;
  name: string;
  description: string;

  /** Which entity types this model covers */
  entity_types: string[];

  /** Prediction method */
  method: PredictionMethod;

  /** How far ahead this model can reliably predict */
  horizon_ms: number;

  /** Accuracy on recent predictions */
  accuracy: number; // 0–1

  /** Training data: entity IDs used to fit this model */
  trained_on: string[];

  created_at: string;
  last_validated: string;
}

export type PredictionMethod =
  | 'linear_extrapolation'     // Simple trend following
  | 'causal_model'             // Uses causal graph from temporal engine
  | 'pattern_matching'         // Historical pattern recognition
  | 'physics_simulation'       // Domain-specific physical models
  | 'ensemble';                // Combination of multiple methods

/** A prediction about future world state */
export interface Prediction {
  id: string;
  model_id: string;
  timestamp: string;         // When the prediction was made
  target_time: string;       // What time is being predicted
  entity_id: string;
  property: string;
  predicted_value: unknown;
  confidence_interval: {
    lower: unknown;
    upper: unknown;
    confidence: number;      // e.g. 0.95 for 95% CI
  };
  /** Once the target time has passed, was this prediction accurate? */
  validation?: PredictionValidation;
}

export interface PredictionValidation {
  actual_value: unknown;
  error: number;             // Normalized prediction error
  within_ci: boolean;        // Was actual within confidence interval?
  validated_at: string;
}

// ── Grounded Planning ──────────────────────────────────────────────────────

/** An action an agent can take that affects the world */
export interface WorldAction {
  id: string;
  agent_id: string;
  type: string;
  description: string;

  /** Preconditions that must hold in the world model */
  preconditions: WorldCondition[];

  /** Expected effects on the world state */
  expected_effects: WorldEffect[];

  /** Predicted side effects (from dynamics models) */
  predicted_side_effects: WorldEffect[];

  /** Feasibility score given current world state */
  feasibility: number; // 0–1

  /** Risk assessment based on predicted consequences */
  risk_score: number;  // 0–1

  status: ActionStatus;
  created_at: string;
  executed_at?: string;
}

export type ActionStatus =
  | 'planned'          // Action has been designed
  | 'validated'        // Preconditions checked, action is feasible
  | 'approved'         // Human or governance approval obtained
  | 'executing'        // Currently being executed
  | 'completed'        // Execution finished
  | 'failed'           // Execution failed
  | 'rolled_back';     // Effects have been reversed

export interface WorldCondition {
  entity_id: string;
  property: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'exists';
  value: unknown;
}

export interface WorldEffect {
  entity_id: string;
  property: string;
  operation: 'set' | 'increment' | 'decrement' | 'append' | 'remove' | 'create_entity' | 'delete_entity';
  value: unknown;
  confidence: number; // How confident are we this effect will occur
}

// ── Reality Drift Detection ────────────────────────────────────────────────

/** Detected divergence between world model and reality */
export interface DriftEvent {
  id: string;
  detected_at: string;
  entity_id: string;
  property: string;

  /** What the world model predicted/believed */
  expected_value: unknown;

  /** What was actually observed */
  actual_value: unknown;

  /** Magnitude of the drift (normalized) */
  magnitude: number; // 0–1

  /** How many consecutive observations confirm this drift */
  confirmation_count: number;

  /** Likely cause of the drift */
  probable_cause: DriftCause;

  /** Whether this drift has been reconciled */
  resolved: boolean;

  /** Actions taken in response */
  response_actions: string[]; // action IDs
}

export type DriftCause =
  | 'external_change'       // Something changed in the real world that we didn't cause
  | 'stale_sensor'          // Sensor data was too old
  | 'model_inaccuracy'      // Our dynamics model was wrong
  | 'action_side_effect'    // Our own action had unexpected effects
  | 'sensor_error'          // Sensor produced incorrect data
  | 'adversarial'           // Deliberate manipulation of observations
  | 'unknown';

// ── Shared Ontology ────────────────────────────────────────────────────────

/** A shared vocabulary term that multiple agents agree on */
export interface OntologyTerm {
  id: string;
  term: string;
  definition: string;
  entity_type: string;
  /** Synonyms from different agent contexts */
  aliases: string[];
  /** Agents that have adopted this term */
  adopted_by: string[];
  /** Confidence in the definition's stability */
  stability: number; // 0–1
  created_at: string;
}

/** Resolution of the same real-world entity observed by multiple agents */
export interface EntityResolution {
  canonical_id: string;
  merged_ids: string[];
  source_agents: string[];
  confidence: number;
  resolved_at: string;
  method: 'exact_match' | 'property_similarity' | 'causal_link' | 'manual';
}

// ── API Request/Response Types ─────────────────────────────────────────────

export interface RegisterSensorRequest {
  agent_id: string;
  sensor: Omit<SensorConfig, 'id' | 'reliability'>;
}

export interface RegisterSensorResponse {
  sensor_id: string;
  status: 'registered' | 'rejected';
  reason?: string;
}

export interface IngestObservationRequest {
  agent_id: string;
  sensor_id: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

export interface IngestObservationResponse {
  observation_id: string;
  entities_updated: number;
  entities_created: number;
  conflicts: ConflictRecord[];
  drift_events: DriftEvent[];
}

export interface QueryWorldStateRequest {
  agent_id: string;
  /** Entity type filter */
  entity_types?: string[];
  /** Property conditions */
  conditions?: WorldCondition[];
  /** Include relationship graph? */
  include_relations?: boolean;
  /** Maximum staleness acceptable */
  max_staleness_ms?: number;
}

export interface QueryWorldStateResponse {
  entities: WorldEntity[];
  relations: WorldRelation[];
  snapshot: WorldStateSnapshot;
  query_time_ms: number;
}

export interface PredictRequest {
  agent_id: string;
  entity_id: string;
  property: string;
  horizon_ms: number;
  method?: PredictionMethod;
}

export interface PredictResponse {
  predictions: Prediction[];
  model_used: string;
  model_accuracy: number;
}

export interface ValidateActionRequest {
  agent_id: string;
  action: Omit<WorldAction, 'id' | 'feasibility' | 'risk_score' | 'status' | 'created_at'>;
}

export interface ValidateActionResponse {
  action_id: string;
  feasible: boolean;
  feasibility_score: number;
  risk_score: number;
  failed_preconditions: WorldCondition[];
  predicted_side_effects: WorldEffect[];
  warnings: string[];
}

export interface DetectDriftRequest {
  agent_id: string;
  /** Only check specific entities */
  entity_ids?: string[];
  /** Minimum magnitude to report */
  min_magnitude?: number;
}

export interface DetectDriftResponse {
  drift_events: DriftEvent[];
  overall_model_health: number; // 0–1
  stale_sensors: string[];
  recommended_actions: string[];
}

export interface ResolveEntitiesRequest {
  agent_ids: string[];
  entity_type: string;
  similarity_threshold?: number;
}

export interface ResolveEntitiesResponse {
  resolutions: EntityResolution[];
  unresolved: string[];
  ontology_conflicts: string[];
}
