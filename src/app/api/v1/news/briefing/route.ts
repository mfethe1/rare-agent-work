import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { CORS_HEADERS_GET } from "@/lib/api-headers";

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

const highRiskKeywords = [
  "security", "breach", "vulnerability", "outage", "shutdown", "ban",
  "lawsuit", "regulation", "compliance", "emergency", "critical", "exploit",
];
const mediumRiskKeywords = [
  "deprecation", "pricing change", "rate limit", "policy", "update",
  "breaking change", "migration", "sunset", "warning", "risk",
];

function deriveOperatorSignal(item: RawNewsItem): OperatorSignal {
  const tags = (item.tags ?? []).map((t) => t.toLowerCase());
  const combined = `${item.title.toLowerCase()} ${(item.summary ?? "").toLowerCase()}`;

  let riskLevel: OperatorSignal["risk_level"] = "low";
  let action_required = false;

  if (highRiskKeywords.some((kw) => combined.includes(kw))) {
    riskLevel = "high";
    action_required = true;
  } else if (mediumRiskKeywords.some((kw) => combined.includes(kw))) {
    riskLevel = "medium";
    action_required =
      tags.includes("agents") || tags.includes("openai") || tags.includes("anthropic");
  }

  return { action_required, risk_level: riskLevel };
}

function importanceScore(item: RawNewsItem): number {
  const signal = deriveOperatorSignal(item);
  const riskScore = signal.risk_level === "high" ? 3 : signal.risk_level === "medium" ? 2 : 1;
  const actionBonus = signal.action_required ? 1 : 0;

  const now = Date.now();
  const ageHours = (now - new Date(item.published_at).getTime()) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 1 - ageHours / 48);

  return riskScore + actionBonus + recencyScore * 2;
}

function deriveActionItems(item: RawNewsItem): string[] {
  const combined = `${item.title.toLowerCase()} ${(item.summary ?? "").toLowerCase()}`;
  const items: string[] = [];

  if (combined.includes("security") || combined.includes("vulnerability") || combined.includes("breach")) {
    items.push("Review your security posture immediately");
    items.push("Check if your systems are affected");
  }
  if (combined.includes("pricing") || combined.includes("pricing change")) {
    items.push("Review your budget allocations");
    items.push("Evaluate alternative providers if needed");
  }
  if (combined.includes("deprecation") || combined.includes("sunset") || combined.includes("breaking change")) {
    items.push("Audit your current integrations for compatibility");
    items.push("Plan migration timeline before deprecation date");
  }
  if (combined.includes("regulation") || combined.includes("compliance")) {
    items.push("Consult legal/compliance team");
    items.push("Document current compliance posture");
  }
  if (combined.includes("new model") || combined.includes("model release") || combined.includes("launched")) {
    items.push("Evaluate new model capabilities for your use case");
    items.push("Run benchmark comparisons against current models");
  }

  if (items.length === 0) {
    items.push("Monitor for further developments");
  }

  return items;
}

function extractTrends(items: RawNewsItem[]): string[] {
  const tagCounts: Record<string, number> = {};
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  // Get top tags as trends
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);
}

function generateExecutiveSummary(topItems: RawNewsItem[]): string {
  if (topItems.length === 0) {
    return "No significant AI developments in the last 48 hours. Monitor usual channels for updates.";
  }

  const highRisk = topItems.filter((i) => deriveOperatorSignal(i).risk_level === "high");
  const actionRequired = topItems.filter((i) => deriveOperatorSignal(i).action_required);

  const parts: string[] = [];

  if (highRisk.length > 0) {
    parts.push(
      `${highRisk.length} high-risk development${highRisk.length > 1 ? "s" : ""} require${highRisk.length === 1 ? "s" : ""} immediate attention.`,
    );
  }

  parts.push(
    `Top story: "${topItems[0].title.slice(0, 80)}${topItems[0].title.length > 80 ? "..." : ""}".`,
  );

  if (actionRequired.length > 0) {
    parts.push(
      `${actionRequired.length} item${actionRequired.length > 1 ? "s" : ""} flagged as action-required for AI operators.`,
    );
  } else {
    parts.push("No immediate actions required based on current signals.");
  }

  return parts.join(" ");
}

export async function GET() {
  const newsFile = path.join(process.cwd(), "data/news/news.json");

  let allNews: RawNewsItem[] = [];
  try {
    const raw = fs.readFileSync(newsFile, "utf-8");
    allNews = JSON.parse(raw) as RawNewsItem[];
  } catch {
    allNews = [];
  }

  // Filter to last 48 hours
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = allNews.filter(
    (item) => new Date(item.published_at).getTime() >= cutoff,
  );

  // Score and rank
  const ranked = [...recent].sort((a, b) => importanceScore(b) - importanceScore(a));
  const top5 = ranked.slice(0, 5);

  const top_stories = top5.map((item) => {
    const signal = deriveOperatorSignal(item);
    return {
      id: item.id,
      title: item.title,
      why_it_matters: item.summary
        ? item.summary.slice(0, 200)
        : "Significant development in the AI ecosystem.",
      action_items: deriveActionItems(item),
      risk_level: signal.risk_level,
    };
  });

  const trends = extractTrends(recent);
  const executive_summary = generateExecutiveSummary(top5);

  return NextResponse.json(
    {
      briefing_date: new Date().toISOString(),
      coverage_window: "48h",
      items_analyzed: recent.length,
      executive_summary,
      top_stories,
      trends,
      meta: {
        generated_at: new Date().toISOString(),
      },
    },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
