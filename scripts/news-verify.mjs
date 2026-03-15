import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, "data", "news", "news.json");
const SUMMARY_PATH = path.join(ROOT, "data", "news", "free-summary.json");

const DAY = 24 * 60 * 60 * 1000;
const FreshnessDays = 14;

function ensure(condition, message, failures) {
  if (!condition) failures.push(message);
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function main() {
  const failures = [];
  const news = loadJson(NEWS_PATH);
  ensure(Array.isArray(news), "news.json must be an array", failures);
  ensure(news.length >= 8, "news.json must contain at least 8 items", failures);

  const now = Date.now();
  const cutoff = now - FreshnessDays * DAY;

  let prevTimestamp = Infinity;
  news.forEach((item, idx) => {
    ensure(Boolean(item.id), `item[${idx}] missing id`, failures);
    ensure(Boolean(item.title), `item[${idx}] missing title`, failures);
    ensure(Boolean(item.summary), `item[${idx}] missing summary`, failures);
    ensure(Boolean(item.source_url), `item[${idx}] missing source_url`, failures);
    ensure(Boolean(item.published_at), `item[${idx}] missing published_at`, failures);
    const ts = Date.parse(item.published_at ?? "");
    ensure(Number.isFinite(ts), `item[${idx}] has invalid published_at`, failures);
    ensure(ts >= cutoff, `item[${idx}] is older than ${FreshnessDays} days`, failures);
    ensure(ts <= now, `item[${idx}] has future timestamp`, failures);
    ensure(ts <= prevTimestamp, `item[${idx}] is not sorted newest->oldest`, failures);
    prevTimestamp = ts;
  });

  const summary = loadJson(SUMMARY_PATH);
  ensure(Array.isArray(summary.items), "free-summary.json must include items[]", failures);
  ensure(summary.items.length > 0, "free-summary.json must include at least 1 item", failures);
  ensure(summary.items.length <= 8, "free-summary items should not exceed 8", failures);

  if (failures.length > 0) {
    console.error("news:verify failed:\n" + failures.map((msg) => ` - ${msg}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(`news:verify OK — ${news.length} items, summary ${summary.items.length} items`);
}

main();
