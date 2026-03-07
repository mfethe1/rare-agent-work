import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const newsPath = path.join(root, "data/news/news.json");
const summaryPath = path.join(root, "data/news/free-summary.json");

const raw = JSON.parse(fs.readFileSync(newsPath, "utf-8"));
const now = Date.now();
const cutoff = now - 14 * 24 * 60 * 60 * 1000;

const rejected = [];
const fresh = raw
  .filter((x) => {
    const ts = new Date(x.published_at).getTime();
    const ok = Number.isFinite(ts) && ts >= cutoff && ts <= now;
    if (!ok) {
      rejected.push({ id: x.id, published_at: x.published_at, reason: "outside_14d_or_invalid_date" });
    }
    return ok;
  })
  .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

const summary = {
  updated_at: new Date().toISOString(),
  items: fresh.slice(0, 8).map((n) => ({
    id: n.id,
    title: n.title,
    why_it_matters: n.summary,
    source_url: n.source_url,
    published_at: n.published_at,
  })),
};

fs.writeFileSync(newsPath, JSON.stringify(fresh, null, 2));
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(root, "data/pipeline/news-rejections.json"), JSON.stringify(rejected, null, 2));

console.log(`fresh_news_count=${fresh.length}`);
console.log(`rejected_news_count=${rejected.length}`);
