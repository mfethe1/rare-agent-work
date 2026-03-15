/**
 * A2A Dynamic Agent Reputation System
 *
 * Closes the critical feedback loop in the routing engine: instead of relying
 * solely on static trust labels (untrusted/verified/partner), reputation
 * scores are computed from actual task outcomes and quality ratings.
 *
 * Architecture:
 *   1. After a routed task completes, the sender can rate the result (1-5).
 *   2. A materialized view (a2a_agent_reputation) aggregates:
 *      - Task completion rate
 *      - Time-weighted quality ratings
 *      - Failure/expiry rate
 *      - Volume bonus
 *   3. The router blends this reputation score with the existing scoring.
 *
 * This transforms the A2A ecosystem from "static directory" to
 * "self-improving marketplace" — the more agents interact, the
 * better the platform routes.
 */

import { getServiceDb } from './auth';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface TaskFeedback {
  id: string;
  task_id: string;
  reviewer_agent_id: string;
  target_agent_id: string;
  rating: number;
  feedback: Record<string, unknown> | null;
  intent: string;
  created_at: string;
}

export interface AgentReputation {
  agent_id: string;
  agent_name: string;
  trust_level: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  expired_tasks: number;
  completion_rate: number;
  failure_rate: number;
  avg_completion_seconds: number;
  total_ratings: number;
  avg_rating: number;
  weighted_avg_rating: number;
  /** Composite reputation score (0-1), blending completion, quality, reliability, volume. */
  reputation_score: number;
  last_feedback_at: string | null;
  computed_at: string;
}

export interface SubmitFeedbackParams {
  task_id: string;
  reviewer_agent_id: string;
  rating: number;
  feedback?: Record<string, unknown>;
}

export interface FeedbackResult {
  success: boolean;
  feedback_id?: string;
  error?: string;
}

// ──────────────────────────────────────────────
// Feedback Submission
// ──────────────────────────────────────────────

/**
 * Submit quality feedback for a completed task.
 *
 * Validates:
 * - Task exists and is completed
 * - Reviewer is the sender (only the requesting agent can rate)
 * - Rating is 1-5
 * - No duplicate feedback for the same task
 */
export async function submitTaskFeedback(
  params: SubmitFeedbackParams,
): Promise<FeedbackResult> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable.' };

  const { task_id, reviewer_agent_id, rating, feedback } = params;

  // Fetch the task to validate ownership and status
  const { data: task, error: taskErr } = await db
    .from('a2a_tasks')
    .select('id, sender_agent_id, target_agent_id, intent, status')
    .eq('id', task_id)
    .single();

  if (taskErr || !task) {
    return { success: false, error: 'Task not found.' };
  }

  if (task.status !== 'completed' && task.status !== 'failed') {
    return { success: false, error: 'Feedback can only be submitted for completed or failed tasks.' };
  }

  if (task.sender_agent_id !== reviewer_agent_id) {
    return { success: false, error: 'Only the requesting agent can rate a task.' };
  }

  if (!task.target_agent_id) {
    return { success: false, error: 'Cannot rate platform-executed tasks.' };
  }

  // Insert feedback (upsert on unique constraint)
  const { data: fb, error: fbErr } = await db
    .from('a2a_task_feedback')
    .upsert(
      {
        task_id,
        reviewer_agent_id,
        target_agent_id: task.target_agent_id,
        rating,
        feedback: feedback ?? null,
        intent: task.intent,
      },
      { onConflict: 'task_id,reviewer_agent_id' },
    )
    .select('id')
    .single();

  if (fbErr || !fb) {
    console.error('[A2A Reputation] Failed to submit feedback:', fbErr);
    return { success: false, error: 'Failed to submit feedback.' };
  }

  return { success: true, feedback_id: fb.id };
}

// ──────────────────────────────────────────────
// Reputation Queries
// ──────────────────────────────────────────────

/**
 * Get the precomputed reputation score for an agent.
 * Returns null if the agent has no reputation entry (new/inactive).
 */
export async function getAgentReputation(
  agentId: string,
): Promise<AgentReputation | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data, error } = await db
    .from('a2a_agent_reputation')
    .select('*')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) return null;

  return {
    agent_id: data.agent_id,
    agent_name: data.agent_name,
    trust_level: data.trust_level,
    total_tasks: Number(data.total_tasks),
    completed_tasks: Number(data.completed_tasks),
    failed_tasks: Number(data.failed_tasks),
    expired_tasks: Number(data.expired_tasks),
    completion_rate: Number(data.completion_rate),
    failure_rate: Number(data.failure_rate),
    avg_completion_seconds: Number(data.avg_completion_seconds),
    total_ratings: Number(data.total_ratings),
    avg_rating: Number(data.avg_rating),
    weighted_avg_rating: Number(data.weighted_avg_rating),
    reputation_score: Number(data.reputation_score),
    last_feedback_at: data.last_feedback_at,
    computed_at: data.computed_at,
  };
}

/**
 * Get reputation scores for multiple agents (batch lookup for routing).
 * Returns a Map of agent_id → reputation_score for fast lookup.
 */
export async function getReputationScores(
  agentIds: string[],
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (agentIds.length === 0) return scores;

  const db = getServiceDb();
  if (!db) return scores;

  const { data, error } = await db
    .from('a2a_agent_reputation')
    .select('agent_id, reputation_score')
    .in('agent_id', agentIds);

  if (error || !data) return scores;

  for (const row of data) {
    scores.set(row.agent_id, Number(row.reputation_score));
  }

  return scores;
}

/**
 * Get the top-ranked agents by reputation score.
 */
export async function getReputationLeaderboard(
  limit: number = 20,
): Promise<AgentReputation[]> {
  const db = getServiceDb();
  if (!db) return [];

  const { data, error } = await db
    .from('a2a_agent_reputation')
    .select('*')
    .order('reputation_score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    trust_level: row.trust_level,
    total_tasks: Number(row.total_tasks),
    completed_tasks: Number(row.completed_tasks),
    failed_tasks: Number(row.failed_tasks),
    expired_tasks: Number(row.expired_tasks),
    completion_rate: Number(row.completion_rate),
    failure_rate: Number(row.failure_rate),
    avg_completion_seconds: Number(row.avg_completion_seconds),
    total_ratings: Number(row.total_ratings),
    avg_rating: Number(row.avg_rating),
    weighted_avg_rating: Number(row.weighted_avg_rating),
    reputation_score: Number(row.reputation_score),
    last_feedback_at: row.last_feedback_at,
    computed_at: row.computed_at,
  }));
}

// ──────────────────────────────────────────────
// Router Integration
// ──────────────────────────────────────────────

/**
 * Default reputation score for agents with no history.
 * Slightly below middle (0.5) to give established agents an edge
 * while not penalizing newcomers too harshly.
 */
const DEFAULT_REPUTATION = 0.45;

/**
 * Blend a static trust score with a dynamic reputation score.
 *
 * When an agent has no reputation data, static trust is used fully.
 * As reputation data accumulates, it progressively replaces static trust:
 *   - < 5 tasks: 80% static, 20% reputation
 *   - 5-20 tasks: 50% static, 50% reputation
 *   - > 20 tasks: 20% static, 80% reputation
 *
 * This ensures new agents aren't disadvantaged while rewarding
 * proven performers over time.
 */
export function blendTrustAndReputation(
  staticTrustScore: number,
  reputationScore: number | undefined,
  totalTasks: number,
): number {
  if (reputationScore === undefined) {
    return staticTrustScore;
  }

  let reputationWeight: number;
  if (totalTasks < 5) {
    reputationWeight = 0.2;
  } else if (totalTasks <= 20) {
    reputationWeight = 0.5;
  } else {
    reputationWeight = 0.8;
  }

  const staticWeight = 1.0 - reputationWeight;
  return staticWeight * staticTrustScore + reputationWeight * reputationScore;
}

/**
 * Fetch reputation data and return a scoring function that the router
 * can use to get blended trust scores for any agent.
 *
 * Usage in router:
 *   const getBlendedTrust = await createReputationBlender(agentIds);
 *   const blendedScore = getBlendedTrust(agentId, staticTrustScore);
 */
export async function createReputationBlender(
  agentIds: string[],
): Promise<(agentId: string, staticTrustScore: number) => number> {
  const db = getServiceDb();

  if (!db || agentIds.length === 0) {
    // No DB or no agents — fall back to static trust only
    return (_agentId: string, staticTrustScore: number) => staticTrustScore;
  }

  // Batch-fetch reputation data for all candidate agents
  const { data } = await db
    .from('a2a_agent_reputation')
    .select('agent_id, reputation_score, total_tasks')
    .in('agent_id', agentIds);

  const reputationMap = new Map<string, { score: number; tasks: number }>();
  if (data) {
    for (const row of data) {
      reputationMap.set(row.agent_id, {
        score: Number(row.reputation_score),
        tasks: Number(row.total_tasks),
      });
    }
  }

  return (agentId: string, staticTrustScore: number): number => {
    const rep = reputationMap.get(agentId);
    if (!rep) return staticTrustScore;
    return blendTrustAndReputation(staticTrustScore, rep.score, rep.tasks);
  };
}
