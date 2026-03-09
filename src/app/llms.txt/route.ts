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
- [GET /ask?q=your question](https://rareagent.work/ask): Ask anything about news, reports, implementation, or the digest in natural language. Returns structured JSON with answer + citations.
- Examples: /ask?q=which model is best for tool use, /ask?q=latest security news, /ask?q=what reports do you offer

## API Endpoints (JSON)
- [GET /api/news](https://rareagent.work/api/news): Curated AI agent news feed. Supports ?tag= filter.
- [GET /api/reports](https://rareagent.work/api/reports): Report catalog metadata and preview content.
- [GET /api/digest](https://rareagent.work/api/digest): Latest weekly digest in structured format.
- [GET /api/openapi.json](https://rareagent.work/api/openapi.json): Full OpenAPI 3.1 specification.
- [GET /feed.xml](https://rareagent.work/feed.xml): RSS feed of curated AI agent news.

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
