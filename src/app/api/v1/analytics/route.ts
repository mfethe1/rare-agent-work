import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { getTasks } from "@/lib/tasks";
import fs from "node:fs";
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: getCorsHeaders() });
}

interface AnalyticsRecord {
  agent_id: string;
  api_calls: Array<{ date: string; endpoint: string }>;
  credits_spent: Array<{ date: string; amount: number }>;
}

const ANALYTICS_DIR = path.join(process.cwd(), "data/analytics");

function getAnalyticsFile(agentId: string): string {
  return path.join(ANALYTICS_DIR, `${agentId}.json`);
}

function loadAgentAnalytics(agentId: string): AnalyticsRecord {
  try {
    const raw = fs.readFileSync(getAnalyticsFile(agentId), "utf-8");
    return JSON.parse(raw) as AnalyticsRecord;
  } catch {
    return { agent_id: agentId, api_calls: [], credits_spent: [] };
  }
}

function dateStr(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  const analytics = loadAgentAnalytics(agent.agent_id);

  const today = dateStr(0);
  const weekAgo = dateStr(7);

  const api_calls_today = analytics.api_calls.filter((c) => c.date === today).length;
  const api_calls_week = analytics.api_calls.filter((c) => c.date >= weekAgo).length;
  const credits_spent_week = analytics.credits_spent
    .filter((c) => c.date >= weekAgo)
    .reduce((sum, c) => sum + c.amount, 0);

  // Top endpoints
  const endpointCounts: Record<string, number> = {};
  for (const call of analytics.api_calls) {
    endpointCounts[call.endpoint] = (endpointCounts[call.endpoint] ?? 0) + 1;
  }
  const top_endpoints = Object.entries(endpointCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }));

  // Activity timeline (last 14 days)
  const timelineCounts: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    timelineCounts[dateStr(i)] = 0;
  }
  for (const call of analytics.api_calls.filter((c) => c.date >= dateStr(13))) {
    timelineCounts[call.date] = (timelineCounts[call.date] ?? 0) + 1;
  }
  const activity_timeline = Object.entries(timelineCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, calls]) => ({ date, calls }));

  // Tasks from data store
  const { tasks: allTasks } = await getTasks({ limit: 1000, offset: 0, sort: "newest" });
  const tasks_completed = allTasks.filter(
    (t) => t.status === "completed" && t.owner_agent_id === agent.agent_id,
  ).length;
  const tasks_posted = allTasks.filter((t) => t.owner_agent_id === agent.agent_id).length;

  return NextResponse.json(
    {
      agent_id: agent.agent_id,
      api_calls_today,
      api_calls_week,
      credits_spent_week,
      tasks_completed,
      tasks_posted,
      top_endpoints,
      activity_timeline,
    },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
