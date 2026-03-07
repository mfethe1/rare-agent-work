import { NextResponse } from 'next/server';
import { getAllNews, getAllTags } from '@/lib/news-store';

export const revalidate = 3600;

export async function GET() {
  const items = await getAllNews();

  // Build week range
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekStr = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Get top categories
  const categories: Record<string, typeof items> = {};
  for (const item of items) {
    const cat = item.category || 'uncategorized';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  // Top themes from tags
  const tags = getAllTags(items);
  const themes = tags.slice(0, 5).map(t => t.tag);

  // Build summary
  const catNames = Object.keys(categories).slice(0, 3).join(', ');
  const summary = `This week saw ${items.length} notable developments in the AI agent space. Key themes include ${catNames}.${items.length > 0 ? ` The most upvoted story was "${items[0].title}".` : ''}`;

  const stories = items.map(item => ({
    title: item.title,
    url: item.url,
    source: item.source,
    summary: item.summary,
    category: item.category,
    tags: item.tags,
    publishedAt: item.publishedAt,
    upvotes: item.upvotes,
  }));

  return NextResponse.json(
    {
      week: weekStr,
      summary,
      storyCount: items.length,
      themes,
      stories,
      categories: Object.fromEntries(
        Object.entries(categories).map(([cat, catItems]) => [
          cat,
          catItems.map(i => ({ title: i.title, url: i.url, source: i.source })),
        ])
      ),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
