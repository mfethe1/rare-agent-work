/**
 * A2A Swarm Intelligence Protocol — Types
 *
 * In 2028, centralized coordination is the bottleneck. Ensembles need a
 * coordinator. Workflows need a DAG. But the most powerful multi-agent
 * behaviors emerge when agents self-organize — no coordinator, no predefined
 * plan, just local rules producing global optimization.
 *
 * Inspired by biological swarm intelligence (ant colonies, bee swarms, bird
 * flocking), this protocol enables:
 *
 * 1. **Pheromone Trails** — Agents deposit typed signals in a shared
 *    environment. Other agents sense these signals and adjust behavior.
 *    Signals decay over time (evaporation) so stale information fades.
 *
 * 2. **Stigmergy** — Indirect communication through environmental
 *    modification. An agent doesn't message another agent — it modifies the
 *    shared state, and other agents react to the modification.
 *
 * 3. **Local Rules → Global Behavior** — Each agent follows simple behavioral
 *    rules (attract, repel, align, forage). The swarm's emergent behavior
 *    (clustering around optimal solutions, load balancing, exploration vs.
 *    exploitation) arises from these local interactions.
 *
 * 4. **Swarm Objectives** — A shared objective function that agents
 *    collectively optimize. No single agent needs to understand the full
 *    problem — each contributes locally.
 *
 * 5. **Adaptive Exploration** — Swarm parameters (evaporation rate, signal
 *    strength, attraction radius) auto-tune based on convergence metrics.
 *
 * Use cases:
 * - Distributed search: hundreds of agents exploring a solution space
 * - Load balancing: agents naturally distribute across tasks
 * - Collective decision-making: swarm converges on best option
 * - Resilience: no single point of failure, swarm survives agent loss
 */

// ── Swarm Lifecycle ──────────────────────────────────────────────────────────

export type SwarmStatus =
  | 'initializing'   // Swarm created, awaiting agents to join
  | 'active'         // Agents are participating, pheromones flowing
  | 'converging'     // Swarm detected convergence toward an optimum
  | 'stagnant'       // No progress detected, may need parameter adjustment
  | 'dissolved';     // Terminal state, results preserved

// ── Pheromone System ─────────────────────────────────────────────────────────

/** Classification of pheromone signals. */
export type PheromoneType =
  | 'attraction'     // "Come here — this area is promising"
  | 'repulsion'      // "Avoid this — dead end or danger"
  | 'trail'          // "I went this way" — path marking
  | 'alarm'          // "Something went wrong here"
  | 'recruitment'    // "Help needed — more agents required"
  | 'success'        // "Solution found or task completed here"
  | 'custom';        // Domain-specific signal

/** A single pheromone signal deposited in the environment. */
export interface Pheromone {
  id: string;
  swarm_id: string;
  agent_id: string;
  type: PheromoneType;
  /** Coordinate in the problem space (domain-specific). */
  position: Record<string, number>;
  /** Current signal strength (decays over time via evaporation). */
  intensity: number;
  /** Initial intensity at deposit time. */
  initial_intensity: number;
  /** Arbitrary payload — context about what the agent found. */
  payload: Record<string, unknown>;
  /** Tags for filtering pheromones by domain. */
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ── Agent Behavioral Rules ───────────────────────────────────────────────────

export type BehaviorType =
  | 'attract'        // Move toward high-intensity pheromones
  | 'repel'          // Move away from repulsion pheromones
  | 'explore'        // Random walk to discover new areas
  | 'exploit'        // Focus on best-known area
  | 'align'          // Match direction of nearby agents
  | 'forage'         // Systematic search pattern
  | 'reinforce'      // Strengthen existing pheromone trails
  | 'custom';        // Domain-specific behavior

/** A behavioral rule an agent follows within the swarm. */
export interface BehaviorRule {
  type: BehaviorType;
  /** How strongly this rule influences the agent (0-1). */
  weight: number;
  /** Which pheromone types trigger this rule. */
  pheromone_triggers: PheromoneType[];
  /** Sensing radius — how far the agent "sees" pheromones. */
  sensing_radius: number;
  /** Additional parameters for custom behaviors. */
  params: Record<string, unknown>;
}

// ── Swarm Configuration ──────────────────────────────────────────────────────

/** Evaporation strategy for pheromone decay. */
export type EvaporationStrategy =
  | 'linear'         // intensity -= rate * elapsed
  | 'exponential'    // intensity *= (1 - rate) ^ elapsed
  | 'step';          // intensity drops to 0 after TTL

/** How the swarm detects convergence. */
export type ConvergenceCriteria =
  | 'pheromone_concentration'  // High concentration in small area
  | 'agent_clustering'         // Most agents in same region
  | 'objective_plateau'        // Objective function stops improving
  | 'custom';

export interface SwarmConfig {
  /** Rate at which pheromones decay (0-1 per time unit). */
  evaporation_rate: number;
  /** Evaporation calculation method. */
  evaporation_strategy: EvaporationStrategy;
  /** Minimum agent count for the swarm to remain active. */
  min_agents: number;
  /** Maximum agents allowed in the swarm. */
  max_agents: number;
  /** How far agents can sense pheromones (default radius). */
  default_sensing_radius: number;
  /** Balance between exploration (random) and exploitation (best-known). */
  exploration_rate: number;
  /** How convergence is detected. */
  convergence_criteria: ConvergenceCriteria;
  /** Threshold for convergence detection (criteria-specific). */
  convergence_threshold: number;
  /** Whether to auto-tune parameters based on swarm performance. */
  adaptive_params: boolean;
}

// ── Swarm ────────────────────────────────────────────────────────────────────

export interface Swarm {
  id: string;
  name: string;
  description: string;
  creator_agent_id: string;
  status: SwarmStatus;
  config: SwarmConfig;
  /** The objective the swarm is collectively optimizing. */
  objective: SwarmObjective;
  /** Current best known solution. */
  best_solution: SwarmSolution | null;
  /** Number of active agents. */
  agent_count: number;
  /** Total pheromones in the environment. */
  pheromone_count: number;
  /** Iteration counter (each evaporation cycle is one iteration). */
  iteration: number;
  created_at: string;
  updated_at: string;
}

export interface SwarmObjective {
  /** What agents are optimizing for. */
  description: string;
  /** Domain identifier for the problem space. */
  domain: string;
  /** Dimensions of the problem space. */
  dimensions: string[];
  /** Whether to maximize or minimize the objective. */
  direction: 'maximize' | 'minimize';
}

export interface SwarmSolution {
  agent_id: string;
  position: Record<string, number>;
  score: number;
  payload: Record<string, unknown>;
  found_at: string;
  iteration: number;
}

// ── Swarm Membership ─────────────────────────────────────────────────────────

export type SwarmAgentStatus =
  | 'active'
  | 'idle'
  | 'departed';

export interface SwarmAgent {
  swarm_id: string;
  agent_id: string;
  status: SwarmAgentStatus;
  /** Agent's current position in the problem space. */
  position: Record<string, number>;
  /** Behavioral rules this agent follows. */
  behaviors: BehaviorRule[];
  /** Number of pheromones this agent has deposited. */
  deposits: number;
  /** Best score this agent has achieved. */
  best_score: number | null;
  joined_at: string;
  last_active_at: string;
}

// ── Swarm Metrics ────────────────────────────────────────────────────────────

export interface SwarmMetrics {
  swarm_id: string;
  iteration: number;
  active_agents: number;
  total_pheromones: number;
  avg_intensity: number;
  max_intensity: number;
  /** Spatial concentration — 0 = spread out, 1 = all in one spot. */
  concentration_index: number;
  /** Best objective score this iteration. */
  best_score: number | null;
  /** Average score across all agents. */
  avg_score: number | null;
  /** Rate of score improvement over recent iterations. */
  improvement_rate: number;
  recorded_at: string;
}

// ── API Request/Response Types ───────────────────────────────────────────────

export interface CreateSwarmRequest {
  name: string;
  description: string;
  objective: SwarmObjective;
  config?: Partial<SwarmConfig>;
}

export interface CreateSwarmResponse {
  swarm: Swarm;
}

export interface JoinSwarmRequest {
  behaviors?: BehaviorRule[];
  initial_position?: Record<string, number>;
}

export interface JoinSwarmResponse {
  membership: SwarmAgent;
  current_pheromones: Pheromone[];
}

export interface DepositPheromoneRequest {
  type: PheromoneType;
  position: Record<string, number>;
  intensity: number;
  payload?: Record<string, unknown>;
  tags?: string[];
}

export interface DepositPheromoneResponse {
  pheromone: Pheromone;
}

export interface SensePheromoneRequest {
  position: Record<string, number>;
  radius?: number;
  types?: PheromoneType[];
  min_intensity?: number;
  limit?: number;
}

export interface SensePheromoneResponse {
  pheromones: Pheromone[];
  summary: {
    total: number;
    by_type: Record<string, number>;
    avg_intensity: number;
    strongest_direction: Record<string, number> | null;
  };
}

export interface ReportSolutionRequest {
  position: Record<string, number>;
  score: number;
  payload?: Record<string, unknown>;
}

export interface ReportSolutionResponse {
  accepted: boolean;
  is_new_best: boolean;
  swarm_best: SwarmSolution | null;
}

export interface EvaporateResponse {
  iteration: number;
  pheromones_decayed: number;
  pheromones_removed: number;
  metrics: SwarmMetrics;
}

export interface SwarmStatusResponse {
  swarm: Swarm;
  metrics: SwarmMetrics | null;
  agents: SwarmAgent[];
}

export interface ListSwarmsResponse {
  swarms: Swarm[];
  total: number;
}

export interface DissolveSwarmResponse {
  swarm: Swarm;
  final_metrics: SwarmMetrics;
  best_solution: SwarmSolution | null;
}
