/**
 * A2A Capability-Based Task Router
 *
 * Intelligent routing layer that matches task intents to agent capabilities,
 * scores candidates by trust, recency, and match quality, and applies
 * routing policies to select the best agent(s) for a task.
 *
 * This is the missing "middle layer" between:
 *   - Direct targeting (caller knows exact agent ID)
 *   - Platform intents (hardcoded handlers)
 *
 * With the router, an agent can say "I need capability X done" and the
 * platform finds the best available agent automatically.
 *
 * Routing policies:
 *   - best-match:   Select the single highest-scoring agent (default)
 *   - round-robin:  Distribute across qualified agents, weighted by score
 *   - broadcast:    Fan out to all qualified agents (for consensus/redundancy)
 */

import type { RegisteredAgent, AgentCapability, AgentTrustLevel } from './types';
import type { RoutingPolicy, AgentScore, RoutingResult, RoutingCandidate } from './types';
import { createReputationBlender } from './reputation';

// ──────────────────────────────────────────────
// Scoring Weights
// ──────────────────────────────────────────────

const TRUST_SCORES: Record<AgentTrustLevel, number> = {
  partner: 1.0,
  verified: 0.7,
  untrusted: 0.3,
};

/** Agents seen within this window get full recency score. */
const FRESH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Agents not seen within this window get zero recency score. */
const STALE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Weight distribution for the final composite score. */
const WEIGHTS = {
  capability_match: 0.45,
  trust: 0.30,
  recency: 0.25,
};

// ──────────────────────────────────────────────
// Capability Matching
// ──────────────────────────────────────────────

/**
 * Score how well an agent's capabilities match a required capability.
 * Returns 0-1 where 1 = exact match, partial matches get fractional scores.
 *
 * Matching strategy (in priority order):
 * 1. Exact capability ID match → 1.0
 * 2. Intent-to-capability prefix match (e.g., "news.query" matches "news.*") → 0.8
 * 3. Keyword overlap between intent and capability description → 0.2-0.6
 */
export function scoreCapabilityMatch(
  requiredCapability: string,
  agentCapabilities: AgentCapability[],
): { score: number; matched_capability: string | null } {
  if (!agentCapabilities.length) {
    return { score: 0, matched_capability: null };
  }

  let bestScore = 0;
  let bestMatch: string | null = null;

  for (const cap of agentCapabilities) {
    // Exact match on capability ID
    if (cap.id === requiredCapability) {
      return { score: 1.0, matched_capability: cap.id };
    }

    // Prefix/domain match: "news.query" matches capability "news.*" or "news.search"
    const reqParts = requiredCapability.split('.');
    const capParts = cap.id.split('.');

    if (reqParts[0] === capParts[0] && reqParts.length > 1 && capParts.length > 1) {
      const domainScore = 0.8;
      if (domainScore > bestScore) {
        bestScore = domainScore;
        bestMatch = cap.id;
      }
      continue;
    }

    // Keyword overlap between the required capability and description
    const reqTokens = tokenize(requiredCapability);
    const descTokens = tokenize(cap.description);
    const idTokens = tokenize(cap.id);
    const allCapTokens = new Set([...descTokens, ...idTokens]);

    const overlap = reqTokens.filter((t) => allCapTokens.has(t)).length;
    if (overlap > 0) {
      const keywordScore = Math.min(0.6, 0.2 * overlap);
      if (keywordScore > bestScore) {
        bestScore = keywordScore;
        bestMatch = cap.id;
      }
    }
  }

  return { score: bestScore, matched_capability: bestMatch };
}

/** Tokenize a string into lowercase keyword parts. */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[.\-_\s/]+/)
    .filter((t) => t.length > 2);
}

// ──────────────────────────────────────────────
// Agent Scoring
// ──────────────────────────────────────────────

/**
 * Compute a recency score (0-1) based on last_seen_at.
 * Agents seen recently score higher — they're more likely to be online.
 */
export function scoreRecency(lastSeenAt: string | null): number {
  if (!lastSeenAt) return 0;

  const elapsed = Date.now() - new Date(lastSeenAt).getTime();

  if (elapsed <= FRESH_WINDOW_MS) return 1.0;
  if (elapsed >= STALE_WINDOW_MS) return 0;

  // Linear decay between fresh and stale windows
  return 1.0 - (elapsed - FRESH_WINDOW_MS) / (STALE_WINDOW_MS - FRESH_WINDOW_MS);
}

/** Optional function that blends static trust with dynamic reputation. */
export type TrustBlender = (agentId: string, staticTrustScore: number) => number;

/**
 * Score a single agent for a required capability.
 * Returns a composite score (0-1) and breakdown.
 *
 * When a trustBlender is provided (from the reputation system), the trust
 * component uses a blended score that factors in task completion history
 * and quality ratings. Without it, static trust labels are used.
 */
export function scoreAgent(
  agent: RegisteredAgent,
  requiredCapability: string,
  trustBlender?: TrustBlender,
): AgentScore {
  const capMatch = scoreCapabilityMatch(requiredCapability, agent.capabilities);
  const staticTrust = TRUST_SCORES[agent.trust_level] ?? 0;
  const trustScore = trustBlender
    ? trustBlender(agent.id, staticTrust)
    : staticTrust;
  const recencyScore = scoreRecency(agent.last_seen_at);

  const composite =
    capMatch.score * WEIGHTS.capability_match +
    trustScore * WEIGHTS.trust +
    recencyScore * WEIGHTS.recency;

  return {
    agent_id: agent.id,
    agent_name: agent.name,
    composite_score: Math.round(composite * 1000) / 1000,
    capability_match: Math.round(capMatch.score * 1000) / 1000,
    matched_capability: capMatch.matched_capability,
    trust_score: Math.round(trustScore * 1000) / 1000,
    recency_score: Math.round(recencyScore * 1000) / 1000,
  };
}

// ──────────────────────────────────────────────
// Routing Engine
// ──────────────────────────────────────────────

/** Minimum composite score to be considered a viable candidate. */
const MIN_VIABLE_SCORE = 0.15;

/**
 * Route a task to the best agent(s) based on capability matching and scoring.
 *
 * @param candidates - Active agents to evaluate (pre-fetched from DB)
 * @param requiredCapability - The capability or intent the task requires
 * @param policy - Routing policy to apply
 * @param maxTargets - Max agents to select (for broadcast/round-robin)
 * @param excludeAgentIds - Agent IDs to exclude (e.g., the sender)
 * @param trustBlender - Optional reputation-aware trust scorer
 */
export function routeTask(
  candidates: RegisteredAgent[],
  requiredCapability: string,
  policy: RoutingPolicy = 'best-match',
  maxTargets: number = 3,
  excludeAgentIds: string[] = [],
  trustBlender?: TrustBlender,
): RoutingResult {
  const excludeSet = new Set(excludeAgentIds);

  // Score all candidates (with reputation-blended trust when available)
  const scored: RoutingCandidate[] = candidates
    .filter((a) => a.is_active && !excludeSet.has(a.id))
    .map((agent) => ({
      agent,
      score: scoreAgent(agent, requiredCapability, trustBlender),
    }))
    .filter((c) => c.score.capability_match > 0 && c.score.composite_score >= MIN_VIABLE_SCORE)
    .sort((a, b) => b.score.composite_score - a.score.composite_score);

  if (scored.length === 0) {
    return {
      matched: false,
      policy,
      required_capability: requiredCapability,
      candidates_evaluated: candidates.length,
      selected: [],
      all_scores: [],
      reason: 'No agents found with sufficient capability match.',
    };
  }

  let selected: RoutingCandidate[];

  switch (policy) {
    case 'best-match':
      selected = [scored[0]];
      break;

    case 'round-robin': {
      // Select up to maxTargets, spreading across different trust levels
      selected = selectRoundRobin(scored, maxTargets);
      break;
    }

    case 'broadcast':
      selected = scored.slice(0, maxTargets);
      break;

    default:
      selected = [scored[0]];
  }

  return {
    matched: true,
    policy,
    required_capability: requiredCapability,
    candidates_evaluated: candidates.length,
    selected: selected.map((c) => c.score),
    all_scores: scored.map((c) => c.score),
    reason: `Matched ${selected.length} agent(s) via ${policy} policy.`,
  };
}

/**
 * Round-robin selection: pick from top candidates, preferring diversity
 * across trust levels while still respecting score ordering.
 */
function selectRoundRobin(
  scored: RoutingCandidate[],
  maxTargets: number,
): RoutingCandidate[] {
  if (scored.length <= maxTargets) return scored;

  const selected: RoutingCandidate[] = [];
  const seenTrust = new Set<string>();

  // First pass: one per trust level (highest score in each)
  for (const candidate of scored) {
    if (selected.length >= maxTargets) break;
    if (!seenTrust.has(candidate.agent.trust_level)) {
      selected.push(candidate);
      seenTrust.add(candidate.agent.trust_level);
    }
  }

  // Second pass: fill remaining slots by score
  for (const candidate of scored) {
    if (selected.length >= maxTargets) break;
    if (!selected.includes(candidate)) {
      selected.push(candidate);
    }
  }

  return selected;
}

// ──────────────────────────────────────────────
// Database Helpers
// ──────────────────────────────────────────────

/**
 * Fetch routing candidates with reputation data pre-loaded.
 * Returns both the candidates and a trust blender function
 * that the router can use for reputation-aware scoring.
 */
export async function fetchRoutingCandidatesWithReputation(
  requiredCapability: string,
): Promise<{ candidates: RegisteredAgent[]; trustBlender: TrustBlender }> {
  const candidates = await fetchRoutingCandidates(requiredCapability);
  const agentIds = candidates.map((c) => c.id);
  const trustBlender = await createReputationBlender(agentIds);
  return { candidates, trustBlender };
}

/**
 * Fetch active agents from the registry, optionally filtered by a capability domain.
 * This is the standard way to get candidates for routing.
 */
export async function fetchRoutingCandidates(
  requiredCapability: string,
): Promise<RegisteredAgent[]> {
  const { getServiceDb } = await import('./auth');
  const db = getServiceDb();
  if (!db) return [];

  // Extract the domain prefix for a coarse DB filter
  const domain = requiredCapability.split('.')[0];

  const { data } = await db
    .from('agent_registry')
    .select('id, name, description, callback_url, capabilities, trust_level, is_active, created_at, last_seen_at')
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (!data) return [];

  // Coarse filter: only include agents that have at least one capability
  // in the same domain or with keyword overlap
  return data
    .filter((row) => {
      const caps: AgentCapability[] = row.capabilities ?? [];
      return caps.some((cap) => {
        const capDomain = cap.id.split('.')[0];
        return capDomain === domain || cap.id.includes(domain);
      });
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      callback_url: row.callback_url ?? undefined,
      capabilities: row.capabilities ?? [],
      trust_level: row.trust_level,
      is_active: row.is_active,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
    }));
}
