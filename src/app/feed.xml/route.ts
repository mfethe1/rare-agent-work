import { getAllNews } from '@/lib/news-store';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const items = await getAllNews();
  const top50 = items.slice(0, 50);

  const rssItems = top50.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <description>${escapeXml(item.summary)}</description>
      <source url="${escapeXml(item.url)}">${escapeXml(item.source)}</source>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
      <guid isPermaLink="false">${item.id}</guid>
      ${(item.tags || []).map(t => `<category>${escapeXml(t)}</category>`).join('\n      ')}
    </item>`).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Rare Agent Work — AI Agent News</title>
    <link>https://rareagent.work/news</link>
    <description>Curated daily links for AI agent builders. Verified, max 14 days old.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://rareagent.work/feed.xml" rel="self" type="application/rss+xml"/>
    <ttl>60</ttl>
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
