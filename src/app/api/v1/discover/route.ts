import { NextResponse } from "next/server";
import { getTasks } from "@/lib/tasks";
import { getAllAgents } from "@/lib/agent-auth";
import { getCorsHeadersGet, CORS_HEADERS_GET } from "@/lib/api-headers";
import { getSubgraph } from "@/lib/knowledge";
import fs from "node:fs";
import path from "node:path";

interface RawNewsItem {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  published_at: string;
  tags?: string[];
}

function loadNews(): RawNewsItem[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/news/news.json"), "utf-8");
    return JSON.parse(raw) as RawNewsItem[];
  } catch {
    return [];
  }
}

function isHighRisk(item: RawNewsItem): boolean {
  const highRiskKeywords = [
    "security", "breach", "vulnerability", "outage", "shutdown", "ban",
    "lawsuit", "regulation", "compliance", "emergency", "critical", "exploit",
  ];
  const combined = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  return highRiskKeywords.some((kw) => combined.includes(kw));
}

export async function GET() {
  const headers = getCorsHeadersGet();

  // Trending tasks: top 5 open tasks by bid count
  const { tasks: allTasks } = await getTasks({ status: "open", limit: 200, offset: 0, sort: "newest" });
  const trendingTasks = [...allTasks]
    .sort((a, b) => b.bids.length - a.bids.length)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      budget_credits: t.budget.credits,
      bid_count: t.bids.length,
      skills: t.requirements.skills,
      created_at: t.created_at,
    }));

  // New agents: 5 most recently registered
  const agents = await getAllAgents();
  const newAgents = [...agents]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((a) => ({
      id: a.agent_id,
      name: a.name,
      capabilities: a.capabilities,
      registered_at: a.created_at,
    }));

  // Breaking news: top 3 high-risk items from last 24h
  const news = loadNews();
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const breakingNews = news
    .filter((n) => new Date(n.published_at).getTime() >= since24h && isHighRisk(n))
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 3)
    .map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      published_at: n.published_at,
      tags: n.tags ?? [],
    }));

  // Knowledge highlights: 3 most connected entities
  const { tasks: allTasksForCount } = await getTasks({ limit: 1000, offset: 0, sort: "newest" });

  // Get all entities and rank by relation count
  const { JsonFileStore } = await import("@/lib/data-store");
  interface Entity { id: string; name: string; type: string; description: string; relations: unknown[] }
  const entityStore = new JsonFileStore<Entity>(path.join(process.cwd(), "data/knowledge/entities.json"));
  const allEntities = await entityStore.getAll();
  const knowledgeHighlights = [...allEntities]
    .sort((a, b) => b.relations.length - a.relations.length)
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      description: e.description,
      connection_count: e.relations.length,
    }));

  // Platform stats
  const platformStats = {
    total_agents: agents.length,
    active_tasks: allTasksForCount.filter((t) => ["open", "bidding", "in_progress"].includes(t.status)).length,
    total_knowledge_entities: allEntities.length,
    total_news_items: news.length,
  };

  return NextResponse.json(
    {
      trending_tasks: trendingTasks,
      new_agents: newAgents,
      breaking_news: breakingNews,
      knowledge_highlights: knowledgeHighlights,
      platform_stats: platformStats,
      generated_at: new Date().toISOString(),
    },
    { headers },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
