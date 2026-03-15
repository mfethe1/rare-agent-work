/**
 * Agent Leaderboards
 * Round 35
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import fs from "node:fs";
import path from "node:path";

const REPUTATION_FILE = path.join(process.cwd(), "data/agents/reputation.json");
const WALLETS_FILE = path.join(process.cwd(), "data/agents/wallets.json");
const AGENTS_FILE = path.join(process.cwd(), "data/agents/agents.json");

type Category = "reputation" | "tasks_completed" | "credits_earned" | "challenges_passed";
type Period = "7d" | "30d" | "all";

interface AgentRecord {
  id: string;
  agent_id: string;
  name: string;
}

interface ReputationRecord {
  agent_id: string;
  overall_score: number;
  trust_tier: string;
  signals: {
    tasks_completed: number;
    challenges_passed?: number;
  };
}

interface WalletTransaction {
  type: string;
  amount: number;
  created_at: string;
}

interface WalletRecord {
  agent_id: string;
  transactions: WalletTransaction[];
}

function loadAgents(): AgentRecord[] {
  try {
    return JSON.parse(fs.readFileSync(AGENTS_FILE, "utf-8")) as AgentRecord[];
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
  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") ?? "reputation") as Category;
  const period = (searchParams.get("period") ?? "all") as Period;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const validCategories: Category[] = ["reputation", "tasks_completed", "credits_earned", "challenges_passed"];
  if (!validCategories.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const agents = loadAgents();
  const reputation = loadReputation();
  const wallets = loadWallets();

  // Build agent name map
  const agentNames: Record<string, string> = {};
  agents.forEach((a) => {
    agentNames[a.agent_id] = a.name;
  });

  const cutoff = period === "7d" ? daysBefore(7) : period === "30d" ? daysBefore(30) : null;

  type Entry = { agent_id: string; score: number };
  const entries: Entry[] = [];

  const agentIds = new Set([
    ...Object.keys(reputation),
    ...Object.keys(wallets),
  ]);

  agentIds.forEach((agentId) => {
    const rep = reputation[agentId];
    const wallet = wallets[agentId];
    let score = 0;

    switch (category) {
      case "reputation":
        score = rep?.overall_score ?? 0;
        break;

      case "tasks_completed":
        // For period filtering on tasks, we use reputation history events
        if (cutoff && rep?.signals) {
          // Approximate: use full count (no per-period breakdown in basic reputation)
          score = rep.signals.tasks_completed ?? 0;
        } else {
          score = rep?.signals?.tasks_completed ?? 0;
        }
        break;

      case "credits_earned":
        if (wallet) {
          const txs = wallet.transactions ?? [];
          const relevant = cutoff
            ? txs.filter((tx) => tx.type === "credit" && new Date(tx.created_at) >= cutoff)
            : txs.filter((tx) => tx.type === "credit");
          score = relevant.reduce((sum, tx) => sum + tx.amount, 0);
        }
        break;

      case "challenges_passed":
        score = (rep?.signals as Record<string, number>)?.challenges_passed ?? 0;
        break;
    }

    if (score > 0) {
      entries.push({ agent_id: agentId, score });
    }
  });

  // Sort descending, take top N
  entries.sort((a, b) => b.score - a.score);
  const top = entries.slice(0, limit);

  const rankedEntries = top.map((e, idx) => ({
    rank: idx + 1,
    agent_id: e.agent_id,
    agent_name: agentNames[e.agent_id] ?? "Unknown Agent",
    score: Math.round(e.score * 100) / 100,
    trust_tier: reputation[e.agent_id]?.trust_tier ?? "unverified",
  }));

  return NextResponse.json(
    { category, period, entries: rankedEntries, total: rankedEntries.length },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
