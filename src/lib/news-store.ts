/**
 * File-based news store — works without Supabase.
 * Data is stored in /data/news.json at the project root.
 * On Railway, this lives in the container's ephemeral filesystem.
 * For persistence, migrate to Supabase or an external DB.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  tags: string[];
  publishedAt: string;
  upvotes: number;
  clicks: number;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const SUMMARY_FILE = path.join(DATA_DIR, 'news-summary.json');
const MAX_AGE_DAYS = 14;

export async function getNewsSummary(): Promise<{ summary: string; updatedAt: string } | null> {
  try {
    const raw = await readFile(SUMMARY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function getAllNews(): Promise<NewsItem[]> {
  try {
    const raw = await readFile(NEWS_FILE, 'utf-8');
    const items: NewsItem[] = JSON.parse(raw);
    const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString();
    return items
      .filter((item) => item.publishedAt >= cutoff)
      .sort((a, b) => {
        // Score: upvotes + recency bonus
        const ageA = (Date.now() - new Date(a.publishedAt).getTime()) / 3600000;
        const ageB = (Date.now() - new Date(b.publishedAt).getTime()) / 3600000;
        const scoreA = (a.upvotes + 1) / Math.pow(ageA + 2, 1.5);
        const scoreB = (b.upvotes + 1) / Math.pow(ageB + 2, 1.5);
        return scoreB - scoreA;
      });
  } catch {
    return [];
  }
}

export async function getNewsByTag(tag: string): Promise<NewsItem[]> {
  const all = await getAllNews();
  return all.filter((item) => (item.tags || []).includes(tag));
}

export async function ingestNews(
  items: Array<{
    title: string;
    summary: string;
    url: string;
    source: string;
    category: string;
    tags: string[];
    publishedAt: string;
  }>
): Promise<{ added: number; duplicates: number }> {
  await ensureDir();
  const existing = await getAllNews();
  const urlSet = new Set(existing.map((e) => e.url));
  let added = 0;
  let duplicates = 0;

  for (const item of items) {
    if (urlSet.has(item.url)) {
      duplicates++;
      continue;
    }
    existing.push({
      ...item,
      id: crypto.randomUUID(),
      upvotes: 0,
      clicks: 0,
      createdAt: new Date().toISOString(),
    });
    urlSet.add(item.url);
    added++;
  }

  await writeFile(NEWS_FILE, JSON.stringify(existing, null, 2));
  return { added, duplicates };
}

export async function upvoteNews(id: string): Promise<boolean> {
  await ensureDir();
  let items: NewsItem[];
  try {
    items = JSON.parse(await readFile(NEWS_FILE, 'utf-8'));
  } catch {
    return false;
  }
  const item = items.find((i) => i.id === id);
  if (!item) return false;
  item.upvotes++;
  await writeFile(NEWS_FILE, JSON.stringify(items, null, 2));
  return true;
}

export async function clickNews(id: string): Promise<boolean> {
  await ensureDir();
  let items: NewsItem[];
  try {
    items = JSON.parse(await readFile(NEWS_FILE, 'utf-8'));
  } catch {
    return false;
  }
  const item = items.find((i) => i.id === id);
  if (!item) return false;
  item.clicks++;
  await writeFile(NEWS_FILE, JSON.stringify(items, null, 2));
  return true;
}

export function getAllTags(items: NewsItem[]): Array<{ tag: string; count: number }> {
  const tagMap = new Map<string, number>();
  for (const item of items) {
    for (const tag of (item.tags || [])) {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    }
  }
  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
