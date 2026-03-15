/**
 * Auto-Matching Engine
 * Find the top agents for a task based on skill overlap, reputation, availability, and price.
 * Round 21
 */

import { getAllAgents, type AgentRecord } from "./agent-auth";
import { getReputation, type TrustTier } from "./reputation";
import { getTasks, type Task } from "./tasks";
import { notifyAgent } from "./notifications";

export interface MatchFactors {
  skill_match: number;    // 0-1 Jaccard similarity
  reputation: number;     // 0-1 normalized score
  availability: number;   // 0-1 (1 = fully available)
  price_fit: number;      // 0-1 (how well their typical bids fit the budget)
}

export interface AgentMatch {
  agent_id: string;
  agent_name: string;
  match_score: number;
  factors: MatchFactors;
  recommended: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function jaccardSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 0;

  const normalize = (s: string) => s.toLowerCase().trim();
  const a = new Set(setA.map(normalize));
  const b = new Set(setB.map(normalize));

  // Partial match: also check substring overlap
  let intersectionCount = 0;
  for (const itemA of a) {
    for (const itemB of b) {
      if (itemA === itemB || itemA.includes(itemB) || itemB.includes(itemA)) {
        intersectionCount++;
        break;
      }
    }
  }

  const unionSize = new Set([...a, ...b]).size;
  if (unionSize === 0) return 0;

  return Math.min(1, intersectionCount / Math.min(a.size, b.size));
}

const TIER_WEIGHTS: Record<TrustTier, number> = {
  expert: 1.0,
  trusted: 0.75,
  verified: 0.5,
  unverified: 0.25,
};

function normalizeReputation(score: number, tier: TrustTier): number {
  return score * 0.7 + TIER_WEIGHTS[tier] * 0.3;
}

async function getInProgressCount(agentId: string): Promise<number> {
  const result = await getTasks({ status: "in_progress", limit: 100 });
  return result.tasks.filter(
    (t) => t.assigned_agent_id === agentId || t.owner_agent_id === agentId,
  ).length;
}

async function getAverageBidAmount(agentId: string): Promise<number | null> {
  const result = await getTasks({ limit: 200 });
  const agentBids = result.tasks
    .flatMap((t) => t.bids)
    .filter((b) => b.bidder_agent_id === agentId);

  if (agentBids.length === 0) return null;
  return agentBids.reduce((sum, b) => sum + b.amount, 0) / agentBids.length;
}

function priceFitScore(avgBid: number | null, taskBudget: number): number {
  if (avgBid === null) return 0.5; // neutral for new agents
  if (avgBid <= taskBudget) return 1.0; // within budget
  const overage = (avgBid - taskBudget) / taskBudget;
  return Math.max(0, 1 - overage); // penalize overage proportionally
}

// ─── Main matching function ────────────────────────────────────────────────────

export async function findMatchingAgents(task: Task): Promise<AgentMatch[]> {
  const allAgents = await getAllAgents();

  // Exclude the task owner from matches
  const candidates = allAgents.filter((a) => a.agent_id !== task.owner_agent_id);

  if (candidates.length === 0) return [];

  const scored = await Promise.all(
    candidates.map(async (agent): Promise<AgentMatch> => {
      const rep = await getReputation(agent.agent_id);
      const inProgressCount = await getInProgressCount(agent.agent_id);
      const avgBid = await getAverageBidAmount(agent.agent_id);

      // Factor 1: Skill overlap
      const skill_match = jaccardSimilarity(
        task.requirements.skills,
        agent.capabilities,
      );

      // Factor 2: Reputation (normalized)
      const reputation = normalizeReputation(rep.overall_score, rep.trust_tier);

      // Factor 3: Availability (penalize busy agents)
      // 0 in_progress = 1.0, 5+ = 0.0
      const availability = Math.max(0, 1 - inProgressCount / 5);

      // Factor 4: Price fit
      const price_fit = priceFitScore(avgBid, task.budget.credits);

      // Weighted composite score
      const match_score =
        skill_match * 0.40 +
        reputation * 0.30 +
        availability * 0.20 +
        price_fit * 0.10;

      return {
        agent_id: agent.agent_id,
        agent_name: agent.name,
        match_score: Math.round(match_score * 1000) / 1000,
        factors: {
          skill_match: Math.round(skill_match * 1000) / 1000,
          reputation: Math.round(reputation * 1000) / 1000,
          availability: Math.round(availability * 1000) / 1000,
          price_fit: Math.round(price_fit * 1000) / 1000,
        },
        recommended: false, // set after sorting
      };
    }),
  );

  // Sort by score descending, take top 5
  scored.sort((a, b) => b.match_score - a.match_score);
  const top5 = scored.slice(0, 5);

  // Mark top match as recommended (if score > 0.3)
  if (top5.length > 0 && top5[0].match_score > 0.3) {
    top5[0].recommended = true;
  }

  return top5;
}

/**
 * Called when a task is created — fires and forgets matches + notifications.
 */
export function triggerMatchingForTask(task: Task): void {
  findMatchingAgents(task).then((matches) => {
    for (const match of matches) {
      notifyAgent({
        agent_id: match.agent_id,
        type: "task_match",
        title: "New task match",
        message: `You're a strong match (${Math.round(match.match_score * 100)}%) for task: "${task.title}"`,
        data: {
          task_id: task.id,
          match_score: match.match_score,
          factors: match.factors,
          recommended: match.recommended,
        },
      });
    }
  }).catch(() => {});
}
