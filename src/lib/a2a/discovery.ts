/**
 * A2A Agent Discovery & Health Engine
 *
 * The "yellow pages" of the agent ecosystem. Provides:
 *
 * 1. **Agent Search** — Find agents by capability, name, trust level,
 *    availability status, or free-text query across descriptions.
 *
 * 2. **Health Tracking** — Agents send heartbeats with load/status metadata.
 *    The engine derives availability (online/idle/busy/offline) from heartbeat
 *    recency and reported load.
 *
 * 3. **Profile Enrichment** — Agent profiles include reputation scores,
 *    active contract count, and real-time availability for informed decisions
 *    before initiating workflows or contracts.
 *
 * 4. **Profile Updates** — Agents can update their own description,
 *    callback URL, and capabilities as their services evolve.
 *
 * In the 2028 agentic future, this is the foundation that lets specialized
 * agents discover collaborators, evaluate fitness, and form teams dynamically.
 */

import type { RegisteredAgent, AgentCapability, AgentTrustLevel } from './types';

// ──────────────────────────────────────────────
// Availability Model
// ──────────────────────────────────────────────

/**
 * Agent availability derived from heartbeat recency and self-reported status.
 *
 * - online:  Heartbeat within ONLINE_WINDOW, load < 0.8
 * - busy:    Heartbeat within ONLINE_WINDOW, load >= 0.8
 * - idle:    Heartbeat within IDLE_WINDOW but older than ONLINE_WINDOW
 * - offline: No heartbeat within IDLE_WINDOW (or never sent one)
 */
export type AgentAvailability = 'online' | 'busy' | 'idle' | 'offline';

/** Agents must heartbeat within this window to be considered online. */
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Agents with a heartbeat older than ONLINE but within IDLE are "idle". */
const IDLE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/** Load threshold above which an online agent is marked "busy". */
const BUSY_LOAD_THRESHOLD = 0.8;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** Heartbeat payload sent by an agent to report liveness and load. */
export interface AgentHeartbeat {
  /** Current load factor (0.0 = idle, 1.0 = at capacity). */
  load: number;
  /** Number of tasks the agent is currently processing. */
  active_tasks: number;
  /** Maximum concurrent tasks this agent can handle. */
  max_concurrent_tasks: number;
  /** Optional free-form status message (e.g., "warming up", "draining"). */
  status_message?: string;
  /** Agent software version for compatibility checks. */
  version?: string;
}

/** Stored heartbeat record (heartbeat + server timestamp). */
export interface AgentHeartbeatRecord extends AgentHeartbeat {
  agent_id: string;
  last_heartbeat_at: string;
}

/** Enriched agent profile returned by the discovery API. */
export interface AgentProfile {
  /** Core agent fields. */
  id: string;
  name: string;
  description: string;
  callback_url?: string;
  capabilities: AgentCapability[];
  trust_level: AgentTrustLevel;
  is_active: boolean;
  created_at: string;
  last_seen_at: string;

  /** Real-time availability derived from heartbeats. */
  availability: AgentAvailability;

  /** Latest heartbeat data (null if agent never sent a heartbeat). */
  heartbeat: AgentHeartbeatRecord | null;

  /** Reputation score (0-1), null if no data. */
  reputation_score: number | null;

  /** Count of active service contracts. */
  active_contracts: number;
}

/** Search parameters for agent discovery. */
export interface AgentSearchParams {
  /** Free-text search across name and description. */
  query?: string;
  /** Filter by specific capability ID (exact or prefix match). */
  capability?: string;
  /** Filter by trust level(s). */
  trust_levels?: AgentTrustLevel[];
  /** Filter by availability status(es). */
  availability?: AgentAvailability[];
  /** Only return agents that are active. Default: true. */
  active_only?: boolean;
  /** Sort field. */
  sort_by?: 'reputation' | 'last_seen' | 'name' | 'created';
  /** Sort direction. */
  sort_order?: 'asc' | 'desc';
  /** Pagination offset. */
  offset?: number;
  /** Max results (1-100). */
  limit?: number;
}

/** Search result envelope. */
export interface AgentSearchResult {
  agents: AgentProfile[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

/** Fields an agent can update on its own profile. */
export interface AgentProfileUpdate {
  description?: string;
  callback_url?: string | null;
  capabilities?: AgentCapability[];
}

// ──────────────────────────────────────────────
// Availability Computation
// ──────────────────────────────────────────────

/**
 * Derive availability from the last heartbeat timestamp and reported load.
 */
export function computeAvailability(
  heartbeat: AgentHeartbeatRecord | null,
): AgentAvailability {
  if (!heartbeat) return 'offline';

  const elapsed = Date.now() - new Date(heartbeat.last_heartbeat_at).getTime();

  if (elapsed > IDLE_WINDOW_MS) return 'offline';
  if (elapsed > ONLINE_WINDOW_MS) return 'idle';

  return heartbeat.load >= BUSY_LOAD_THRESHOLD ? 'busy' : 'online';
}

// ──────────────────────────────────────────────
// Discovery Engine (Database Operations)
// ──────────────────────────────────────────────

/**
 * Search for agents matching the given parameters.
 * Returns enriched profiles with availability, reputation, and contract counts.
 */
export async function searchAgents(
  params: AgentSearchParams,
): Promise<AgentSearchResult> {
  const { getServiceDb } = await import('./auth');
  const db = getServiceDb();
  if (!db) {
    return { agents: [], total: 0, offset: 0, limit: 0, has_more: false };
  }

  const {
    query,
    capability,
    trust_levels,
    active_only = true,
    sort_by = 'last_seen',
    sort_order = 'desc',
    offset = 0,
    limit = 20,
  } = params;

  // Build the query
  let dbQuery = db
    .from('agent_registry')
    .select('id, name, description, callback_url, capabilities, trust_level, is_active, created_at, last_seen_at', { count: 'exact' });

  // Active filter
  if (active_only) {
    dbQuery = dbQuery.eq('is_active', true);
  }

  // Trust level filter
  if (trust_levels?.length) {
    dbQuery = dbQuery.in('trust_level', trust_levels);
  }

  // Free-text search (name or description)
  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${escapeLike(query)}%,description.ilike.%${escapeLike(query)}%`);
  }

  // Sort
  const sortColumn = SORT_COLUMNS[sort_by] ?? 'last_seen_at';
  dbQuery = dbQuery.order(sortColumn, {
    ascending: sort_order === 'asc',
    nullsFirst: false,
  });

  // Pagination
  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const { data, error, count } = await dbQuery;

  if (error || !data) {
    return { agents: [], total: 0, offset, limit, has_more: false };
  }

  // Map to RegisteredAgent shape
  let agents: RegisteredAgent[] = data.map(mapRowToAgent);

  // Capability filter (post-query — JSONB array filtering is complex in Supabase)
  if (capability) {
    agents = agents.filter((a) => matchesCapability(a.capabilities, capability));
  }

  // Enrich with heartbeat, reputation, and contract data
  const agentIds = agents.map((a) => a.id);
  const [heartbeats, reputations, contractCounts] = await Promise.all([
    fetchHeartbeats(db, agentIds),
    fetchReputationScores(db, agentIds),
    fetchActiveContractCounts(db, agentIds),
  ]);

  // Apply availability filter if requested
  const { availability: availFilter } = params;

  let enriched: AgentProfile[] = agents.map((agent) => {
    const hb = heartbeats.get(agent.id) ?? null;
    const availability = computeAvailability(hb);
    return {
      ...agent,
      availability,
      heartbeat: hb,
      reputation_score: reputations.get(agent.id) ?? null,
      active_contracts: contractCounts.get(agent.id) ?? 0,
    };
  });

  // Post-filter by availability if requested
  if (availFilter?.length) {
    enriched = enriched.filter((a) => availFilter.includes(a.availability));
  }

  const total = capability || availFilter?.length
    ? enriched.length  // Post-filtered count
    : (count ?? 0);

  return {
    agents: enriched,
    total,
    offset,
    limit,
    has_more: offset + enriched.length < total,
  };
}

/**
 * Get a single agent's enriched profile by ID.
 */
export async function getAgentProfile(
  agentId: string,
): Promise<AgentProfile | null> {
  const { getServiceDb } = await import('./auth');
  const db = getServiceDb();
  if (!db) return null;

  const { data, error } = await db
    .from('agent_registry')
    .select('id, name, description, callback_url, capabilities, trust_level, is_active, created_at, last_seen_at')
    .eq('id', agentId)
    .single();

  if (error || !data) return null;

  const agent = mapRowToAgent(data);
  const [heartbeats, reputations, contractCounts] = await Promise.all([
    fetchHeartbeats(db, [agentId]),
    fetchReputationScores(db, [agentId]),
    fetchActiveContractCounts(db, [agentId]),
  ]);

  const hb = heartbeats.get(agentId) ?? null;

  return {
    ...agent,
    availability: computeAvailability(hb),
    heartbeat: hb,
    reputation_score: reputations.get(agentId) ?? null,
    active_contracts: contractCounts.get(agentId) ?? 0,
  };
}

/**
 * Record a heartbeat from an agent.
 * Upserts into the agent_heartbeats table and updates last_seen_at.
 */
export async function recordHeartbeat(
  agentId: string,
  heartbeat: AgentHeartbeat,
): Promise<AgentHeartbeatRecord> {
  const { getServiceDb } = await import('./auth');
  const db = getServiceDb();
  if (!db) {
    throw new Error('Service unavailable');
  }

  const now = new Date().toISOString();

  const record: AgentHeartbeatRecord = {
    agent_id: agentId,
    ...heartbeat,
    last_heartbeat_at: now,
  };

  // Upsert heartbeat record
  const { error } = await db
    .from('agent_heartbeats')
    .upsert(
      {
        agent_id: agentId,
        load: heartbeat.load,
        active_tasks: heartbeat.active_tasks,
        max_concurrent_tasks: heartbeat.max_concurrent_tasks,
        status_message: heartbeat.status_message ?? null,
        version: heartbeat.version ?? null,
        last_heartbeat_at: now,
      },
      { onConflict: 'agent_id' },
    );

  if (error) {
    throw new Error('Failed to record heartbeat');
  }

  // Update last_seen_at on the agent registry (fire-and-forget)
  db.from('agent_registry')
    .update({ last_seen_at: now })
    .eq('id', agentId)
    .then(() => {});

  return record;
}

/**
 * Update an agent's own profile fields.
 * Only the owning agent (authenticated) can update their profile.
 */
export async function updateAgentProfile(
  agentId: string,
  update: AgentProfileUpdate,
): Promise<RegisteredAgent | null> {
  const { getServiceDb } = await import('./auth');
  const db = getServiceDb();
  if (!db) return null;

  // Build update payload — only include fields that were provided
  const payload: Record<string, unknown> = {};
  if (update.description !== undefined) payload.description = update.description;
  if (update.callback_url !== undefined) payload.callback_url = update.callback_url;
  if (update.capabilities !== undefined) payload.capabilities = update.capabilities;

  if (Object.keys(payload).length === 0) return null;

  const { data, error } = await db
    .from('agent_registry')
    .update(payload)
    .eq('id', agentId)
    .select('id, name, description, callback_url, capabilities, trust_level, is_active, created_at, last_seen_at')
    .single();

  if (error || !data) return null;

  return mapRowToAgent(data);
}

// ──────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────

const SORT_COLUMNS: Record<string, string> = {
  reputation: 'last_seen_at', // Reputation sort is post-query; fallback to last_seen
  last_seen: 'last_seen_at',
  name: 'name',
  created: 'created_at',
};

/** Escape special characters for Supabase ilike patterns. */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

/** Check if an agent's capabilities match a required capability. */
function matchesCapability(
  capabilities: AgentCapability[],
  required: string,
): boolean {
  const reqLower = required.toLowerCase();
  const reqDomain = reqLower.split('.')[0];

  return capabilities.some((cap) => {
    const capLower = cap.id.toLowerCase();
    // Exact match
    if (capLower === reqLower) return true;
    // Domain/prefix match
    if (capLower.split('.')[0] === reqDomain) return true;
    // Keyword match in description
    if (cap.description.toLowerCase().includes(reqLower)) return true;
    return false;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToAgent(row: any): RegisteredAgent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    callback_url: row.callback_url ?? undefined,
    capabilities: row.capabilities ?? [],
    trust_level: row.trust_level,
    is_active: row.is_active,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
  };
}

/**
 * Fetch heartbeat records for a set of agent IDs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchHeartbeats(
  db: any,
  agentIds: string[],
): Promise<Map<string, AgentHeartbeatRecord>> {
  const map = new Map<string, AgentHeartbeatRecord>();
  if (!agentIds.length) return map;

  const { data } = await db
    .from('agent_heartbeats')
    .select('agent_id, load, active_tasks, max_concurrent_tasks, status_message, version, last_heartbeat_at')
    .in('agent_id', agentIds);

  if (data) {
    for (const row of data) {
      map.set(row.agent_id, {
        agent_id: row.agent_id,
        load: row.load,
        active_tasks: row.active_tasks,
        max_concurrent_tasks: row.max_concurrent_tasks,
        status_message: row.status_message ?? undefined,
        version: row.version ?? undefined,
        last_heartbeat_at: row.last_heartbeat_at,
      });
    }
  }

  return map;
}

/**
 * Fetch reputation scores for a set of agent IDs.
 * Uses the a2a_agent_reputation materialized view if available,
 * falls back to computing from task feedback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchReputationScores(
  db: any,
  agentIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!agentIds.length) return map;

  // Try the reputation view first
  const { data } = await db
    .from('a2a_agent_reputation')
    .select('agent_id, reputation_score')
    .in('agent_id', agentIds);

  if (data) {
    for (const row of data) {
      map.set(row.agent_id, row.reputation_score);
    }
  }

  return map;
}

/**
 * Fetch count of active contracts per agent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchActiveContractCounts(
  db: any,
  agentIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!agentIds.length) return map;

  // Count contracts where agent is provider or consumer and status is 'active'
  const { data } = await db
    .from('a2a_contracts')
    .select('provider_agent_id, consumer_agent_id')
    .eq('status', 'active')
    .or(
      agentIds.map((id) => `provider_agent_id.eq.${id}`).join(',') +
      ',' +
      agentIds.map((id) => `consumer_agent_id.eq.${id}`).join(','),
    );

  if (data) {
    for (const row of data) {
      if (agentIds.includes(row.provider_agent_id)) {
        map.set(row.provider_agent_id, (map.get(row.provider_agent_id) ?? 0) + 1);
      }
      if (agentIds.includes(row.consumer_agent_id)) {
        map.set(row.consumer_agent_id, (map.get(row.consumer_agent_id) ?? 0) + 1);
      }
    }
  }

  return map;
}
