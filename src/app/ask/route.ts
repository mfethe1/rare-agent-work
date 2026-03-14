/**
 * NLWeb /ask endpoint — Natural Language Web protocol
 *
 * Lets any AI agent query rareagent.work in natural language:
 *   GET /ask?q=which model is best for tool use
 *   GET /ask?q=latest AI agent news about security
 *   GET /ask?q=what reports do you offer
 *
 * Returns structured JSON with answer + source citations.
 * No auth required. Rate-limited by IP.
 *
 * Protocol: https://github.com/nicholasgasior/nlweb
 * Acts as an MCP-compatible server for the broader agent ecosystem.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllNews, getNewsByTag } from '@/lib/news-store';
import { getAllReports } from '@/lib/reports';

export const runtime = 'nodejs';

// ── Types ──

interface NLWebResult {
  '@type': string;
  name: string;
  description: string;
  url: string;
  [key: string]: unknown;
}

interface NLWebResponse {
  '@context': string;
  '@type': string;
  query: string;
  answer: string;
  results: NLWebResult[];
  sources: string[];
  site: {
    name: string;
    url: string;
    description: string;
  };
}

// ── Seed model data (matches /api/models) ──

const MODELS = [
  { slug: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', tool_use: 9.6, context_recall: 9.5, coding: 9.6, cost: 0.015, context_window: 200000, best_for: ['orchestration', 'complex-reasoning', 'flagship'] },
  { slug: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', tool_use: 9.4, context_recall: 9.1, coding: 9.3, cost: 0.003, context_window: 200000, best_for: ['coding', 'long-context', 'agentic'] },
  { slug: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tool_use: 9.2, context_recall: 8.5, coding: 8.8, cost: 0.005, context_window: 128000, best_for: ['orchestration', 'tool-use', 'multimodal'] },
  { slug: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', tool_use: 8.8, context_recall: 8.9, coding: 8.7, cost: 0.0035, context_window: 1000000, best_for: ['long-context', 'multimodal', 'budget'] },
  { slug: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tool_use: 7.8, context_recall: 7.2, coding: 7.5, cost: 0.00015, context_window: 128000, best_for: ['budget', 'high-volume', 'simple-tasks'] },
  { slug: 'mistral-large-2', name: 'Mistral Large 2', provider: 'Mistral AI', tool_use: 7.9, context_recall: 7.6, coding: 8.1, cost: 0.002, context_window: 128000, best_for: ['coding', 'european-data', 'budget'] },
  { slug: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', tool_use: 6.8, context_recall: 8.0, coding: 9.0, cost: 0.00055, context_window: 128000, best_for: ['coding', 'reasoning', 'budget'] },
  { slug: 'llama-3-1-405b', name: 'Llama 3.1 405B', provider: 'Meta (via Groq)', tool_use: 7.5, context_recall: 7.0, coding: 7.8, cost: 0.0008, context_window: 128000, best_for: ['open-source', 'self-hosted', 'coding'] },
];

// ── Intent Detection ──

type Intent = 'models' | 'news' | 'reports' | 'digest' | 'about' | 'unknown';

function detectIntent(query: string): { intent: Intent; tags: string[]; sortField?: string } {
  const q = query.toLowerCase();
  const tags: string[] = [];

  // Extract potential tags
  const tagPatterns = [
    'openai', 'anthropic', 'google', 'meta', 'mistral', 'deepseek',
    'security', 'safety', 'langchain', 'crewai', 'autogen', 'mcp',
    'coding', 'tool use', 'multimodal', 'open-source', 'budget',
  ];
  for (const tag of tagPatterns) {
    if (q.includes(tag)) tags.push(tag);
  }

  // Model queries
  if (q.match(/\b(model|leaderboard|rank|compare|best.*for|llm|benchmark|score|tool.?use|context.?recall|coding.?(score|ability)|cheapest|cost.?efficient)\b/)) {
    let sortField = 'tool_use';
    if (q.match(/context.?recall|memory|remember/)) sortField = 'context_recall';
    if (q.match(/coding|code|programming|develop/)) sortField = 'coding';
    if (q.match(/cheap|cost|budget|price|afford/)) sortField = 'cost';
    return { intent: 'models', tags, sortField };
  }

  // News queries
  if (q.match(/\b(news|latest|recent|update|release|launch|announce|this week|today|yesterday)\b/)) {
    return { intent: 'news', tags };
  }

  // Report queries
  if (q.match(/\b(report|guide|playbook|buy|purchase|course|learn|tutorial|how to|setup|architecture|evaluation|governance)\b/)) {
    return { intent: 'reports', tags };
  }

  // Digest
  if (q.match(/\b(digest|summary|weekly|overview|recap)\b/)) {
    return { intent: 'digest', tags };
  }

  // About / meta
  if (q.match(/\b(what is|who|about|contact|email|site|rare agent)\b/)) {
    return { intent: 'about', tags };
  }

  return { intent: 'unknown', tags };
}

// ── Response Builders ──

function buildModelResponse(query: string, sortField: string, tags: string[]): NLWebResponse {
  let filtered = [...MODELS];

  // Filter by provider tags
  if (tags.length > 0) {
    filtered = MODELS.filter(m =>
      tags.some(t =>
        m.provider.toLowerCase().includes(t) ||
        m.best_for.some(b => b.includes(t)) ||
        m.name.toLowerCase().includes(t)
      )
    );
    if (filtered.length === 0) filtered = [...MODELS];
  }

  // Sort
  const sortMap: Record<string, keyof typeof MODELS[0]> = {
    tool_use: 'tool_use',
    context_recall: 'context_recall',
    coding: 'coding',
    cost: 'cost',
  };
  const key = sortMap[sortField] || 'tool_use';
  const ascending = sortField === 'cost';
  filtered.sort((a, b) => ascending
    ? (a[key] as number) - (b[key] as number)
    : (b[key] as number) - (a[key] as number)
  );

  const top = filtered[0];
  const sortLabel: Record<string, string> = {
    tool_use: 'tool use',
    context_recall: 'context recall',
    coding: 'coding ability',
    cost: 'cost efficiency',
  };

  const answer = sortField === 'cost'
    ? `The most cost-efficient model for agentic use is ${top.name} by ${top.provider} at $${top.cost}/1k tokens, with a tool use score of ${top.tool_use}/10. ${filtered.length > 1 ? `Runner-up: ${filtered[1].name} at $${filtered[1].cost}/1k tokens.` : ''}`
    : `For ${sortLabel[sortField] || 'agentic use'}, ${top.name} by ${top.provider} leads with a score of ${top[key as keyof typeof top]}/10. ${filtered.length > 1 ? `Runner-up: ${filtered[1].name} with ${filtered[1][key as keyof typeof filtered[0]]}/10.` : ''}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    query,
    answer,
    results: filtered.slice(0, 5).map(m => ({
      '@type': 'Product',
      name: m.name,
      description: `${m.provider} — Tool use: ${m.tool_use}, Context recall: ${m.context_recall}, Coding: ${m.coding}, Cost: $${m.cost}/1k tokens, Context: ${(m.context_window / 1000).toFixed(0)}k. Best for: ${m.best_for.join(', ')}.`,
      url: `https://rareagent.work/models/${m.slug}`,
      provider: m.provider,
      tool_use_score: m.tool_use,
      context_recall_score: m.context_recall,
      coding_score: m.coding,
      cost_per_1k_tokens: m.cost,
      context_window: m.context_window,
      best_for: m.best_for,
    })),
    sources: ['https://rareagent.work/models', 'https://rareagent.work/api/models'],
    site: { name: 'Rare Agent Work', url: 'https://rareagent.work', description: 'Operator-grade AI agent research' },
  };
}

async function buildNewsResponse(query: string, tags: string[]): Promise<NLWebResponse> {
  let items = tags.length > 0
    ? (await Promise.all(tags.map(t => getNewsByTag(t)))).flat()
    : await getAllNews();

  // Deduplicate by id
  const seen = new Set<string>();
  items = items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });

  const topItems = items.slice(0, 8);

  const answer = topItems.length > 0
    ? `Found ${items.length} recent AI agent news items${tags.length ? ` matching "${tags.join(', ')}"` : ''}. Top story: "${topItems[0].title}" from ${topItems[0].source}.`
    : 'No recent news items found matching your query.';

  return {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    query,
    answer,
    results: topItems.map(item => ({
      '@type': 'NewsArticle',
      name: item.title,
      description: item.summary,
      url: item.url,
      source: item.source,
      category: item.category,
      tags: item.tags,
      datePublished: item.publishedAt,
      upvotes: item.upvotes,
    })),
    sources: ['https://rareagent.work/news', 'https://rareagent.work/api/news'],
    site: { name: 'Rare Agent Work', url: 'https://rareagent.work', description: 'Operator-grade AI agent research' },
  };
}

function buildReportResponse(query: string): NLWebResponse {
  const reports = getAllReports();

  const answer = `Rare Agent Work offers ${reports.length} operator-grade reports: ${reports.map(r => `"${r.title}" (${r.price} ${r.priceLabel})`).join(', ')}. All reports include production-tested implementation detail, not tutorials.`;

  return {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    query,
    answer,
    results: reports.map(r => ({
      '@type': 'Product',
      name: r.title,
      description: `${r.subtitle}. ${r.valueprop}`,
      url: `https://rareagent.work/reports/${r.slug}`,
      price: r.price,
      priceLabel: r.priceLabel,
      audience: r.audience,
      deliverables: r.deliverables.map(d => `${d.title}: ${d.desc}`),
    })),
    sources: ['https://rareagent.work', 'https://rareagent.work/api/reports'],
    site: { name: 'Rare Agent Work', url: 'https://rareagent.work', description: 'Operator-grade AI agent research' },
  };
}

async function buildDigestResponse(query: string): Promise<NLWebResponse> {
  const items = await getAllNews();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekStr = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const categories: Record<string, number> = {};
  for (const item of items) {
    categories[item.category] = (categories[item.category] || 0) + 1;
  }
  const topCats = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(c => c[0]);

  const answer = `Week of ${weekStr}: ${items.length} developments in AI agents. Key themes: ${topCats.join(', ')}.${items.length > 0 ? ` Top story: "${items[0].title}".` : ''}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    query,
    answer,
    results: items.slice(0, 10).map(item => ({
      '@type': 'NewsArticle',
      name: item.title,
      description: item.summary,
      url: item.url,
      source: item.source,
      category: item.category,
      datePublished: item.publishedAt,
    })),
    sources: ['https://rareagent.work/digest', 'https://rareagent.work/api/digest'],
    site: { name: 'Rare Agent Work', url: 'https://rareagent.work', description: 'Operator-grade AI agent research' },
  };
}

function buildAboutResponse(query: string): NLWebResponse {
  return {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    query,
    answer: 'Rare Agent Work publishes operator-grade AI agent research — deeply researched reports, a model leaderboard ranked for agentic use, curated daily news, and an AI implementation guide. Not tutorials. Operator playbooks with real implementation detail. Available at rareagent.work.',
    results: [
      {
        '@type': 'WebSite',
        name: 'Rare Agent Work',
        description: 'Practical, deeply researched reports on low-code automation, multi-agent systems, and empirical deployment standards.',
        url: 'https://rareagent.work',
        contactEmail: 'hello@rareagent.work',
        features: ['Model Leaderboard', 'AI Agent News Feed', 'Weekly Digest', 'Operator Reports', 'AI Implementation Guide'],
        apis: ['GET /api/news', 'GET /api/models', 'GET /api/reports', 'GET /api/digest', 'GET /ask?q='],
      },
    ],
    sources: ['https://rareagent.work', 'https://rareagent.work/llms.txt'],
    site: { name: 'Rare Agent Work', url: 'https://rareagent.work', description: 'Operator-grade AI agent research' },
  };
}

function buildFallbackResponse(query: string): NLWebResponse {
  return {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    query,
    answer: `I can help with questions about AI models for agents, agent news, our reports, or the weekly digest. Try: "which model is best for tool use?", "latest AI agent news", or "what reports do you offer?"`,
    results: [],
    sources: ['https://rareagent.work/llms.txt'],
    site: { name: 'Rare Agent Work', url: 'https://rareagent.work', description: 'Operator-grade AI agent research' },
  };
}

// Rate limiting is handled globally by src/middleware.ts (Redis-backed, "llm" tier)

// ── Handler ──

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json(
      {
        '@context': 'https://schema.org',
        '@type': 'WebAPI',
        name: 'Rare Agent Work — NLWeb Ask Endpoint',
        description: 'Natural language query interface for AI agent research data. Pass your question as ?q= parameter.',
        url: 'https://rareagent.work/ask',
        documentation: 'https://rareagent.work/llms.txt',
        examples: [
          'GET /ask?q=which model is best for tool use',
          'GET /ask?q=latest AI agent news about security',
          'GET /ask?q=what reports do you offer',
          'GET /ask?q=weekly digest summary',
          'GET /ask?q=compare Claude vs GPT for agents',
          'GET /ask?q=cheapest model for coding',
        ],
        supportedQueries: ['model comparisons', 'news search', 'report catalog', 'weekly digest', 'site info'],
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }

  const { intent, tags, sortField } = detectIntent(query);

  let response: NLWebResponse;
  switch (intent) {
    case 'models':
      response = buildModelResponse(query, sortField || 'tool_use', tags);
      break;
    case 'news':
      response = await buildNewsResponse(query, tags);
      break;
    case 'reports':
      response = buildReportResponse(query);
      break;
    case 'digest':
      response = await buildDigestResponse(query);
      break;
    case 'about':
      response = buildAboutResponse(query);
      break;
    default:
      response = buildFallbackResponse(query);
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Access-Control-Allow-Origin': '*',
      'X-NLWeb-Version': '1.0',
      'X-Intent': intent,
    },
  });
}
