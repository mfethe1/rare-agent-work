import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { CORS_HEADERS_GET, CORS_HEADERS } from "@/lib/api-headers";


function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RawNewsItem {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  published_at: string;
  tags?: string[];
}

interface OperatorSignal {
  action_required: boolean;
  risk_level: "low" | "medium" | "high";
}

interface NewsItemV1 extends RawNewsItem {
  tags: string[];
  operator_signal: OperatorSignal;
  relevance_score: number;
}

// ─── Data helpers ──────────────────────────────────────────────────────────────

function loadNews(): RawNewsItem[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/news/news.json"), "utf-8");
    return JSON.parse(raw) as RawNewsItem[];
  } catch {
    return [];
  }
}

/**
 * Derive an operator signal heuristically from tags and content.
 */
function deriveOperatorSignal(item: RawNewsItem): OperatorSignal {
  const tags = (item.tags ?? []).map((t) => t.toLowerCase());
  const titleLower = item.title.toLowerCase();
  const summaryLower = (item.summary ?? "").toLowerCase();
  const combined = `${titleLower} ${summaryLower}`;

  const highRiskKeywords = [
    "security", "breach", "vulnerability", "outage", "shutdown", "ban",
    "lawsuit", "regulation", "compliance", "emergency", "critical", "exploit",
  ];
  const mediumRiskKeywords = [
    "deprecation", "pricing change", "rate limit", "policy", "update",
    "breaking change", "migration", "sunset", "warning", "risk",
  ];

  let riskLevel: OperatorSignal["risk_level"] = "low";
  let action_required = false;

  if (highRiskKeywords.some((kw) => combined.includes(kw))) {
    riskLevel = "high";
    action_required = true;
  } else if (mediumRiskKeywords.some((kw) => combined.includes(kw))) {
    riskLevel = "medium";
    action_required = tags.includes("agents") || tags.includes("openai") || tags.includes("anthropic");
  }

  return { action_required, risk_level: riskLevel };
}

/**
 * Score relevance: blend recency + tag match.
 */
function scoreRelevance(item: RawNewsItem, filterTags: string[]): number {
  const now = Date.now();
  const published = new Date(item.published_at).getTime();
  const ageHours = (now - published) / (1000 * 60 * 60);

  // Recency score: decay over 7 days (168h), max 0.7
  const recencyScore = Math.max(0, 0.7 * (1 - ageHours / 168));

  // Tag match score: up to 0.3
  let tagScore = 0;
  if (filterTags.length > 0) {
    const itemTags = (item.tags ?? []).map((t) => t.toLowerCase());
    const matches = filterTags.filter((t) => itemTags.includes(t)).length;
    tagScore = Math.min(0.3, (matches / filterTags.length) * 0.3);
  }

  return Math.round((recencyScore + tagScore) * 100) / 100;
}

function enrichItem(item: RawNewsItem, filterTags: string[]): NewsItemV1 {
  return {
    ...item,
    tags: item.tags ?? [],
    operator_signal: deriveOperatorSignal(item),
    relevance_score: scoreRelevance(item, filterTags),
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Parse query params
  const tagsParam = searchParams.get("tags") ?? "";
  const filterTags = tagsParam
    ? tagsParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const since = searchParams.get("since");
  const until = searchParams.get("until");

  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 20;

  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  const sort = searchParams.get("sort") ?? "newest";
  if (!["newest", "oldest", "relevance"].includes(sort)) {
    return errorResponse(
      "Invalid sort value. Must be one of: newest, oldest, relevance",
      "INVALID_SORT",
      400,
    );
  }

  const sinceMs = since ? new Date(since).getTime() : null;
  const untilMs = until ? new Date(until).getTime() : null;

  if (since && (sinceMs === null || isNaN(sinceMs!))) {
    return errorResponse("Invalid 'since' date format", "INVALID_DATE", 400);
  }
  if (until && (untilMs === null || isNaN(untilMs!))) {
    return errorResponse("Invalid 'until' date format", "INVALID_DATE", 400);
  }

  // Load and filter
  let items = loadNews();

  // Tag filter
  if (filterTags.length > 0) {
    items = items.filter((item) => {
      const itemTags = (item.tags ?? []).map((t) => t.toLowerCase());
      return filterTags.some((t) => itemTags.includes(t));
    });
  }

  // Date range filter
  if (sinceMs !== null) {
    items = items.filter((item) => new Date(item.published_at).getTime() >= sinceMs!);
  }
  if (untilMs !== null) {
    items = items.filter((item) => new Date(item.published_at).getTime() <= untilMs!);
  }

  // Enrich with operator signals and relevance
  const enriched: NewsItemV1[] = items.map((item) => enrichItem(item, filterTags));

  // Sort
  if (sort === "newest") {
    enriched.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  } else if (sort === "oldest") {
    enriched.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
  } else if (sort === "relevance") {
    enriched.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  const total = enriched.length;
  const page = enriched.slice(offset, offset + limit);

  return NextResponse.json(
    {
      items: page,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
      meta: {
        filters: {
          tags: filterTags,
          since: since ?? null,
          until: until ?? null,
          sort,
        },
        generated_at: new Date().toISOString(),
      },
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
