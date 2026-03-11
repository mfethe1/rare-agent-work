import { NextResponse } from 'next/server';
import { getAllReports } from '@/lib/reports';

export const revalidate = 3600; // 1 hour

export async function GET() {
  const reports = getAllReports();
  const now = new Date().toISOString().split('T')[0];

  const content = `# Rare Agent Work
> Operator-grade AI agent research. Practical reports, curated news feed, and implementation guidance.
> Updated: ${now}
> Source: https://rareagent.work

## About
Rare Agent Work publishes deeply researched, production-oriented reports on AI agent systems — covering low-code automation, multi-agent orchestration, and empirical evaluation methodology. Not tutorials. Not overviews. Operator playbooks with real implementation detail.

## Reports
${reports.map(r => `- [${r.title}](https://rareagent.work/reports/${r.slug}): ${r.subtitle}. ${r.audience}. ${r.price} ${r.priceLabel}.`).join('\n')}

## Data & Tools
- [Model index status](https://rareagent.work/models): Temporarily offline while evaluation methodology and refresh cadence are rebuilt.
- [AI Agent News Feed](https://rareagent.work/news): Curated daily, verified, max 14 days old. Top links for agent builders.
- [Weekly Digest](https://rareagent.work/digest): Executive summary of the week's most important AI agent developments.
- [Report History](https://rareagent.work/research/history): Every version archived.

## Natural Language Query (NLWeb)
- [GET /api/v1/ask?q=your question](https://rareagent.work/api/v1/ask?q=which%20report%20should%20I%20read%20first): Ask anything about news, reports, and implementation guidance in natural language. Returns structured JSON with answer + citations.
- Examples: /api/v1/ask?q=which model is best for tool use, /api/v1/ask?q=latest security news, /api/v1/ask?q=what reports do you offer

## API Endpoints (JSON)
- [GET /api/v1/news](https://rareagent.work/api/v1/news): Curated AI agent news feed. Supports ?tag=, ?days=, and ?limit= filters.
- [GET /api/v1/reports](https://rareagent.work/api/v1/reports): Report catalog metadata and preview content.
- [GET /api/v1/models](https://rareagent.work/api/v1/models): Public model index response with methodology caveats while refresh cadence is rebuilt.
- [GET /api/v1/openapi.json](https://rareagent.work/api/v1/openapi.json): Full OpenAPI 3.1 specification.
- [GET /feed.xml](https://rareagent.work/feed.xml): RSS feed of curated AI agent news.

## Agent Discovery
- A2A agent card: \`/.well-known/agent-card.json\`
- Legacy agent manifest: \`/.well-known/agent.json\`
- OpenAPI spec: \`/api/v1/openapi.json\`
- Sitemap: \`/sitemap.xml\`
- RSS: \`/feed.xml\`

## Topics Covered
- AI agent frameworks (CrewAI, LangGraph, AutoGen, OpenAI Swarm)
- Low-code automation platforms (Zapier, Make, n8n, Relevance AI)
- Multi-agent orchestration patterns
- Agent evaluation methodology and benchmarks
- Production deployment and governance
- Memory architecture for agents
- Model selection for agentic workloads

## Contact
- Website: https://rareagent.work
- Email: hello@rareagent.work
`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
