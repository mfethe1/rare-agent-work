import { NextResponse } from 'next/server';

export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Rare Agent Work API',
      version: '1.0.0',
      description:
        'Public API for AI agent research data — model leaderboard, curated news, report catalog, and weekly digest.',
      contact: { email: 'hello@rareagent.work' },
    },
    servers: [{ url: 'https://rareagent.work' }],
    paths: {
      '/api/news': {
        get: {
          operationId: 'searchNews',
          summary: 'Get curated AI agent news feed',
          description:
            'Returns curated, verified AI agent news items. Max 14 days old. Ranked by upvotes and recency.',
          parameters: [
            {
              name: 'tag',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Filter by tag (e.g., openai, langchain, security)',
            },
          ],
          responses: {
            '200': {
              description: 'News items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            summary: { type: 'string' },
                            url: { type: 'string', format: 'uri' },
                            source: { type: 'string' },
                            category: { type: 'string' },
                            tags: { type: 'array', items: { type: 'string' } },
                            publishedAt: { type: 'string', format: 'date-time' },
                            upvotes: { type: 'integer' },
                          },
                        },
                      },
                      count: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/models': {
        get: {
          operationId: 'getModelRankings',
          summary: 'Get agentic model leaderboard',
          description:
            'Returns LLMs ranked for agentic use: tool calling, context recall, coding ability, and cost efficiency.',
          parameters: [
            {
              name: 'sort',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['tool_use', 'context_recall', 'coding', 'cost'],
              },
              description: 'Sort field (default: tool_use)',
            },
            {
              name: 'order',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['asc', 'desc'] },
              description: 'Sort order (default: desc)',
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 50 },
              description: 'Max results to return',
            },
          ],
          responses: {
            '200': {
              description: 'Model rankings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      models: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            slug: { type: 'string' },
                            provider: { type: 'string' },
                            tool_use_score: { type: 'number' },
                            context_recall_score: { type: 'number' },
                            coding_score: { type: 'number' },
                            cost_per_1k_tokens: { type: 'number' },
                            context_window: { type: 'integer' },
                            best_for: { type: 'array', items: { type: 'string' } },
                          },
                        },
                      },
                      count: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/reports': {
        get: {
          operationId: 'getReportCatalog',
          summary: 'Get report catalog',
          description:
            'Returns all available operator-grade reports with metadata, pricing, and deliverable descriptions.',
          responses: {
            '200': {
              description: 'Report catalog',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      reports: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            slug: { type: 'string' },
                            title: { type: 'string' },
                            subtitle: { type: 'string' },
                            price: { type: 'string' },
                            priceLabel: { type: 'string' },
                            audience: { type: 'string' },
                            valueprop: { type: 'string' },
                            deliverables: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  icon: { type: 'string' },
                                  title: { type: 'string' },
                                  desc: { type: 'string' },
                                },
                              },
                            },
                            color: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/digest': {
        get: {
          operationId: 'getWeeklyDigest',
          summary: 'Get latest weekly AI agent digest',
          description:
            "Returns the current week's executive summary of AI agent developments with categorized stories.",
          responses: {
            '200': {
              description: 'Weekly digest',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      week: { type: 'string' },
                      summary: { type: 'string' },
                      storyCount: { type: 'integer' },
                      themes: { type: 'array', items: { type: 'string' } },
                      stories: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            url: { type: 'string', format: 'uri' },
                            source: { type: 'string' },
                            summary: { type: 'string' },
                            tags: { type: 'array', items: { type: 'string' } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
