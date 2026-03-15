import { NextResponse } from "next/server";
import { getCorsHeadersGet, CORS_HEADERS_GET } from "@/lib/api-headers";
import { getAllAgents } from "@/lib/agent-auth";
import { getTasks } from "@/lib/tasks";
import { JsonFileStore } from "@/lib/data-store";
import path from "node:path";
import fs from "node:fs";

export async function GET() {
  const headers = getCorsHeadersGet();

  // Agents
  const agents = await getAllAgents();
  const total_agents = agents.length;

  // Capability distribution
  const capCounts: Record<string, number> = {};
  for (const agent of agents) {
    for (const cap of agent.capabilities) {
      capCounts[cap] = (capCounts[cap] ?? 0) + 1;
    }
  }
  const top_capabilities = Object.entries(capCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([capability, agent_count]) => ({ capability, agent_count }));

  // Tasks
  const { tasks: allTasks } = await getTasks({ limit: 10000, offset: 0, sort: "newest" });
  const total_tasks_completed = allTasks.filter((t) => t.status === "completed").length;
  const active_contracts = allTasks.filter((t) =>
    ["in_progress", "delivered", "reviewing"].includes(t.status),
  ).length;

  // Knowledge entities
  interface Entity { id: string; relations: unknown[] }
  const entityStore = new JsonFileStore<Entity>(
    path.join(process.cwd(), "data/knowledge/entities.json"),
  );
  const entities = await entityStore.getAll();
  const total_knowledge_entities = entities.length;

  // News
  let news: Array<{ published_at: string }> = [];
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/news/news.json"), "utf-8");
    news = JSON.parse(raw);
  } catch {
    news = [];
  }
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const news_items_30d = news.filter((n) => new Date(n.published_at).getTime() >= thirtyDaysAgo).length;

  // API calls (sum across all agent analytics files)
  let api_calls_24h = 0;
  const analyticsDir = path.join(process.cwd(), "data/analytics");
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const files = fs.readdirSync(analyticsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(analyticsDir, file), "utf-8");
        const data = JSON.parse(raw) as { api_calls: Array<{ date: string }> };
        api_calls_24h += (data.api_calls ?? []).filter(
          (c) => c.date === today || c.date === yesterday,
        ).length;
      } catch {
        // skip
      }
    }
  } catch {
    api_calls_24h = 0;
  }

  return NextResponse.json(
    {
      total_agents,
      total_tasks_completed,
      total_knowledge_entities,
      news_items_30d,
      active_contracts,
      api_calls_24h,
      top_capabilities,
      generated_at: new Date().toISOString(),
    },
    { headers },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
