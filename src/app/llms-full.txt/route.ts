import { NextResponse } from 'next/server';
import { getAllReports } from '@/lib/reports';

export const revalidate = 3600;

export async function GET() {
  const reports = getAllReports();
  const now = new Date().toISOString().split('T')[0];

  const reportSections = reports.map(r => {
    const excerpts = r.excerpt.map(e => `### ${e.heading}\n${e.body}`).join('\n\n');
    const deliverables = r.deliverables.map(d => `- **${d.title}**: ${d.desc}`).join('\n');
    return `## ${r.title}
> ${r.subtitle}
> Audience: ${r.audience}
> Price: ${r.price} ${r.priceLabel}
> URL: https://rareagent.work/reports/${r.slug}

### What's Inside
${deliverables}

### Preview Content
${excerpts}
`;
  }).join('\n---\n\n');

  const content = `# Rare Agent Work — Full Content Index
> Updated: ${now}
> This is the extended version of llms.txt with full report previews.
> For the concise version, see: https://rareagent.work/llms.txt

${reportSections}

## API Reference

### GET /api/news
Returns curated AI agent news feed items.
Parameters: ?tag=<tag> (optional filter)
Response: { items: NewsItem[], count: number }
NewsItem: { id, title, summary, url, source, category, tags[], publishedAt, upvotes, clicks }

### GET /api/models
Returns model leaderboard data ranked for agentic use.
Parameters: ?sort=<field> (tool_use|context_recall|coding|cost) &order=<asc|desc>
Response: { models: Model[], count: number }
Model: { name, provider, slug, tool_use_score, context_recall_score, coding_score, cost_per_1k_tokens, context_window, best_for[] }

### GET /api/reports
Returns report catalog with metadata and deliverable descriptions.
Response: { reports: Report[] }
Report: { slug, title, subtitle, price, priceLabel, audience, valueprop, deliverables[], color }

### GET /api/digest
Returns the latest weekly digest.
Response: { week, summary, stories: Story[], categories: Record<string, Story[]> }
`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
