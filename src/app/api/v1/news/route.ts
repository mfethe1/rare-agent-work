import { NextRequest, NextResponse } from 'next/server';
import { getAllNews, getNewsByTag, getAllTags } from '@/lib/news-store';

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag') || '';
  const days = parseInt(request.nextUrl.searchParams.get('days') || '14', 10);
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 100);
  const tagsOnly = request.nextUrl.searchParams.get('tags_only') === 'true';

  // Tags-only mode: return available tags with counts
  if (tagsOnly) {
    const allItems = await getAllNews();
    const tags = getAllTags(allItems);
    return NextResponse.json({
      tags,
      count: tags.length,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  let items = tag ? await getNewsByTag(tag) : await getAllNews();

  // Apply days filter
  if (days < 14) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    items = items.filter(item => item.publishedAt >= cutoff);
  }

  // Apply limit
  items = items.slice(0, limit);

  // Return clean agent-friendly format
  const data = items.map(item => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    source: item.source,
    category: item.category,
    tags: item.tags,
    published_at: item.publishedAt,
    upvotes: item.upvotes,
  }));

  return NextResponse.json({
    data,
    count: data.length,
    filters: { tag: tag || null, days, limit },
    updated_at: new Date().toISOString(),
    source: 'https://rareagent.work/news',
    rss: 'https://rareagent.work/feed.xml',
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
