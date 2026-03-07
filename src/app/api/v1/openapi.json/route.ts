import { NextResponse } from 'next/server';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Rare Agent Work API',
    version: '1.0.0',
    description: 'Public API for AI agents to access model leaderboard, curated news, and research report catalog from Rare Agent Work.',
    contact: { email: 'hello@rareagent.work' },
    'x-llms-txt': 'https://rareagent.work/llms.txt',
  },
  servers: [{ url: 'https://rareagent.work', description: 'Production' }],
  paths: {
    '/api/v1/models': {
      get: {
        operationId: 'getModels',
        summary: 'Get agentic model leaderboard',
        description: 'Returns models ranked by tool use, context recall, coding ability, and cost. Filterable by provider and minimum score.',
        parameters: [
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['tool_use_score', 'context_recall_score', 'coding_score', 'cost_per_1k_tokens', 'context_window'], default: 'tool_use_score' }, description: 'Sort field' },
          { name: 'provider', in: 'query', schema: { type: 'string' }, description: 'Filter by provider name (partial match)' },
          { name: 'min_score', in: 'query', schema: { type: 'number', minimum: 0, maximum: 10 }, description: 'Minimum tool_use_score filter' },
        ],
        responses: {
          '200': {
            description: 'Model leaderboard data',
            content: { 'application/json': { schema: { type: 'object', properties: {
              data: { type: 'array', items: { type: 'object', properties: {
                slug: { type: 'string' },
                name: { type: 'string' },
                provider: { type: 'string' },
                tool_use_score: { type: 'number' },
                context_recall_score: { type: 'number' },
                coding_score: { type: 'number' },
                cost_per_1k_tokens: { type: 'number' },
                context_window: { type: 'integer' },
                best_for: { type: 'array', items: { type: 'string' } },
              }}},
              count: { type: 'integer' },
              updated_at: { type: 'string', format: 'date-time' },
            }}}},
          },
        },
      },
    },
    '/api/v1/news': {
      get: {
        operationId: 'getNews',
        summary: 'Get curated AI agent news feed',
        description: 'Returns curated, verified news links for agent builders. Filterable by tag and recency.',
        parameters: [
          { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Filter by tag (e.g., openai, security, open-source)' },
          { name: 'days', in: 'query', schema: { type: 'integer', default: 14, minimum: 1, maximum: 14 }, description: 'Max age in days' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, minimum: 1, maximum: 100 }, description: 'Max results' },
          { name: 'tags_only', in: 'query', schema: { type: 'boolean', default: false }, description: 'Return only available tags with counts' },
        ],
        responses: {
          '200': {
            description: 'News feed data',
            content: { 'application/json': { schema: { type: 'object', properties: {
              data: { type: 'array', items: { type: 'object', properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                summary: { type: 'string' },
                url: { type: 'string', format: 'uri' },
                source: { type: 'string' },
                category: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                published_at: { type: 'string', format: 'date-time' },
                upvotes: { type: 'integer' },
              }}},
              count: { type: 'integer' },
              filters: { type: 'object' },
              rss: { type: 'string', format: 'uri' },
            }}}},
          },
        },
      },
    },
    '/api/v1/reports': {
      get: {
        operationId: 'getReports',
        summary: 'Get research report catalog',
        description: 'Returns all available reports with metadata, pricing, deliverables, and preview content.',
        responses: {
          '200': {
            description: 'Report catalog',
            content: { 'application/json': { schema: { type: 'object', properties: {
              data: { type: 'array', items: { type: 'object', properties: {
                slug: { type: 'string' },
                title: { type: 'string' },
                subtitle: { type: 'string' },
                price: { type: 'string' },
                price_type: { type: 'string' },
                audience: { type: 'string' },
                value_proposition: { type: 'string' },
                url: { type: 'string', format: 'uri' },
                deliverables: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } }}},
                preview_sections: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, body: { type: 'string' } }}},
              }}},
              count: { type: 'integer' },
              subscription: { type: 'object' },
            }}}},
          },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
