import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { queryEntities, type EntityType } from "@/lib/knowledge";
import { getTasks } from "@/lib/tasks";
import { getAllAgents } from "@/lib/agent-auth";
import { getReputation } from "@/lib/reputation";
import fs from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";

// ─── MCP Audit Log ─────────────────────────────────────────────────────────────

const MCP_AUDIT_FILE = path.join(process.cwd(), "data/audit/mcp-invocations.json");

interface McpAuditEntry {
  timestamp: string;
  agent_id: string;
  tool: string;
  arguments: Record<string, unknown>;
  result_status: "success" | "error";
  duration_ms: number;
}

async function logMcpInvocation(entry: McpAuditEntry): Promise<void> {
  try {
    const dir = path.dirname(MCP_AUDIT_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    let log: McpAuditEntry[] = [];
    try {
      const raw = await fsAsync.readFile(MCP_AUDIT_FILE, "utf-8");
      log = JSON.parse(raw) as McpAuditEntry[];
    } catch { /* file may not exist */ }

    log.push(entry);
    await fsAsync.writeFile(MCP_AUDIT_FILE, JSON.stringify(log, null, 2), "utf-8");
  } catch { /* audit must never break the main flow */ }
}

// ─── Internal handler implementations ─────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  published_at: string;
  tags?: string[];
}

function loadNews(): NewsItem[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/news/news.json"), "utf-8");
    return JSON.parse(raw) as NewsItem[];
  } catch {
    return [];
  }
}

function loadReports(): Array<{ slug: string; title: string; status: string; summary: string; content: string; updated_at: string; price_credits?: number }> {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/reports/reports.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function handleSearchNews(args: Record<string, unknown>) {
  const tags = typeof args.tags === "string" ? args.tags.split(",").map((t) => t.trim().toLowerCase()) : [];
  const since = typeof args.since === "string" ? new Date(args.since).getTime() : null;
  const limitRaw = typeof args.limit === "number" ? args.limit : 20;
  const limit = Math.min(Math.max(1, limitRaw), 100);
  const sort = typeof args.sort === "string" ? args.sort : "newest";

  let items = loadNews();
  if (tags.length > 0) {
    items = items.filter((n) => (n.tags ?? []).some((t) => tags.includes(t.toLowerCase())));
  }
  if (since !== null) {
    items = items.filter((n) => new Date(n.published_at).getTime() >= since);
  }
  if (sort === "newest") items.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  else if (sort === "oldest") items.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());

  const page = items.slice(0, limit);
  return { items: page, pagination: { total: items.length, limit, offset: 0, has_more: items.length > limit } };
}

async function handleGetReport(args: Record<string, unknown>) {
  const slug = typeof args.slug === "string" ? args.slug : null;
  if (!slug) throw new Error("slug is required");
  const reports = loadReports();
  const report = reports.find((r) => r.slug === slug && (r.status === "published" || r.status === "approved"));
  if (!report) throw new Error(`Report not found: ${slug}`);
  return report;
}

async function handleSearchAgents(args: Record<string, unknown>) {
  const capability = typeof args.capability === "string" ? args.capability.toLowerCase() : undefined;
  const min_reputation = typeof args.min_reputation === "number" ? args.min_reputation : undefined;
  const trust_tier = typeof args.trust_tier === "string" ? args.trust_tier : undefined;
  const limit = typeof args.limit === "number" ? Math.min(args.limit, 100) : 20;

  let agents = await getAllAgents();
  if (capability) {
    agents = agents.filter((a) => a.capabilities.some((c) => c.toLowerCase().includes(capability)));
  }

  const enriched = await Promise.all(agents.map(async (a) => {
    const rep = await getReputation(a.agent_id);
    return {
      id: a.agent_id,
      name: a.name,
      capabilities: a.capabilities,
      reputation_score: rep.overall_score,
      trust_tier: rep.trust_tier,
    };
  }));

  const filtered = enriched.filter((a) => {
    if (min_reputation !== undefined && a.reputation_score < min_reputation) return false;
    if (trust_tier && a.trust_tier !== trust_tier) return false;
    return true;
  }).slice(0, limit);

  return { agents: filtered, pagination: { total: filtered.length, limit, offset: 0, has_more: false } };
}

async function handleQueryKnowledge(args: Record<string, unknown>) {
  const q = typeof args.q === "string" ? args.q : null;
  if (!q) throw new Error("q is required");

  const VALID_TYPES: EntityType[] = ["framework", "vendor", "model", "benchmark", "incident", "regulation"];
  const typesArg = typeof args.types === "string" ? args.types : undefined;
  let types: EntityType[] | undefined;
  if (typesArg) {
    const parsed = typesArg.split(",").map((t) => t.trim()) as EntityType[];
    types = parsed.filter((t) => VALID_TYPES.includes(t));
  }

  const limitRaw = typeof args.limit === "number" ? args.limit : 10;
  const limit = Math.min(Math.max(1, limitRaw), 50);
  const results = await queryEntities(q.trim(), types, limit);
  return { query: q, results, total: results.length };
}

async function handleGetBriefing(_args: Record<string, unknown>) {
  const allNews = loadNews();
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = allNews.filter((n) => new Date(n.published_at).getTime() >= cutoff);

  const highRiskKw = ["security", "breach", "vulnerability", "outage", "shutdown", "ban", "lawsuit", "regulation", "compliance", "emergency", "critical", "exploit"];
  const topStories = recent
    .filter((n) => highRiskKw.some((kw) => `${n.title} ${n.summary ?? ""}`.toLowerCase().includes(kw)))
    .slice(0, 5)
    .map((n) => ({ id: n.id, title: n.title, summary: n.summary }));

  const overallRiskLevel = topStories.length >= 3 ? "high" : topStories.length >= 1 ? "medium" : "low";

  return {
    briefing_date: new Date().toISOString(),
    executive_summary: `${recent.length} items analyzed from the past 48h. ${topStories.length} high-risk items identified.`,
    top_stories: topStories,
    risk_level: overallRiskLevel,
    recommended_actions: topStories.length > 0
      ? ["Review flagged items", "Check your integrations for affected services"]
      : ["Monitor for developments"],
  };
}

// ─── Tool dispatch ─────────────────────────────────────────────────────────────

const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  search_news: handleSearchNews,
  get_report: handleGetReport,
  search_agents: handleSearchAgents,
  query_knowledge: handleQueryKnowledge,
  get_briefing: handleGetBriefing,
};

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: getCorsHeaders() });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Request body must be a JSON object", "INVALID_BODY", 400);
  }

  const b = body as Record<string, unknown>;

  if (!b.tool || typeof b.tool !== "string") {
    return errorResponse("Field 'tool' is required", "MISSING_TOOL", 400);
  }

  const handler = TOOL_HANDLERS[b.tool];
  if (!handler) {
    return errorResponse(
      `Unknown tool: ${b.tool}. Available: ${Object.keys(TOOL_HANDLERS).join(", ")}`,
      "UNKNOWN_TOOL",
      400,
    );
  }

  const args = (b.arguments && typeof b.arguments === "object" ? b.arguments : {}) as Record<string, unknown>;

  // Extract agent_id from auth header if present
  const authHeader = req.headers.get("Authorization");
  const agentId = authHeader?.startsWith("Bearer ") ? authHeader.slice(7, 20) + "..." : "anonymous";

  const startTime = Date.now();

  try {
    const result = await handler(args);
    const duration_ms = Date.now() - startTime;

    // Log invocation (fire-and-forget)
    logMcpInvocation({
      timestamp: new Date().toISOString(),
      agent_id: agentId,
      tool: b.tool as string,
      arguments: args,
      result_status: "success",
      duration_ms,
    }).catch(() => {});

    return NextResponse.json(
      {
        tool: b.tool,
        result,
        meta: { executed_at: new Date().toISOString(), duration_ms },
      },
      { headers: getCorsHeaders() },
    );
  } catch (err) {
    const duration_ms = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : "Tool execution failed";

    // Log failed invocation
    logMcpInvocation({
      timestamp: new Date().toISOString(),
      agent_id: agentId,
      tool: b.tool as string,
      arguments: args,
      result_status: "error",
      duration_ms,
    }).catch(() => {});

    return errorResponse(msg, "TOOL_ERROR", 400);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
