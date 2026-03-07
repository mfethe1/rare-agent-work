import fs from "node:fs";
import path from "node:path";

type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  published_at: string;
  tags?: string[];
};

type ModelItem = {
  model_name: string;
  provider: string;
  capabilities: string[];
  ranking_score: number;
  last_verified_at: string;
  source_urls: string[];
};

type ReportItem = {
  slug: string;
  title: string;
  status: "draft" | "pending_review" | "approved" | "published";
  updated_at: string;
  summary: string;
  content: string;
};

const ROOT = process.cwd();

function readJsonFile<T>(relativePath: string, fallback: T): T {
  const fullPath = path.join(ROOT, relativePath);
  try {
    const raw = fs.readFileSync(fullPath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getFreshNews(days = 14): NewsItem[] {
  const items = readJsonFile<NewsItem[]>("data/news/news.json", []);
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  return items
    .filter((item) => {
      const ts = new Date(item.published_at).getTime();
      if (!Number.isFinite(ts)) return false;
      // strict policy: not older than N days, and not future-dated
      return ts >= cutoff && ts <= now;
    })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
}

export function getFreeSummary(maxItems = 8) {
  const fresh = getFreshNews(14).slice(0, maxItems);
  return {
    updated_at: new Date().toISOString(),
    items: fresh.map((n) => ({
      id: n.id,
      title: n.title,
      why_it_matters: n.summary,
      source_url: n.source_url,
      published_at: n.published_at,
    })),
  };
}

export function getModels(): ModelItem[] {
  return readJsonFile<ModelItem[]>("data/models/models.json", []).sort(
    (a, b) => b.ranking_score - a.ranking_score,
  );
}

export function getReports(): ReportItem[] {
  return readJsonFile<ReportItem[]>("data/reports/reports.json", []);
}

export function getReportBySlug(slug: string): ReportItem | undefined {
  return getReports().find((r) => r.slug === slug);
}
