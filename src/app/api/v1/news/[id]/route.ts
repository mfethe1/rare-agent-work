import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Remaining": "100",
};

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

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

function deriveOperatorSignal(item: RawNewsItem) {
  const combined = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  const highRiskKeywords = [
    "security", "breach", "vulnerability", "outage", "shutdown", "ban",
    "lawsuit", "regulation", "compliance", "emergency", "critical",
  ];
  const mediumRiskKeywords = [
    "deprecation", "pricing change", "rate limit", "policy", "breaking change",
    "migration", "sunset", "warning",
  ];

  if (highRiskKeywords.some((kw) => combined.includes(kw))) {
    return { action_required: true, risk_level: "high" as const };
  }
  if (mediumRiskKeywords.some((kw) => combined.includes(kw))) {
    return { action_required: false, risk_level: "medium" as const };
  }
  return { action_required: false, risk_level: "low" as const };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return errorResponse("News ID is required", "MISSING_ID", 400);
  }

  const news = loadNews();
  // IDs may contain colons (e.g. "reddit:1rr1h42") — decode URI component for safety
  const decodedId = decodeURIComponent(id);
  const item = news.find((n) => n.id === decodedId);

  if (!item) {
    return errorResponse(`News item '${decodedId}' not found`, "NOT_FOUND", 404);
  }

  const enriched = {
    ...item,
    tags: item.tags ?? [],
    operator_signal: deriveOperatorSignal(item),
  };

  return NextResponse.json(enriched, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
