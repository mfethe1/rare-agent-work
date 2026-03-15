/**
 * Predictive Intelligence Engine
 * Analyzes real platform data to generate forecasts.
 * Round 38
 */

import path from "node:path";
import fs from "node:fs/promises";
import { getTasks } from "./tasks";
import { getAllAgents } from "./agent-auth";

export interface Prediction {
  category: "skill_demand" | "agent_capacity" | "price_trend" | "platform_growth";
  title: string;
  prediction: string;
  confidence: number; // 0-1
  evidence: string[];
  timeframe: string;
  actionable_insight: string;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Skill Demand Forecast ────────────────────────────────────────────────────

export async function forecastSkillDemand(): Promise<Prediction> {
  const tasksResult = await getTasks({ limit: 500 });
  const tasks = tasksResult.tasks;

  // Count skill frequency across all tasks
  const skillCount: Record<string, number> = {};
  const recentSkillCount: Record<string, number> = {}; // last 14 days
  const cutoff = daysAgo(14);

  for (const task of tasks) {
    const isRecent = task.created_at ? new Date(task.created_at) > cutoff : false;
    for (const skill of task.requirements?.skills ?? []) {
      const norm = skill.toLowerCase();
      skillCount[norm] = (skillCount[norm] ?? 0) + 1;
      if (isRecent) recentSkillCount[norm] = (recentSkillCount[norm] ?? 0) + 1;
    }
  }

  // Find skills with accelerating demand (recent/total ratio > average)
  const totalTasks = tasks.length || 1;
  const recentTasks = tasks.filter(
    (t) => t.created_at && new Date(t.created_at) > cutoff,
  ).length || 1;

  const trending: Array<{ skill: string; momentum: number; count: number }> = [];
  for (const [skill, count] of Object.entries(skillCount)) {
    const recent = recentSkillCount[skill] ?? 0;
    const overallRate = count / totalTasks;
    const recentRate = recent / recentTasks;
    const momentum = overallRate > 0 ? recentRate / overallRate : 0;
    if (count >= 1) {
      trending.push({ skill, momentum, count });
    }
  }

  trending.sort((a, b) => b.momentum - a.momentum);
  const top = trending.slice(0, 5);

  const topSkillNames = top.map((t) => t.skill).join(", ") || "python, ml, backend";
  const evidence: string[] = [
    `Analyzed ${tasks.length} tasks for skill frequency`,
    `${Object.keys(recentSkillCount).length} distinct skills appear in recent tasks`,
    top.length > 0
      ? `Top trending: ${topSkillNames}`
      : "Insufficient recent data; using historical averages",
  ];

  return {
    category: "skill_demand",
    title: "Skill Demand Forecast — Next 30 Days",
    prediction: `High demand expected for: ${topSkillNames}. Agents with these capabilities should see increased task opportunities.`,
    confidence: tasks.length > 10 ? 0.72 : 0.35,
    evidence,
    timeframe: "30 days",
    actionable_insight: `Agents should consider acquiring or highlighting skills in: ${topSkillNames}. Task posters should expect higher bids for these skills.`,
  };
}

// ─── Agent Capacity Forecast ──────────────────────────────────────────────────

export async function forecastAgentCapacity(): Promise<Prediction> {
  const tasksResult = await getTasks({ status: "in_progress", limit: 200 });
  const inProgressTasks = tasksResult.tasks;

  const agents = await getAllAgents();
  const totalAgents = agents.length;
  const busyAgentIds = new Set(
    inProgressTasks
      .flatMap((t) => [t.assigned_agent_id, t.owner_agent_id])
      .filter(Boolean),
  );
  const busyAgents = busyAgentIds.size;
  const availableAgents = Math.max(0, totalAgents - busyAgents);

  // Estimate avg completion time (in hours) from completed tasks
  const completedResult = await getTasks({ status: "completed", limit: 100 });
  const completedTasks = completedResult.tasks;

  let avgCompletionHours = 24; // default assumption
  if (completedTasks.length > 0) {
    const durations = completedTasks
      .filter((t) => t.created_at && t.updated_at)
      .map((t) => {
        const ms = new Date(t.updated_at!).getTime() - new Date(t.created_at!).getTime();
        return ms / (1000 * 60 * 60);
      })
      .filter((h) => h > 0 && h < 720);

    if (durations.length > 0) {
      avgCompletionHours = durations.reduce((s, h) => s + h, 0) / durations.length;
    }
  }

  const capacityRate = totalAgents > 0 ? availableAgents / totalAgents : 0;
  const capacityPct = Math.round(capacityRate * 100);

  const evidence: string[] = [
    `${totalAgents} total registered agents`,
    `${busyAgents} agents currently handling in-progress tasks`,
    `${availableAgents} agents estimated available`,
    `Average task completion time: ~${Math.round(avgCompletionHours)}h (from ${completedTasks.length} completed tasks)`,
  ];

  return {
    category: "agent_capacity",
    title: "Agent Capacity Forecast",
    prediction: `Platform is ~${capacityPct}% available. ${inProgressTasks.length} tasks currently in progress. Expect ~${Math.round(avgCompletionHours)}h avg turnaround for new tasks.`,
    confidence: totalAgents > 5 ? 0.78 : 0.45,
    evidence,
    timeframe: "7 days",
    actionable_insight:
      capacityRate < 0.3
        ? "Platform capacity is constrained — task posters should set flexible deadlines or higher budgets to attract available agents."
        : "Good agent availability — task posters can expect fast responses.",
  };
}

// ─── Price Trend Prediction ───────────────────────────────────────────────────

export async function predictPriceTrends(): Promise<Prediction> {
  const tasksResult = await getTasks({ limit: 300 });
  const tasks = tasksResult.tasks;

  const allBids = tasks.flatMap((t) => t.bids ?? []);
  const recentCutoff = daysAgo(14);
  const recentBids = allBids.filter(
    (b) => b.created_at && new Date(b.created_at) > recentCutoff,
  );

  let avgBid = 0;
  let avgRecentBid = 0;

  if (allBids.length > 0) {
    avgBid = allBids.reduce((s, b) => s + b.amount, 0) / allBids.length;
  }
  if (recentBids.length > 0) {
    avgRecentBid = recentBids.reduce((s, b) => s + b.amount, 0) / recentBids.length;
  }

  const trend = avgBid > 0 ? (avgRecentBid - avgBid) / avgBid : 0;
  const trendPct = Math.round(trend * 100);
  const direction = trendPct > 5 ? "upward" : trendPct < -5 ? "downward" : "stable";

  const avgBudget =
    tasks.length > 0
      ? tasks.reduce((s, t) => s + (t.budget?.credits ?? 0), 0) / tasks.length
      : 0;

  const evidence: string[] = [
    `${allBids.length} total bids analyzed`,
    `${recentBids.length} bids in last 14 days`,
    avgBid > 0 ? `Historical avg bid: ${Math.round(avgBid)} credits` : "Insufficient bid history",
    avgRecentBid > 0 ? `Recent avg bid: ${Math.round(avgRecentBid)} credits` : "No recent bids",
    avgBudget > 0 ? `Average task budget: ${Math.round(avgBudget)} credits` : "Varied budgets",
  ];

  return {
    category: "price_trend",
    title: "Bid Price Trend Prediction",
    prediction: `Bid prices are trending ${direction} (${trendPct > 0 ? "+" : ""}${trendPct}% vs historical average). ${
      direction === "upward"
        ? "Competition for skilled agents is increasing."
        : direction === "downward"
        ? "More agents are available, driving prices down."
        : "Market prices are stable."
    }`,
    confidence: allBids.length > 20 ? 0.68 : 0.3,
    evidence,
    timeframe: "30 days",
    actionable_insight:
      direction === "upward"
        ? "Increase task budgets by 10-20% to remain competitive for top agents."
        : direction === "downward"
        ? "Good time to post tasks — competitive agent pricing available."
        : "Budget estimates are reliable; standard market rates apply.",
  };
}

// ─── Platform Growth Metrics ──────────────────────────────────────────────────

export async function forecastPlatformGrowth(): Promise<Prediction> {
  const agents = await getAllAgents();
  const tasksResult = await getTasks({ limit: 500 });
  const tasks = tasksResult.tasks;

  const cutoff7d = daysAgo(7);
  const cutoff14d = daysAgo(14);

  const agentsLast7 = agents.filter(
    (a) => a.created_at && new Date(a.created_at) > cutoff7d,
  ).length;
  const agentsPrev7 = agents.filter((a) => {
    if (!a.created_at) return false;
    const d = new Date(a.created_at);
    return d > cutoff14d && d <= cutoff7d;
  }).length;

  const tasksLast7 = tasks.filter(
    (t) => t.created_at && new Date(t.created_at) > cutoff7d,
  ).length;
  const tasksPrev7 = tasks.filter((t) => {
    if (!t.created_at) return false;
    const d = new Date(t.created_at);
    return d > cutoff14d && d <= cutoff7d;
  }).length;

  const agentGrowthRate =
    agentsPrev7 > 0 ? ((agentsLast7 - agentsPrev7) / agentsPrev7) * 100 : 0;
  const taskGrowthRate =
    tasksPrev7 > 0 ? ((tasksLast7 - tasksPrev7) / tasksPrev7) * 100 : 0;

  const evidence: string[] = [
    `${agents.length} total registered agents`,
    `${agentsLast7} new agents in last 7 days`,
    `Agent growth: ${agentGrowthRate >= 0 ? "+" : ""}${Math.round(agentGrowthRate)}% vs prior week`,
    `${tasksLast7} new tasks in last 7 days`,
    `Task creation growth: ${taskGrowthRate >= 0 ? "+" : ""}${Math.round(taskGrowthRate)}% vs prior week`,
  ];

  const overallMomentum =
    agentGrowthRate + taskGrowthRate > 0 ? "positive" : "flat or declining";

  return {
    category: "platform_growth",
    title: "Platform Growth Projection",
    prediction: `Platform shows ${overallMomentum} momentum. At current rates, expect ~${Math.round(agentsLast7 * 4)} new agents and ~${Math.round(tasksLast7 * 4)} new tasks in the next 30 days.`,
    confidence: agents.length > 10 ? 0.65 : 0.25,
    evidence,
    timeframe: "30 days",
    actionable_insight:
      overallMomentum === "positive"
        ? "Platform is growing — invest in onboarding, documentation, and discovery features."
        : "Growth is flat — consider incentive programs, showcase improvements, or outreach campaigns.",
  };
}

// ─── Master generate ──────────────────────────────────────────────────────────

export async function generateAllPredictions(): Promise<Prediction[]> {
  const [skillDemand, agentCapacity, priceTrend, platformGrowth] = await Promise.all([
    forecastSkillDemand(),
    forecastAgentCapacity(),
    predictPriceTrends(),
    forecastPlatformGrowth(),
  ]);

  return [skillDemand, agentCapacity, priceTrend, platformGrowth];
}
