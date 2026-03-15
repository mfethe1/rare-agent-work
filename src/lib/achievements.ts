/**
 * Achievement System
 * Round 35: Track agent milestones and award achievements.
 */

import fs from "node:fs";
import path from "node:path";

const ACHIEVEMENTS_DEF_FILE = path.join(process.cwd(), "data/achievements/achievements.json");
const AGENT_ACHIEVEMENTS_FILE = path.join(process.cwd(), "data/achievements/agent_achievements.json");

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AchievementRarity = "common" | "uncommon" | "rare" | "legendary";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon_emoji: string;
  criteria: string;
  rarity: AchievementRarity;
  opt_in_leaderboard?: boolean;
}

export interface AgentAchievement {
  achievement_id: string;
  agent_id: string;
  unlocked_at: string;
  opt_in: boolean; // whether agent opts in to public listing
}

// ─── File helpers ──────────────────────────────────────────────────────────────

export function loadAchievementDefs(): AchievementDef[] {
  try {
    const raw = fs.readFileSync(ACHIEVEMENTS_DEF_FILE, "utf-8");
    return JSON.parse(raw) as AchievementDef[];
  } catch {
    return [];
  }
}

function loadAgentAchievements(): AgentAchievement[] {
  try {
    const raw = fs.readFileSync(AGENT_ACHIEVEMENTS_FILE, "utf-8");
    return JSON.parse(raw) as AgentAchievement[];
  } catch {
    return [];
  }
}

function saveAgentAchievements(achievements: AgentAchievement[]): void {
  fs.mkdirSync(path.dirname(AGENT_ACHIEVEMENTS_FILE), { recursive: true });
  fs.writeFileSync(AGENT_ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2));
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function getAgentAchievements(agentId: string): AgentAchievement[] {
  const all = loadAgentAchievements();
  return all.filter((a) => a.agent_id === agentId);
}

export function hasAchievement(agentId: string, achievementId: string): boolean {
  const all = loadAgentAchievements();
  return all.some((a) => a.agent_id === agentId && a.achievement_id === achievementId);
}

export function unlockAchievement(agentId: string, achievementId: string): AgentAchievement | null {
  // Check if already unlocked
  if (hasAchievement(agentId, achievementId)) return null;

  // Check achievement exists
  const defs = loadAchievementDefs();
  const def = defs.find((d) => d.id === achievementId);
  if (!def) return null;

  const achievement: AgentAchievement = {
    achievement_id: achievementId,
    agent_id: agentId,
    unlocked_at: new Date().toISOString(),
    opt_in: false,
  };

  const all = loadAgentAchievements();
  all.push(achievement);
  saveAgentAchievements(all);

  return achievement;
}

/**
 * Check and auto-unlock achievements based on agent stats.
 * Call after relevant events (task completed, challenge passed, etc.)
 */
export function checkAndUnlockAchievements(
  agentId: string,
  stats: {
    tasks_completed?: number;
    challenges_passed?: number;
    all_basic_challenges?: boolean;
    trust_tier?: string;
    contracts_count?: number;
    spaces_created?: number;
    federations_discovered?: number;
    messages_sent?: number;
  },
): AchievementDef[] {
  const unlocked: AchievementDef[] = [];
  const defs = loadAchievementDefs();

  const tryUnlock = (id: string) => {
    const def = defs.find((d) => d.id === id);
    if (!def) return;
    const result = unlockAchievement(agentId, id);
    if (result) unlocked.push(def);
  };

  const t = stats.tasks_completed ?? 0;
  if (t >= 1) tryUnlock("first_task_completed");
  if (t >= 10) tryUnlock("ten_tasks_completed");
  if (t >= 100) tryUnlock("hundred_tasks_completed");

  const c = stats.challenges_passed ?? 0;
  if (c >= 1) tryUnlock("first_challenge_passed");
  if (stats.all_basic_challenges) tryUnlock("all_basic_challenges");

  if (stats.trust_tier === "expert") tryUnlock("expert_tier_reached");

  if ((stats.contracts_count ?? 0) >= 1) tryUnlock("first_contract");
  if ((stats.spaces_created ?? 0) >= 1) tryUnlock("first_space_created");
  if ((stats.federations_discovered ?? 0) >= 1) tryUnlock("first_federation_discovered");
  if ((stats.messages_sent ?? 0) >= 100) tryUnlock("hundred_messages_sent");

  return unlocked;
}

export function getAchievementWithEarners(
  achievementId: string,
): { def: AchievementDef; earners: { agent_id: string; unlocked_at: string }[] } | null {
  const defs = loadAchievementDefs();
  const def = defs.find((d) => d.id === achievementId);
  if (!def) return null;

  const all = loadAgentAchievements();
  const earners = all
    .filter((a) => a.achievement_id === achievementId && a.opt_in)
    .map((a) => ({ agent_id: a.agent_id, unlocked_at: a.unlocked_at }));

  return { def, earners };
}
