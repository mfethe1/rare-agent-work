import { NextResponse } from 'next/server';
import { getAllReports } from '@/lib/reports';

export const revalidate = 3600; // 1 hour

export async function GET() {
  const reports = getAllReports();
  const now = new Date().toISOString().split('T')[0];

  const content = `# Rare Agent Work
> Operator-grade AI agent research. Practical reports, model leaderboard, curated news feed.
> Updated: ${now}
> Source: https://rareagent.work

## About
Rare Agent Work publishes deeply researched, production-oriented reports on AI agent systems — covering low-code automation, multi-agent orchestration, and empirical evaluation methodology. Not tutorials. Not overviews. Operator playbooks with real implementation detail.

## Reports
${reports.map(r => `- [${r.title}](https://rareagent.work/reports/${r.slug}): ${r.subtitle}. ${r.audience}. ${r.price} ${r.priceLabel}.`).join('\n')}

## Data & Tools
- [Model Leaderboard](https://rareagent.work/models): LLMs ranked for agentic use — tool calling, context recall, coding ability, cost efficiency. Updated regularly.
- [AI Agent News Feed](https://rareagent.work/news): Curated daily, verified, max 14 days old. Top links for agent builders.
- [Weekly Digest](https://rareagent.work/digest): Executive summary of the week's most important AI agent developments.
- [Report History](https://rareagent.work/research/history): Every version archived.

## API Endpoints (JSON)
- [GET /api/news](https://rareagent.work/api/news): Curated AI agent news feed. Supports ?tag= filter.
- [GET /api/models](https://rareagent.work/api/models): Model leaderboard data. Supports ?sort= (tool_use, context_recall, coding, cost).
- [GET /api/reports](https://rareagent.work/api/reports): Report catalog metadata and preview content.
- [GET /api/digest](https://rareagent.work/api/digest): Latest weekly digest in structured format.

## MCP Integration
This site exposes an MCP-compatible tool server for AI agents:
- Endpoint: https://rareagent.work/api/mcp
- Capabilities: search_news, get_model_rankings, get_report_preview, get_digest

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
