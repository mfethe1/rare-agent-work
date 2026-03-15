#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, "data/news/news.json");
const SUMMARY_PATH = path.join(ROOT, "data/news/free-summary.json");
const REGISTRY_PATH = path.join(ROOT, "data/pipeline/source-registry.json");

const DAYS_TO_KEEP = Number(process.env.NEWS_MAX_DAYS ?? 14);
const SUMMARY_LIMIT = Number(process.env.NEWS_SUMMARY_LIMIT ?? 8);
const MAX_REDDIT_ITEMS = Number(process.env.NEWS_REDDIT_LIMIT ?? 12);
const MAX_HN_ITEMS_PER_QUERY = Number(process.env.NEWS_HN_LIMIT ?? 4);
const MAX_SUMMARY_LENGTH = Number(process.env.NEWS_SUMMARY_CHARS ?? 320);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function truncate(str, max = MAX_SUMMARY_LENGTH) {
  if (!str) return "";
  const clean = str.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function normalizeItem(raw) {
  if (!raw) return null;
  const id = raw.id ?? raw.source_url;
  if (!id) return null;
  const publishedMs = Date.parse(raw.published_at ?? "");
  const published_at = Number.isFinite(publishedMs) ? new Date(publishedMs).toISOString() : new Date().toISOString();
  return {
    id,
    title: raw.title?.trim() || "Untitled story",
    summary: truncate(raw.summary || raw.title || ""),
    source_url: raw.source_url,
    published_at,
    tags: raw.tags ?? [],
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "rareagent-news-refresh/1.0 (+https://rareagent.work)",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}) ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchReddit(subreddits = [], sort = "new") {
  const collected = [];
  for (const subreddit of subreddits) {
    const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${MAX_REDDIT_ITEMS}`;
    try {
      const payload = await fetchJson(url);
      const children = payload?.data?.children ?? [];
      for (const child of children) {
        const data = child?.data;
        if (!data || data.stickied) continue;
        const published = data.created_utc ? new Date(data.created_utc * 1000).toISOString() : new Date().toISOString();
        const permalink = data.permalink ? `https://www.reddit.com${data.permalink}` : undefined;
        const sourceUrl = permalink ?? data.url_overridden_by_dest ?? data.url ?? "";
        collected.push({
          id: `reddit-${data.id}`,
          title: data.title,
          summary: data.selftext?.trim() || data.title,
          source_url: sourceUrl,
          published_at: published,
          tags: ["reddit", subreddit],
        });
      }
    } catch (err) {
      console.warn(`[warn] reddit fetch failed for r/${subreddit}: ${err.message}`);
    }
  }
  return collected;
}

async function fetchHackerNews(queries = []) {
  const collected = [];
  if (queries.length === 0) return collected;
  const cutoffUnix = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  for (const query of queries) {
    const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
    url.searchParams.set("query", query);
    url.searchParams.set("tags", "story");
    url.searchParams.set("hitsPerPage", String(MAX_HN_ITEMS_PER_QUERY));
    url.searchParams.set("numericFilters", `created_at_i>${cutoffUnix}`);
    try {
      const payload = await fetchJson(url.toString());
      const hits = payload?.hits ?? [];
      for (const hit of hits) {
        const published = hit.created_at ? new Date(hit.created_at).toISOString() : new Date().toISOString();
        const sourceUrl = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
        collected.push({
          id: `hn-${hit.objectID}`,
          title: hit.title ?? hit.story_title ?? "Hacker News story",
          summary: hit.story_text ?? hit.title ?? "",
          source_url: sourceUrl,
          published_at: published,
          tags: ["hackernews", query.toLowerCase()],
        });
      }
    } catch (err) {
      console.warn(`[warn] hacker news fetch failed for query "${query}": ${err.message}`);
    }
  }
  return collected;
}

async function gatherSources(registry) {
  const tasks = [];
  if (registry?.social?.reddit?.enabled) {
    tasks.push(fetchReddit(registry.social.reddit.subreddits ?? [], registry.social.reddit.sort ?? "new"));
  }
  if (registry?.social?.x?.enabled) {
    // Reuse the configured queries for Hacker News coverage (public JSON API, no auth).
    tasks.push(fetchHackerNews(registry.social.x.queries ?? []));
  }

  const results = await Promise.all(tasks);
  return results.flat();
}

async function main() {
  const registry = readJson(REGISTRY_PATH, {});
  const existing = readJson(NEWS_PATH, []);
  const fetched = await gatherSources(registry);

  const merged = new Map();
  [...existing, ...fetched].forEach((item) => {
    const normalized = normalizeItem(item);
    if (!normalized?.source_url) return;
    merged.set(normalized.id, normalized);
  });

  const cutoff = Date.now() - DAYS_TO_KEEP * 24 * 60 * 60 * 1000;
  const fresh = Array.from(merged.values())
    .filter((item) => Date.parse(item.published_at) >= cutoff)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));

  writeJson(NEWS_PATH, fresh);

  const summary = {
    updated_at: new Date().toISOString(),
    items: fresh.slice(0, SUMMARY_LIMIT).map((item) => ({
      id: item.id,
      title: item.title,
      why_it_matters: truncate(item.summary ?? item.title ?? ""),
      source_url: item.source_url,
      published_at: item.published_at,
    })),
  };
  writeJson(SUMMARY_PATH, summary);

  console.log(`news_refresh=fresh_count:${fresh.length} fetched_now:${fetched.length}`);
  console.log(`summary_updated_at=${summary.updated_at}`);
}

main().catch((err) => {
  console.error("news refresh failed", err);
  process.exit(1);
});
