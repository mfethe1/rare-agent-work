/**
 * A2A Swarm Intelligence Engine
 *
 * Implements decentralized emergent coordination:
 *
 * 1. **Swarm Creation** — Define an objective, configure pheromone dynamics,
 *    and let agents self-organize to collectively solve the problem.
 *
 * 2. **Pheromone System** — Agents deposit signals (attraction, repulsion,
 *    trail, alarm, recruitment, success) that decay over time. Other agents
 *    sense nearby pheromones and adjust behavior — no direct communication.
 *
 * 3. **Stigmergic Coordination** — The environment IS the communication
 *    medium. Agents modify shared state; others react to modifications.
 *
 * 4. **Evaporation Cycles** — Periodic decay ensures stale information fades.
 *    The evaporation rate controls swarm memory: high = reactive/forgetful,
 *    low = persistent/stable.
 *
 * 5. **Convergence Detection** — The swarm automatically detects when agents
 *    cluster around optimal solutions, signaling that the objective is met.
 *
 * 6. **Adaptive Parameters** — If enabled, the engine auto-tunes evaporation
 *    rate and exploration balance based on convergence metrics.
 */

import { getServiceDb } from '../auth';
import type {
  Swarm,
  SwarmStatus,
  SwarmConfig,
  SwarmAgent,
  SwarmAgentStatus,
  Pheromone,
  PheromoneType,
  BehaviorRule,
  SwarmMetrics,
  SwarmSolution,
  SwarmObjective,
} from './types';
import type {
  CreateSwarmInput,
  JoinSwarmInput,
  DepositPheromoneInput,
  SensePheromoneInput,
  ReportSolutionInput,
  ListSwarmsInput,
} from './validation';

// ── Helpers ─────────────────────────────────────────────────────────────────

type Result<T> = T | { error: string; status_code: number };

function err(message: string, status_code: number): { error: string; status_code: number } {
  return { error: message, status_code };
}

// ── Default Config ──────────────────────────────────────────────────────────

export const DEFAULT_SWARM_CONFIG: SwarmConfig = {
  evaporation_rate: 0.05,
  evaporation_strategy: 'exponential',
  min_agents: 2,
  max_agents: 1000,
  default_sensing_radius: 100,
  exploration_rate: 0.3,
  convergence_criteria: 'pheromone_concentration',
  convergence_threshold: 0.85,
  adaptive_params: true,
};

// ── Create Swarm ────────────────────────────────────────────────────────────

interface CreateSwarmParams {
  creator_agent_id: string;
  input: CreateSwarmInput;
}

export async function createSwarm({ creator_agent_id, input }: CreateSwarmParams): Promise<
  Result<{ swarm: Swarm }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: creator } = await db
    .from('agent_registry')
    .select('id')
    .eq('id', creator_agent_id)
    .eq('is_active', true)
    .single();

  if (!creator) return err('Creator agent not found or inactive', 404);

  const config: SwarmConfig = { ...DEFAULT_SWARM_CONFIG, ...input.config };
  const now = new Date().toISOString();

  const swarm: Swarm = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    creator_agent_id,
    status: 'initializing',
    config,
    objective: input.objective,
    best_solution: null,
    agent_count: 0,
    pheromone_count: 0,
    iteration: 0,
    created_at: now,
    updated_at: now,
  };

  const { error: insertErr } = await db.from('a2a_swarms').insert(swarm);
  if (insertErr) return err('Failed to create swarm', 500);

  return { swarm };
}

// ── Join Swarm ──────────────────────────────────────────────────────────────

interface JoinSwarmParams {
  swarm_id: string;
  agent_id: string;
  input: JoinSwarmInput;
}

export async function joinSwarm({ swarm_id, agent_id, input }: JoinSwarmParams): Promise<
  Result<{ membership: SwarmAgent; current_pheromones: Pheromone[] }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: swarm } = await db
    .from('a2a_swarms')
    .select('*')
    .eq('id', swarm_id)
    .single();

  if (!swarm) return err('Swarm not found', 404);
  if (swarm.status === 'dissolved') return err('Swarm has been dissolved', 410);
  if (swarm.agent_count >= swarm.config.max_agents) return err('Swarm is full', 409);

  // Check agent exists
  const { data: agent } = await db
    .from('agent_registry')
    .select('id')
    .eq('id', agent_id)
    .eq('is_active', true)
    .single();

  if (!agent) return err('Agent not found or inactive', 404);

  // Check not already a member
  const { data: existing } = await db
    .from('a2a_swarm_agents')
    .select('agent_id')
    .eq('swarm_id', swarm_id)
    .eq('agent_id', agent_id)
    .eq('status', 'active')
    .single();

  if (existing) return err('Agent already in swarm', 409);

  const defaultBehaviors: BehaviorRule[] = input.behaviors ?? [
    {
      type: 'attract',
      weight: 0.6,
      pheromone_triggers: ['attraction', 'success'],
      sensing_radius: swarm.config.default_sensing_radius,
      params: {},
    },
    {
      type: 'explore',
      weight: 0.3,
      pheromone_triggers: ['trail'],
      sensing_radius: swarm.config.default_sensing_radius,
      params: {},
    },
    {
      type: 'repel',
      weight: 0.1,
      pheromone_triggers: ['repulsion', 'alarm'],
      sensing_radius: swarm.config.default_sensing_radius,
      params: {},
    },
  ];

  // Generate random initial position if not provided
  const position = input.initial_position ?? Object.fromEntries(
    swarm.objective.dimensions.map((dim: string) => [dim, Math.random() * 1000]),
  );

  const now = new Date().toISOString();
  const membership: SwarmAgent = {
    swarm_id,
    agent_id,
    status: 'active',
    position,
    behaviors: defaultBehaviors,
    deposits: 0,
    best_score: null,
    joined_at: now,
    last_active_at: now,
  };

  const { error: insertErr } = await db.from('a2a_swarm_agents').insert(membership);
  if (insertErr) return err('Failed to join swarm', 500);

  // Increment agent count and activate if threshold met
  const newCount = swarm.agent_count + 1;
  const newStatus: SwarmStatus =
    swarm.status === 'initializing' && newCount >= swarm.config.min_agents
      ? 'active'
      : swarm.status;

  await db
    .from('a2a_swarms')
    .update({ agent_count: newCount, status: newStatus, updated_at: now })
    .eq('id', swarm_id);

  // Return nearby pheromones so the agent can orient
  const { data: pheromones } = await db
    .from('a2a_swarm_pheromones')
    .select('*')
    .eq('swarm_id', swarm_id)
    .gt('intensity', 0.01)
    .order('intensity', { ascending: false })
    .limit(100);

  return {
    membership,
    current_pheromones: (pheromones ?? []) as Pheromone[],
  };
}

// ── Deposit Pheromone ───────────────────────────────────────────────────────

interface DepositParams {
  swarm_id: string;
  agent_id: string;
  input: DepositPheromoneInput;
}

export async function depositPheromone({ swarm_id, agent_id, input }: DepositParams): Promise<
  Result<{ pheromone: Pheromone }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  // Verify membership
  const { data: member } = await db
    .from('a2a_swarm_agents')
    .select('agent_id, swarm_id')
    .eq('swarm_id', swarm_id)
    .eq('agent_id', agent_id)
    .eq('status', 'active')
    .single();

  if (!member) return err('Agent is not an active member of this swarm', 403);

  // Verify swarm is active
  const { data: swarm } = await db
    .from('a2a_swarms')
    .select('status')
    .eq('id', swarm_id)
    .single();

  if (!swarm || swarm.status === 'dissolved') return err('Swarm not active', 410);

  const now = new Date().toISOString();
  const pheromone: Pheromone = {
    id: crypto.randomUUID(),
    swarm_id,
    agent_id,
    type: input.type,
    position: input.position,
    intensity: input.intensity,
    initial_intensity: input.intensity,
    payload: input.payload ?? {},
    tags: input.tags ?? [],
    created_at: now,
    updated_at: now,
  };

  const { error: insertErr } = await db.from('a2a_swarm_pheromones').insert(pheromone);
  if (insertErr) return err('Failed to deposit pheromone', 500);

  // Update agent activity and deposit count
  await db
    .from('a2a_swarm_agents')
    .update({
      position: input.position,
      last_active_at: now,
      deposits: (member as unknown as SwarmAgent).deposits
        ? ((member as unknown as SwarmAgent).deposits + 1)
        : 1,
    })
    .eq('swarm_id', swarm_id)
    .eq('agent_id', agent_id);

  // Increment swarm pheromone count
  await db
    .from('a2a_swarms')
    .update({ pheromone_count: (swarm as unknown as Swarm).pheromone_count + 1, updated_at: now })
    .eq('id', swarm_id);

  return { pheromone };
}

// ── Sense Pheromones ────────────────────────────────────────────────────────

interface SenseParams {
  swarm_id: string;
  agent_id: string;
  input: SensePheromoneInput;
}

/**
 * Euclidean distance between two positions (shared dimensions only).
 */
export function euclideanDistance(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  let sum = 0;
  for (const key of Object.keys(a)) {
    if (key in b) {
      sum += (a[key] - b[key]) ** 2;
    }
  }
  return Math.sqrt(sum);
}

/**
 * Compute the strongest pheromone direction (intensity-weighted centroid).
 */
export function computeStrongestDirection(
  origin: Record<string, number>,
  pheromones: Pheromone[],
): Record<string, number> | null {
  if (pheromones.length === 0) return null;

  const dims = Object.keys(origin);
  const direction: Record<string, number> = {};
  let totalIntensity = 0;

  for (const p of pheromones) {
    totalIntensity += p.intensity;
    for (const dim of dims) {
      if (dim in p.position) {
        direction[dim] = (direction[dim] ?? 0) + (p.position[dim] - origin[dim]) * p.intensity;
      }
    }
  }

  if (totalIntensity === 0) return null;

  // Normalize by total intensity
  for (const dim of dims) {
    direction[dim] = (direction[dim] ?? 0) / totalIntensity;
  }

  return direction;
}

export async function sensePheromones({ swarm_id, agent_id, input }: SenseParams): Promise<
  Result<{
    pheromones: Pheromone[];
    summary: {
      total: number;
      by_type: Record<string, number>;
      avg_intensity: number;
      strongest_direction: Record<string, number> | null;
    };
  }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  // Verify membership
  const { data: member } = await db
    .from('a2a_swarm_agents')
    .select('agent_id')
    .eq('swarm_id', swarm_id)
    .eq('agent_id', agent_id)
    .eq('status', 'active')
    .single();

  if (!member) return err('Agent is not an active member of this swarm', 403);

  // Fetch swarm config for default radius
  const { data: swarm } = await db
    .from('a2a_swarms')
    .select('config')
    .eq('id', swarm_id)
    .single();

  const radius = input.radius ?? (swarm?.config as SwarmConfig)?.default_sensing_radius ?? 100;

  // Fetch all active pheromones for this swarm above min intensity
  let query = db
    .from('a2a_swarm_pheromones')
    .select('*')
    .eq('swarm_id', swarm_id)
    .gt('intensity', input.min_intensity ?? 0.01);

  if (input.types && input.types.length > 0) {
    query = query.in('type', input.types);
  }

  const { data: allPheromones } = await query
    .order('intensity', { ascending: false })
    .limit(1000);

  // Filter by distance (done in-app since Supabase doesn't support spatial queries natively)
  const nearby = ((allPheromones ?? []) as Pheromone[])
    .filter((p) => euclideanDistance(input.position, p.position) <= radius)
    .slice(0, input.limit ?? 100);

  // Compute summary
  const byType: Record<string, number> = {};
  let totalIntensity = 0;
  for (const p of nearby) {
    byType[p.type] = (byType[p.type] ?? 0) + 1;
    totalIntensity += p.intensity;
  }

  return {
    pheromones: nearby,
    summary: {
      total: nearby.length,
      by_type: byType,
      avg_intensity: nearby.length > 0 ? totalIntensity / nearby.length : 0,
      strongest_direction: computeStrongestDirection(input.position, nearby),
    },
  };
}

// ── Report Solution ─────────────────────────────────────────────────────────

interface ReportSolutionParams {
  swarm_id: string;
  agent_id: string;
  input: ReportSolutionInput;
}

export async function reportSolution({ swarm_id, agent_id, input }: ReportSolutionParams): Promise<
  Result<{ accepted: boolean; is_new_best: boolean; swarm_best: SwarmSolution | null }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  // Verify membership
  const { data: member } = await db
    .from('a2a_swarm_agents')
    .select('agent_id, best_score')
    .eq('swarm_id', swarm_id)
    .eq('agent_id', agent_id)
    .eq('status', 'active')
    .single();

  if (!member) return err('Agent is not an active member of this swarm', 403);

  const { data: swarm } = await db
    .from('a2a_swarms')
    .select('*')
    .eq('id', swarm_id)
    .single();

  if (!swarm) return err('Swarm not found', 404);
  const swarmData = swarm as unknown as Swarm;

  const now = new Date().toISOString();
  const solution: SwarmSolution = {
    agent_id,
    position: input.position,
    score: input.score,
    payload: input.payload ?? {},
    found_at: now,
    iteration: swarmData.iteration,
  };

  // Update agent's best score
  const agentBest = (member as unknown as SwarmAgent).best_score;
  const isAgentBest = agentBest === null || (
    swarmData.objective.direction === 'maximize'
      ? input.score > agentBest
      : input.score < agentBest
  );

  if (isAgentBest) {
    await db
      .from('a2a_swarm_agents')
      .update({ best_score: input.score, position: input.position, last_active_at: now })
      .eq('swarm_id', swarm_id)
      .eq('agent_id', agent_id);
  }

  // Check if new swarm best
  const currentBest = swarmData.best_solution;
  const isNewBest = currentBest === null || (
    swarmData.objective.direction === 'maximize'
      ? input.score > currentBest.score
      : input.score < currentBest.score
  );

  if (isNewBest) {
    await db
      .from('a2a_swarms')
      .update({ best_solution: solution, updated_at: now })
      .eq('id', swarm_id);

    // Automatically deposit a success pheromone at the solution location
    const successPheromone: Pheromone = {
      id: crypto.randomUUID(),
      swarm_id,
      agent_id,
      type: 'success',
      position: input.position,
      intensity: Math.min(input.score * 10, 1000),
      initial_intensity: Math.min(input.score * 10, 1000),
      payload: { score: input.score, auto_deposited: true },
      tags: ['solution', 'auto'],
      created_at: now,
      updated_at: now,
    };

    await db.from('a2a_swarm_pheromones').insert(successPheromone);
  }

  return {
    accepted: true,
    is_new_best: isNewBest,
    swarm_best: isNewBest ? solution : currentBest,
  };
}

// ── Evaporation Cycle ───────────────────────────────────────────────────────

/**
 * Apply evaporation to all pheromones and compute swarm metrics.
 * This should be called periodically (e.g., by a cron job or agent trigger).
 */
export async function evaporate(swarm_id: string): Promise<
  Result<{ iteration: number; pheromones_decayed: number; pheromones_removed: number; metrics: SwarmMetrics }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: swarm } = await db
    .from('a2a_swarms')
    .select('*')
    .eq('id', swarm_id)
    .single();

  if (!swarm) return err('Swarm not found', 404);
  const s = swarm as unknown as Swarm;
  if (s.status === 'dissolved') return err('Swarm dissolved', 410);

  const config = s.config;
  const now = new Date().toISOString();
  const newIteration = s.iteration + 1;

  // Fetch all pheromones
  const { data: pheromones } = await db
    .from('a2a_swarm_pheromones')
    .select('*')
    .eq('swarm_id', swarm_id);

  const allPheromones = (pheromones ?? []) as Pheromone[];
  let decayed = 0;
  let removed = 0;

  for (const p of allPheromones) {
    const newIntensity = applyEvaporation(p.intensity, config);

    if (newIntensity < 0.001) {
      // Remove dead pheromones
      await db.from('a2a_swarm_pheromones').delete().eq('id', p.id);
      removed++;
    } else {
      await db
        .from('a2a_swarm_pheromones')
        .update({ intensity: newIntensity, updated_at: now })
        .eq('id', p.id);
      decayed++;
    }
  }

  // Compute metrics
  const { data: activePheromones } = await db
    .from('a2a_swarm_pheromones')
    .select('*')
    .eq('swarm_id', swarm_id);

  const { data: activeAgents } = await db
    .from('a2a_swarm_agents')
    .select('*')
    .eq('swarm_id', swarm_id)
    .eq('status', 'active');

  const active = (activePheromones ?? []) as Pheromone[];
  const agents = (activeAgents ?? []) as SwarmAgent[];

  const intensities = active.map((p) => p.intensity);
  const avgIntensity = intensities.length > 0
    ? intensities.reduce((a, b) => a + b, 0) / intensities.length
    : 0;
  const maxIntensity = intensities.length > 0 ? Math.max(...intensities) : 0;

  const concentrationIndex = computeConcentrationIndex(active);

  const agentScores = agents
    .map((a) => a.best_score)
    .filter((s): s is number => s !== null);
  const bestScore = agentScores.length > 0
    ? (s.objective.direction === 'maximize' ? Math.max(...agentScores) : Math.min(...agentScores))
    : null;
  const avgScore = agentScores.length > 0
    ? agentScores.reduce((a, b) => a + b, 0) / agentScores.length
    : null;

  const metrics: SwarmMetrics = {
    swarm_id,
    iteration: newIteration,
    active_agents: agents.length,
    total_pheromones: active.length,
    avg_intensity: avgIntensity,
    max_intensity: maxIntensity,
    concentration_index: concentrationIndex,
    best_score: bestScore,
    avg_score: avgScore,
    improvement_rate: 0, // Computed from historical metrics
    recorded_at: now,
  };

  await db.from('a2a_swarm_metrics').insert(metrics);

  // Detect convergence or stagnation
  let newStatus: SwarmStatus = s.status;
  if (s.status === 'active' || s.status === 'stagnant') {
    if (concentrationIndex >= config.convergence_threshold) {
      newStatus = 'converging';
    } else if (newIteration > 10 && avgIntensity < 0.1 && agents.length > 0) {
      newStatus = 'stagnant';
    } else if (s.status === 'stagnant' && concentrationIndex > 0.3) {
      newStatus = 'active'; // Recovered
    }
  }

  // Auto-tune parameters if enabled
  let updatedConfig = config;
  if (config.adaptive_params) {
    updatedConfig = adaptParameters(config, metrics, s.status);
  }

  await db
    .from('a2a_swarms')
    .update({
      iteration: newIteration,
      status: newStatus,
      config: updatedConfig,
      pheromone_count: active.length,
      agent_count: agents.length,
      updated_at: now,
    })
    .eq('id', swarm_id);

  return { iteration: newIteration, pheromones_decayed: decayed, pheromones_removed: removed, metrics };
}

// ── Apply Evaporation ───────────────────────────────────────────────────────

export function applyEvaporation(intensity: number, config: SwarmConfig): number {
  switch (config.evaporation_strategy) {
    case 'linear':
      return Math.max(0, intensity - config.evaporation_rate);
    case 'exponential':
      return intensity * (1 - config.evaporation_rate);
    case 'step':
      // Step decay: full intensity until it would go negative, then 0
      return intensity > config.evaporation_rate ? intensity : 0;
    default:
      return intensity * (1 - config.evaporation_rate);
  }
}

// ── Concentration Index ─────────────────────────────────────────────────────

/**
 * Compute how concentrated the pheromones are (0 = evenly spread, 1 = all in one spot).
 * Uses coefficient of variation of pairwise distances.
 */
export function computeConcentrationIndex(pheromones: Pheromone[]): number {
  if (pheromones.length < 2) return pheromones.length === 1 ? 1 : 0;

  // Compute intensity-weighted centroid
  let totalIntensity = 0;
  const centroid: Record<string, number> = {};

  for (const p of pheromones) {
    totalIntensity += p.intensity;
    for (const [dim, val] of Object.entries(p.position)) {
      centroid[dim] = (centroid[dim] ?? 0) + val * p.intensity;
    }
  }

  if (totalIntensity === 0) return 0;

  for (const dim of Object.keys(centroid)) {
    centroid[dim] /= totalIntensity;
  }

  // Compute intensity-weighted average distance from centroid
  let weightedDistSum = 0;
  for (const p of pheromones) {
    const dist = euclideanDistance(p.position, centroid);
    weightedDistSum += dist * p.intensity;
  }

  const avgDist = weightedDistSum / totalIntensity;

  // Normalize: low distance = high concentration
  // Use sigmoid-like function to map to 0-1
  return 1 / (1 + avgDist / 100);
}

// ── Adaptive Parameter Tuning ───────────────────────────────────────────────

export function adaptParameters(
  config: SwarmConfig,
  metrics: SwarmMetrics,
  status: SwarmStatus,
): SwarmConfig {
  const updated = { ...config };

  if (status === 'stagnant') {
    // Increase exploration, decrease evaporation to let new trails persist
    updated.exploration_rate = Math.min(0.9, config.exploration_rate + 0.05);
    updated.evaporation_rate = Math.max(0.01, config.evaporation_rate - 0.01);
  } else if (status === 'converging' || metrics.concentration_index > 0.7) {
    // Decrease exploration to exploit the found optimum
    updated.exploration_rate = Math.max(0.05, config.exploration_rate - 0.05);
    updated.evaporation_rate = Math.min(0.2, config.evaporation_rate + 0.01);
  }

  return updated;
}

// ── Get Swarm Status ────────────────────────────────────────────────────────

export async function getSwarmStatus(swarm_id: string): Promise<
  Result<{ swarm: Swarm; metrics: SwarmMetrics | null; agents: SwarmAgent[] }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: swarm } = await db
    .from('a2a_swarms')
    .select('*')
    .eq('id', swarm_id)
    .single();

  if (!swarm) return err('Swarm not found', 404);

  const { data: latestMetrics } = await db
    .from('a2a_swarm_metrics')
    .select('*')
    .eq('swarm_id', swarm_id)
    .order('iteration', { ascending: false })
    .limit(1)
    .single();

  const { data: agents } = await db
    .from('a2a_swarm_agents')
    .select('*')
    .eq('swarm_id', swarm_id)
    .eq('status', 'active');

  return {
    swarm: swarm as unknown as Swarm,
    metrics: (latestMetrics as unknown as SwarmMetrics) ?? null,
    agents: (agents ?? []) as SwarmAgent[],
  };
}

// ── List Swarms ─────────────────────────────────────────────────────────────

export async function listSwarms(input: ListSwarmsInput): Promise<
  Result<{ swarms: Swarm[]; total: number }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  let query = db.from('a2a_swarms').select('*', { count: 'exact' });

  if (input.status) {
    query = query.eq('status', input.status);
  }
  if (input.domain) {
    query = query.eq('objective->>domain', input.domain);
  }

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 20) - 1);

  return {
    swarms: (data ?? []) as unknown as Swarm[],
    total: count ?? 0,
  };
}

// ── Dissolve Swarm ──────────────────────────────────────────────────────────

export async function dissolveSwarm(swarm_id: string, agent_id: string): Promise<
  Result<{ swarm: Swarm; final_metrics: SwarmMetrics; best_solution: SwarmSolution | null }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: swarm } = await db
    .from('a2a_swarms')
    .select('*')
    .eq('id', swarm_id)
    .single();

  if (!swarm) return err('Swarm not found', 404);
  const s = swarm as unknown as Swarm;
  if (s.status === 'dissolved') return err('Swarm already dissolved', 410);
  if (s.creator_agent_id !== agent_id) return err('Only the creator can dissolve the swarm', 403);

  const now = new Date().toISOString();

  // Mark all agents as departed
  await db
    .from('a2a_swarm_agents')
    .update({ status: 'departed' as SwarmAgentStatus })
    .eq('swarm_id', swarm_id)
    .eq('status', 'active');

  // Record final metrics
  const finalMetrics: SwarmMetrics = {
    swarm_id,
    iteration: s.iteration,
    active_agents: 0,
    total_pheromones: s.pheromone_count,
    avg_intensity: 0,
    max_intensity: 0,
    concentration_index: 0,
    best_score: s.best_solution?.score ?? null,
    avg_score: null,
    improvement_rate: 0,
    recorded_at: now,
  };

  await db.from('a2a_swarm_metrics').insert(finalMetrics);

  // Update swarm status
  const dissolved: Partial<Swarm> = {
    status: 'dissolved',
    agent_count: 0,
    updated_at: now,
  };

  await db.from('a2a_swarms').update(dissolved).eq('id', swarm_id);

  return {
    swarm: { ...s, ...dissolved } as Swarm,
    final_metrics: finalMetrics,
    best_solution: s.best_solution,
  };
}

// ── Leave Swarm ─────────────────────────────────────────────────────────────

export async function leaveSwarm(swarm_id: string, agent_id: string): Promise<
  Result<{ departed: boolean }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: member } = await db
    .from('a2a_swarm_agents')
    .select('agent_id')
    .eq('swarm_id', swarm_id)
    .eq('agent_id', agent_id)
    .eq('status', 'active')
    .single();

  if (!member) return err('Agent is not an active member of this swarm', 404);

  const now = new Date().toISOString();

  await db
    .from('a2a_swarm_agents')
    .update({ status: 'departed' as SwarmAgentStatus })
    .eq('swarm_id', swarm_id)
    .eq('agent_id', agent_id);

  // Decrement agent count, check quorum
  const { data: swarm } = await db
    .from('a2a_swarms')
    .select('agent_count, config, status')
    .eq('id', swarm_id)
    .single();

  if (swarm) {
    const s = swarm as unknown as Swarm;
    const newCount = Math.max(0, s.agent_count - 1);
    const newStatus: SwarmStatus =
      newCount < s.config.min_agents && s.status === 'active' ? 'stagnant' : s.status;

    await db
      .from('a2a_swarms')
      .update({ agent_count: newCount, status: newStatus, updated_at: now })
      .eq('id', swarm_id);
  }

  return { departed: true };
}
