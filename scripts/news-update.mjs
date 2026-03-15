import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "data", "pipeline", "news-sources.json");
const NEWS_PATH = path.join(ROOT, "data", "news", "news.json");
const SUMMARY_PATH = path.join(ROOT, "data", "news", "free-summary.json");
const RUN_LOG_PATH = path.join(ROOT, "data", "pipeline", "news-run-log.json");

const DAY = 24 * 60 * 60 * 1000;
const FreshnessDays = 14;

function stripHtml(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max = 280) {
  if (!value) return "";
  const clean = stripHtml(value);
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function collectHackerNews(query, label) {
  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", "50");
  const payload = await fetchJson(url);
  const hits = payload.hits ?? [];
  return hits.map((hit) => {
    const fallbackUrl = hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const published = hit.created_at ? new Date(hit.created_at).toISOString() : new Date().toISOString();
    const summary = hit.story_text || hit.comment_text || hit.title || hit.story_title || "";
    return {
      id: `hn:${hit.objectID}`,
      title: hit.title || hit.story_title || "(untitled story)",
      summary: truncate(summary || fallbackUrl),
      source_url: fallbackUrl,
      published_at: published,
      tags: ["hacker-news", label].filter(Boolean),
      source: "hackernews",
    };
  });
}

async function collectReddit(subreddit, label) {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=30`;
  const payload = await fetchJson(url, {
    headers: { "User-Agent": "RareAgentNewsBot/1.0 (+https://rareagent.work)" },
  });
  const items = payload?.data?.children ?? [];
  return items
    .map((child) => child?.data)
    .filter(Boolean)
    .map((post) => {
      const published = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString();
      const url = post.url_overridden_by_dest || post.url || `https://www.reddit.com${post.permalink ?? ""}`;
      const summarySource = post.selftext ?? post.title ?? "";
      return {
        id: `reddit:${post.id}`,
        title: post.title || "(untitled post)",
        summary: truncate(summarySource || url),
        source_url: url,
        published_at: published,
        tags: ["reddit", label].filter(Boolean),
        source: "reddit",
      };
    });
}

async function main() {
  const start = Date.now();
  const configRaw = await fs.readFile(CONFIG_PATH, "utf-8");
  const config = JSON.parse(configRaw);

  const collectors = [];
  const stats = { hn: 0, reddit: 0 };

  for (const q of config.hn_queries ?? []) {
    collectors.push(
      collectHackerNews(q.query, q.label)
        .then((items) => {
          stats.hn += items.length;
          return items;
        })
        .catch((err) => {
          console.error(`HN query \"${q.query}\" failed:`, err.message);
          return [];
        }),
    );
  }

  for (const stream of config.reddit_streams ?? []) {
    collectors.push(
      collectReddit(stream.subreddit, stream.label)
        .then((items) => {
          stats.reddit += items.length;
          return items;
        })
        .catch((err) => {
          console.error(`Reddit stream r/${stream.subreddit} failed:`, err.message);
          return [];
        }),
    );
  }

  const results = (await Promise.all(collectors)).flat();
  const cutoff = Date.now() - FreshnessDays * DAY;
  const seen = new Set();

  const normalized = results
    .filter((item) => {
      if (!item?.published_at || !item?.title || !item?.source_url) return false;
      const ts = Date.parse(item.published_at);
      return Number.isFinite(ts) && ts >= cutoff && ts <= Date.now();
    })
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    .filter((item) => {
      const key = (item.source_url || item.title).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, config.max_items ?? 40)
    .map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary || item.title,
      source_url: item.source_url,
      published_at: item.published_at,
      tags: item.tags ?? [],
    }));

  if (normalized.length === 0) {
    throw new Error("News ingest produced zero fresh items — aborting to avoid wiping cache.");
  }

  await fs.writeFile(NEWS_PATH, JSON.stringify(normalized, null, 2));

  const summary = {
    updated_at: new Date().toISOString(),
    items: normalized.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title,
      why_it_matters: item.summary,
      source_url: item.source_url,
      published_at: item.published_at,
    })),
  };

  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2));

  const durationMs = Date.now() - start;
  const runMeta = {
    updated_at: summary.updated_at,
    collected: results.length,
    kept: normalized.length,
    stats,
    duration_ms: durationMs,
  };
  await fs.writeFile(RUN_LOG_PATH, JSON.stringify(runMeta, null, 2));

  console.log(`news:update complete — collected=${results.length} kept=${normalized.length} duration=${durationMs}ms`);
}

main().catch((err) => {
  console.error("news:update failed", err);
  process.exitCode = 1;
});
