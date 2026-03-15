/**
 * Marketplace Economics Dashboard
 * Round 33: Real-time marketplace economics computed from existing data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import fs from "node:fs";
import path from "node:path";

const TASKS_FILE = path.join(process.cwd(), "data/tasks/tasks.json");
const REPUTATION_FILE = path.join(process.cwd(), "data/agents/reputation.json");
const WALLETS_FILE = path.join(process.cwd(), "data/agents/wallets.json");

interface Task {
  id: string;
  owner_agent_id: string;
  assigned_agent_id?: string;
  status: string;
  requirements: { skills: string[] };
  budget: { credits: number };
  bids: { amount: number; created_at: string }[];
  created_at: string;
  updated_at: string;
}

interface ReputationRecord {
  agent_id: string;
  overall_score: number;
  trust_tier: string;
  signals: { tasks_completed: number };
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
}

interface WalletRecord {
  agent_id: string;
  transactions: WalletTransaction[];
}

function loadTasks(): Task[] {
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8")) as Task[];
  } catch {
    return [];
  }
}

function loadReputation(): Record<string, ReputationRecord> {
  try {
    return JSON.parse(fs.readFileSync(REPUTATION_FILE, "utf-8")) as Record<string, ReputationRecord>;
  } catch {
    return {};
  }
}

function loadWallets(): Record<string, WalletRecord> {
  try {
    return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf-8")) as Record<string, WalletRecord>;
  } catch {
    return {};
  }
}

function daysBefore(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET(req: NextRequest) {
  const tasks = loadTasks();
  const reputation = loadReputation();
  const wallets = loadWallets();

  const now = new Date();
  const cutoff7d = daysBefore(7);
  const cutoff30d = daysBefore(30);

  // ── Supply & Demand ──────────────────────────────────────────────────────────
  // Collect all skills from tasks
  const skillSet = new Set<string>();
  tasks.forEach((t) => t.requirements?.skills?.forEach((s) => skillSet.add(s)));

  const supply_demand = Array.from(skillSet).map((skill) => {
    const openTasks = tasks.filter(
      (t) =>
        t.requirements?.skills?.includes(skill) &&
        (t.status === "open" || t.status === "bidding"),
    ).length;

    // Agents available = agents with this skill in their verified skills (approximated from reputation)
    // We use tasks they've completed as a proxy
    const completedForSkill = tasks.filter(
      (t) =>
        t.requirements?.skills?.includes(skill) &&
        t.status === "completed" &&
        t.assigned_agent_id,
    );
    const uniqueAgents = new Set(completedForSkill.map((t) => t.assigned_agent_id)).size;
    const agents_available = Math.max(uniqueAgents, openTasks > 0 ? 1 : 0);

    return {
      skill,
      agents_available,
      open_tasks: openTasks,
      ratio: agents_available > 0 ? openTasks / agents_available : openTasks,
    };
  });

  // ── Pricing Trends ──────────────────────────────────────────────────────────
  const pricing_trends = Array.from(skillSet).map((skill) => {
    const skillTasks = tasks.filter((t) => t.requirements?.skills?.includes(skill));

    const bids7d = skillTasks.flatMap((t) =>
      (t.bids ?? []).filter((b) => new Date(b.created_at) >= cutoff7d).map((b) => b.amount),
    );
    const bids30d = skillTasks.flatMap((t) =>
      (t.bids ?? []).filter((b) => new Date(b.created_at) >= cutoff30d).map((b) => b.amount),
    );

    const avg7d = bids7d.length > 0 ? bids7d.reduce((a, b) => a + b, 0) / bids7d.length : 0;
    const avg30d = bids30d.length > 0 ? bids30d.reduce((a, b) => a + b, 0) / bids30d.length : 0;

    let trend: "up" | "down" | "stable" = "stable";
    if (avg30d > 0 && avg7d > 0) {
      const change = (avg7d - avg30d) / avg30d;
      if (change > 0.05) trend = "up";
      else if (change < -0.05) trend = "down";
    }

    return { skill, avg_bid_7d: Math.round(avg7d * 100) / 100, avg_bid_30d: Math.round(avg30d * 100) / 100, trend };
  });

  // ── Top Earners (last 30d, credits received via tasks) ───────────────────────
  const earnerMap: Record<string, { credits: number; tasks: number }> = {};

  Object.values(wallets).forEach((w) => {
    const credits30d = (w.transactions ?? [])
      .filter(
        (tx) =>
          tx.type === "credit" &&
          new Date(tx.created_at) >= cutoff30d,
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const rep = reputation[w.agent_id];
    const tasks_completed = rep?.signals?.tasks_completed ?? 0;

    if (credits30d > 0) {
      earnerMap[w.agent_id] = { credits: credits30d, tasks: tasks_completed };
    }
  });

  const top_earners = Object.entries(earnerMap)
    .sort((a, b) => b[1].credits - a[1].credits)
    .slice(0, 10)
    .map(([agent_id, v]) => ({
      agent_id,
      credits_earned_30d: Math.round(v.credits * 100) / 100,
      tasks_completed: v.tasks,
    }));

  // ── Platform Volume ──────────────────────────────────────────────────────────
  const completed30d = tasks.filter(
    (t) => t.status === "completed" && new Date(t.updated_at) >= cutoff30d,
  );

  const totalCredits30d = completed30d.reduce((sum, t) => sum + (t.budget?.credits ?? 0), 0);
  const tasksCompleted30d = completed30d.length;
  const avgTaskValue = tasksCompleted30d > 0 ? totalCredits30d / tasksCompleted30d : 0;

  const platform_volume = {
    total_credits_transacted_30d: Math.round(totalCredits30d * 100) / 100,
    tasks_completed_30d: tasksCompleted30d,
    avg_task_value: Math.round(avgTaskValue * 100) / 100,
  };

  // ── Skill Demand Forecast ────────────────────────────────────────────────────
  const skill_demand_forecast = Array.from(skillSet).map((skill) => {
    const recent7 = tasks.filter(
      (t) => t.requirements?.skills?.includes(skill) && new Date(t.created_at) >= cutoff7d,
    ).length;
    const prior7 = tasks.filter((t) => {
      const created = new Date(t.created_at);
      return t.requirements?.skills?.includes(skill) && created < cutoff7d && created >= daysBefore(14);
    }).length;

    let predicted_demand_change: "increasing" | "decreasing" | "stable" = "stable";
    let confidence = 0.5;

    if (prior7 > 0) {
      const change = (recent7 - prior7) / prior7;
      if (change > 0.2) {
        predicted_demand_change = "increasing";
        confidence = Math.min(0.9, 0.5 + change / 2);
      } else if (change < -0.2) {
        predicted_demand_change = "decreasing";
        confidence = Math.min(0.9, 0.5 + Math.abs(change) / 2);
      }
    } else if (recent7 > 0) {
      predicted_demand_change = "increasing";
      confidence = 0.6;
    }

    return {
      skill,
      predicted_demand_change,
      confidence: Math.round(confidence * 100) / 100,
    };
  });

  return NextResponse.json(
    {
      supply_demand,
      pricing_trends,
      top_earners,
      platform_volume,
      skill_demand_forecast,
      computed_at: now.toISOString(),
    },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
