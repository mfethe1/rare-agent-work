import { NextRequest, NextResponse } from 'next/server';
import { getAllNews } from '@/lib/news-store';
import { getAllReports } from '@/lib/reports';

/**
 * NLWeb-compatible /ask endpoint.
 *
 * Accepts natural-language queries and returns Schema.org-typed JSON results
 * drawn from the site's news feed, model leaderboard, and report catalog.
 *
 * Protocol reference: https://github.com/nlweb-ai/NLWeb/blob/main/docs/nlweb-rest-api.md
 *
 * Supports GET (query params) and POST (JSON body).
 * Required: query (string)
 * Optional: mode (list|summarize), site (news|models|reports), limit (number), prev (string)
 */

// Seed models (same as /api/v1/models)
const SEED_MODELS = [
  { slug: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', tool_use_score: 9.7, context_recall_score: 9.5, coding_score: 9.3, cost_per_1k_tokens: 0.075, context_window: 200000, best_for: ['complex-agents', 'architecture', 'high-stakes'] },
  { slug: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', tool_use_score: 9.4, context_recall_score: 9.1, coding_score: 8.9, cost_per_1k_tokens: 0.015, context_window: 200000, best_for: ['orchestration', 'reasoning', 'long-context'] },
  { slug: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tool_use_score: 9.2, context_recall_score: 8.7, coding_score: 9.0, cost_per_1k_tokens: 0.01, context_window: 128000, best_for: ['multimodal', 'general', 'coding'] },
  { slug: 'gemini-2-0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', tool_use_score: 8.5, context_recall_score: 8.8, coding_score: 8.3, cost_per_1k_tokens: 0.001, context_window: 1000000, best_for: ['long-context', 'budget', 'speed'] },
  { slug: 'mistral-large-2', name: 'Mistral Large 2', provider: 'Mistral', tool_use_score: 8.4, context_recall_score: 8.0, coding_score: 8.5, cost_per_1k_tokens: 0.006, context_window: 128000, best_for: ['european-data', 'function-calling', 'balance'] },
  { slug: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', tool_use_score: 8.3, context_recall_score: 8.2, coding_score: 9.1, cost_per_1k_tokens: 0.0008, context_window: 128000, best_for: ['coding', 'math', 'budget'] },
  { slug: 'llama-3-3-70b', name: 'Llama 3.3 70B', provider: 'Meta (Open)', tool_use_score: 8.1, context_recall_score: 7.9, coding_score: 8.4, cost_per_1k_tokens: 0.0009, context_window: 128000, best_for: ['open-source', 'self-hosted', 'cost'] },
  { slug: 'qwen-2-5-72b', name: 'Qwen 2.5 72B', provider: 'Alibaba (Open)', tool_use_score: 8.0, context_recall_score: 8.1, coding_score: 8.6, cost_per_1k_tokens: 0.0004, context_window: 128000, best_for: ['open-source', 'multilingual', 'coding'] },
];

interface ScoredItem {
  score: number;
  name: string;
  url: string;
  site: string;
  description: string;
  schema_object: Record<string, unknown>;
}

function normalizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function scoreText(text: string, queryWords: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (lower.includes(word)) score += 1;
  }
  return score;
}

async function searchNews(queryWords: string[], limit: number): Promise<ScoredItem[]> {
  const items = await getAllNews();
  return items
    .map((item) => {
      const textScore =
        scoreText(item.title, queryWords) * 3 +
        scoreText(item.summary, queryWords) * 2 +
        scoreText(item.tags.join(' '), queryWords) * 2 +
        scoreText(item.source, queryWords);
      return {
        score: textScore,
        name: item.title,
        url: item.url,
        site: 'rareagent.work/news',
        description: item.summary,
        schema_object: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: item.title,
          description: item.summary,
          url: item.url,
          publisher: { '@type': 'Organization', name: item.source },
          datePublished: item.publishedAt,
          keywords: item.tags,
        },
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function searchModels(queryWords: string[], limit: number): ScoredItem[] {
  return SEED_MODELS.map((model) => {
    const textScore =
      scoreText(model.name, queryWords) * 3 +
      scoreText(model.provider, queryWords) * 2 +
      scoreText(model.best_for.join(' '), queryWords) * 3;
    return {
      score: textScore,
      name: model.name,
      url: `https://rareagent.work/models#${model.slug}`,
      site: 'rareagent.work/models',
      description: `${model.name} by ${model.provider} — Tool Use: ${model.tool_use_score}, Coding: ${model.coding_score}, Context: ${model.context_window.toLocaleString()} tokens, Cost: $${model.cost_per_1k_tokens}/1k. Best for: ${model.best_for.join(', ')}.`,
      schema_object: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: model.name,
        applicationCategory: 'AI Model',
        offers: {
          '@type': 'Offer',
          price: model.cost_per_1k_tokens,
          priceCurrency: 'USD',
          description: 'per 1k tokens',
        },
        provider: model.provider,
        tool_use_score: model.tool_use_score,
        context_recall_score: model.context_recall_score,
        coding_score: model.coding_score,
        context_window: model.context_window,
        best_for: model.best_for,
      },
    };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function searchReports(queryWords: string[], limit: number): ScoredItem[] {
  const allReports = getAllReports();
  return allReports
    .map((report) => {
      const excerptText = report.excerpt.map((e) => `${e.heading} ${e.body}`).join(' ');
      const deliverableText = report.deliverables.map((d) => `${d.title} ${d.desc}`).join(' ');
      const textScore =
        scoreText(report.title, queryWords) * 4 +
        scoreText(report.subtitle, queryWords) * 3 +
        scoreText(report.audience, queryWords) * 2 +
        scoreText(excerptText, queryWords) * 1 +
        scoreText(deliverableText, queryWords) * 1;
      return {
        score: textScore,
        name: report.title,
        url: `https://rareagent.work/reports/${report.slug}`,
        site: 'rareagent.work/reports',
        description: `${report.subtitle}. ${report.audience}. ${report.price} ${report.priceLabel}.`,
        schema_object: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: report.title,
          description: report.subtitle,
          url: `https://rareagent.work/reports/${report.slug}`,
          offers: {
            '@type': 'Offer',
            price: report.price.replace('$', ''),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
          audience: {
            '@type': 'Audience',
            audienceType: report.audience,
          },
          deliverables: report.deliverables.map((d) => d.title),
        },
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// If query doesn't match specific keywords, also check for "best model" patterns
function detectModelQuery(query: string): boolean {
  const modelPatterns = [
    /best\s+model/i,
    /which\s+model/i,
    /recommend.*model/i,
    /model.*for\s+/i,
    /tool\s*use/i,
    /coding\s*(model|score|ability)/i,
    /cheapest/i,
    /budget.*model/i,
    /context\s*window/i,
    /leaderboard/i,
  ];
  return modelPatterns.some((p) => p.test(query));
}

function detectNewsQuery(query: string): boolean {
  const newsPatterns = [
    /news/i,
    /latest/i,
    /recent/i,
    /what.*happened/i,
    /this\s+week/i,
    /today/i,
    /announcement/i,
    /released?/i,
    /launched?/i,
    /update/i,
  ];
  return newsPatterns.some((p) => p.test(query));
}

function generateQueryId(): string {
  return `nlweb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function handleAsk(params: {
  query: string;
  mode: string;
  site: string;
  limit: number;
  queryId: string;
}) {
  const { query, mode, site, limit, queryId } = params;
  const queryWords = normalizeQuery(query);

  if (queryWords.length === 0) {
    return NextResponse.json(
      { error: 'Query is empty or too short. Provide a natural-language question.' },
      { status: 400, headers: corsHeaders() }
    );
  }

  let results: ScoredItem[] = [];

  // Determine which sources to search
  const searchNews_ = site === '' || site === 'news';
  const searchModels_ = site === '' || site === 'models';
  const searchReports_ = site === '' || site === 'reports';

  // Intent detection for broader queries
  const isModelQuery = detectModelQuery(query);
  const isNewsQuery = detectNewsQuery(query);

  if (searchNews_ && (site === 'news' || isNewsQuery || (!isModelQuery && site === ''))) {
    const newsResults = await searchNews(queryWords, limit);
    results.push(...newsResults);
  }

  if (searchModels_ && (site === 'models' || isModelQuery || site === '')) {
    const modelResults = searchModels(queryWords, limit);
    results.push(...modelResults);
  }

  if (searchReports_) {
    const reportResults = searchReports(queryWords, limit);
    results.push(...reportResults);
  }

  // Deduplicate and sort by score
  results.sort((a, b) => b.score - a.score);
  results = results.slice(0, limit);

  // Build response per NLWeb spec
  const response: Record<string, unknown> = {
    query_id: queryId,
    query,
    mode,
    site: site || 'all',
    result_count: results.length,
    results: results.map((r) => ({
      url: r.url,
      name: r.name,
      site: r.site,
      score: r.score,
      description: r.description,
      schema_object: r.schema_object,
    })),
    _nlweb: {
      version: '1.0',
      protocol: 'https://github.com/nlweb-ai/NLWeb',
      provider: 'Rare Agent Work',
      provider_url: 'https://rareagent.work',
    },
  };

  // In summarize mode, add a natural-language summary
  if (mode === 'summarize' && results.length > 0) {
    const topNames = results.slice(0, 5).map((r) => r.name);
    response.summary = `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}". Top matches: ${topNames.join('; ')}.`;
  }

  return NextResponse.json(response, {
    headers: corsHeaders(),
  });
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = sp.get('query') || sp.get('q') || '';
  const mode = sp.get('mode') || 'list';
  const site = sp.get('site') || '';
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '10', 10), 1), 50);
  const queryId = sp.get('query_id') || generateQueryId();

  if (!query) {
    return NextResponse.json(
      {
        error: 'Missing required parameter: query (or q)',
        usage: 'GET /ask?q=which model is best for tool use',
        docs: 'https://github.com/nlweb-ai/NLWeb/blob/main/docs/nlweb-rest-api.md',
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  return handleAsk({ query, mode, site, limit, queryId });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders() }
    );
  }

  const query = (body.query as string) || (body.q as string) || '';
  const mode = (body.mode as string) || 'list';
  const site = (body.site as string) || '';
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
  const queryId = (body.query_id as string) || generateQueryId();

  if (!query) {
    return NextResponse.json(
      {
        error: 'Missing required field: query',
        usage: 'POST /ask with {"query": "which model is best for tool use"}',
        docs: 'https://github.com/nlweb-ai/NLWeb/blob/main/docs/nlweb-rest-api.md',
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  return handleAsk({ query, mode, site, limit, queryId });
}
