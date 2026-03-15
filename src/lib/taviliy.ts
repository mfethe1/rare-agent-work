import fs from "node:fs";
import path from "node:path";

const TVLY_API_KEY = process.env.TVLY_API_KEY;
const TVLY_API_BASE = process.env.TVLY_API_BASE ?? "https://api.taviliy.com/v1";
const CACHE_PATH = path.join(process.cwd(), "data", "research", "taviliy-benchmarks.json");

export type TaviliyResult = {
  id: string;
  title: string;
  summary: string;
  url: string;
  published_at: string;
  tags?: string[];
};

export type TaviliySearch = {
  query: string;
  results: TaviliyResult[];
  fetched_at: string;
};

export async function searchTaviliy(query: string, params: Record<string, string> = {}): Promise<TaviliySearch> {
  if (!TVLY_API_KEY) {
    throw new Error("TVLY_API_KEY is not configured; load it from shared_variables/search.env");
  }

  const url = new URL(`${TVLY_API_BASE}/search`);
  url.searchParams.set("q", query);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TVLY_API_KEY}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Taviliy request failed (${res.status}): ${text}`);
  }

  const payload = await res.json();
  return {
    query,
    results: payload.results ?? [],
    fetched_at: new Date().toISOString(),
  };
}

export function readBenchmarkSeeds() {
  const raw = fs.readFileSync(CACHE_PATH, "utf-8");
  return JSON.parse(raw) as Array<{
    query: string;
    raw_score: number | null;
    improved_score: number | null;
    delta: number | null;
    agents_used: string[];
    status: string;
  }>;
}
