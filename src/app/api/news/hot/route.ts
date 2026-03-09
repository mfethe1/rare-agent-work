import { NextRequest, NextResponse } from 'next/server';
import { ingestNews } from '@/lib/news-store';

export const runtime = 'nodejs';

const FEEDS = [
  { url: 'https://openai.com/news/rss.xml', source: 'OpenAI', category: 'Model Releases', tags: ['openai', 'models'] },
  { url: 'https://www.anthropic.com/news/rss.xml', source: 'Anthropic', category: 'Model Releases', tags: ['anthropic', 'models'] },
  { url: 'https://blog.google/technology/ai/rss/', source: 'Google AI', category: 'AI Research', tags: ['google', 'ai'] },
  { url: 'https://huggingface.co/blog/feed.xml', source: 'Hugging Face', category: 'Open Source', tags: ['huggingface', 'open-source'] },
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', source: 'MIT Technology Review', category: 'Industry', tags: ['industry', 'analysis'] },
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ');
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getTag(block: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return regex.exec(block)?.[1] ?? '';
}

function getAtomLink(block: string) {
  const hrefMatch = /<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block);
  if (hrefMatch?.[1]) return hrefMatch[1];
  return getTag(block, 'link');
}

function extractEntries(xml: string) {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const atomMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  return itemMatches.length > 0 ? itemMatches : atomMatches;
}

function parseFeed(xml: string, feedMeta: (typeof FEEDS)[number]) {
  const entries = extractEntries(xml);

  return entries
    .map((entry) => {
      const rawTitle = getTag(entry, 'title');
      const rawLink = getTag(entry, 'link') || getAtomLink(entry);
      const rawDescription =
        getTag(entry, 'description') || getTag(entry, 'summary') || getTag(entry, 'content');
      const rawDate = getTag(entry, 'pubDate') || getTag(entry, 'updated') || getTag(entry, 'published');

      const title = normalizeWhitespace(decodeEntities(stripHtml(rawTitle)));
      const url = normalizeWhitespace(decodeEntities(rawLink));
      const summary = normalizeWhitespace(decodeEntities(stripHtml(rawDescription))).slice(0, 300);
      const publishedAt = new Date(rawDate || Date.now()).toISOString();

      if (!title || !url) return null;

      return {
        title,
        summary: summary || `Latest update from ${feedMeta.source}`,
        url,
        source: feedMeta.source,
        category: feedMeta.category,
        tags: feedMeta.tags,
        publishedAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function POST(request: NextRequest) {
  const expectedKey = process.env.HOT_NEWS_API_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: 'HOT_NEWS_API_KEY not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allItems: Awaited<ReturnType<typeof ingestNews>>[] = [];
  let totalParsed = 0;

  for (const feed of FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': 'RareAgentWorkBot/1.0 (+https://rareagent.work)' },
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        continue;
      }

      const xml = await response.text();
      const parsed = parseFeed(xml, feed);
      totalParsed += parsed.length;

      if (parsed.length > 0) {
        const result = await ingestNews(parsed);
        allItems.push(result);
      }
    } catch {
      // Skip any feed errors and continue processing the rest
    }
  }

  const summary = allItems.reduce(
    (acc, item) => {
      acc.added += item.added;
      acc.duplicates += item.duplicates;
      return acc;
    },
    { added: 0, duplicates: 0 }
  );

  return NextResponse.json({
    ok: true,
    feeds: FEEDS.length,
    parsed: totalParsed,
    added: summary.added,
    duplicates: summary.duplicates,
  });
}
