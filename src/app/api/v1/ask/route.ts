import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAllNews } from '@/lib/news-store';
import { getAllReports } from '@/lib/reports';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateRequest, askSchema } from '@/lib/api-validation';
import { sanitizeError } from '@/lib/api-errors';

/**
 * NLWeb-compatible /ask endpoint
 * Accepts natural language queries about models, news, and reports.
 * Returns Schema.org JSON responses.
 *
 * Protocol: https://github.com/microsoft/NLWeb
 *
 * POST /api/v1/ask
 * Body: { "query": "which model is best for tool use?", "prev": "optional,previous,queries" }
 *
 * GET /api/v1/ask?q=which model is best for tool use
 */

// Model seed data (same as models page)
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

interface NLWebResult {
  '@type': string;
  url: string;
  name: string;
  description: string;
  score: number;
  schema_object: Record<string, unknown>;
}

async function getModels() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data } = await supabase.from('models').select('*').order('tool_use_score', { ascending: false });
    if (data && data.length > 0) return data;
  } catch { /* fall through */ }
  return SEED_MODELS;
}

function buildContext(models: typeof SEED_MODELS, news: Awaited<ReturnType<typeof getAllNews>>, reports: ReturnType<typeof getAllReports>) {
  const modelCtx = models.map(m =>
    `- ${m.name} (${m.provider}): tool_use=${m.tool_use_score}, context_recall=${m.context_recall_score}, coding=${m.coding_score}, cost=$${m.cost_per_1k_tokens}/1k, context=${m.context_window.toLocaleString()}, best_for=${(m.best_for as string[]).join(', ')}`
  ).join('\n');

  const newsCtx = news.slice(0, 20).map(n =>
    `- [${n.category}] "${n.title}" (${n.source}, ${n.publishedAt.slice(0, 10)}) tags: ${(n.tags || []).join(', ')} url: ${n.url}`
  ).join('\n');

  const reportCtx = reports.map(r =>
    `- "${r.title}" (${r.price} ${r.priceLabel}) — ${r.subtitle}. Audience: ${r.audience}. URL: https://rareagent.work/reports/${r.slug}`
  ).join('\n');

  return `You are the Rare Agent Work knowledge assistant. Answer questions using ONLY the data below. Be concise and factual. Always cite specific data points.

## Model Leaderboard
${modelCtx}

## Latest News (top 20)
${newsCtx}

## Research Reports
${reportCtx}

Rules:
- Only answer from the data above. If the answer isn't in the data, say so.
- When recommending models, cite their scores.
- When referencing news, include the source and date.
- When suggesting reports, include the URL and price.
- Return your answer as a JSON object with: "answer" (string), "results" (array of relevant items with url, name, description, score 0-100, type).`;
}

async function processQuery(query: string, prev?: string): Promise<{ answer: string; results: NLWebResult[] }> {
  const [models, news, reports] = await Promise.all([
    getModels(),
    getAllNews(),
    getAllReports(),
  ]);

  const context = buildContext(models, news, reports);
  const conversationHistory = prev ? `Previous queries in this conversation: ${prev}\n\n` : '';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: simple keyword matching without LLM
    return keywordFallback(query, models, news, reports);
  }

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 1024,
    system: context,
    messages: [{
      role: 'user',
      content: `${conversationHistory}Query: ${query}\n\nRespond with a JSON object containing "answer" (concise text answer) and "results" (array of {url, name, description, score, type} for the most relevant items). Return ONLY valid JSON.`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    // Try to parse as JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        answer: parsed.answer || text,
        results: (parsed.results || []).map((r: Record<string, unknown>) => ({
          '@type': (r.type as string) || 'Thing',
          url: (r.url as string) || '',
          name: (r.name as string) || '',
          description: (r.description as string) || '',
          score: (r.score as number) || 50,
          schema_object: { '@context': 'https://schema.org', '@type': (r.type as string) || 'Thing', name: r.name, url: r.url, description: r.description },
        })),
      };
    }
  } catch { /* fall through to plain text response */ }

  return { answer: text, results: [] };
}

function keywordFallback(
  query: string,
  models: typeof SEED_MODELS,
  news: Awaited<ReturnType<typeof getAllNews>>,
  reports: ReturnType<typeof getAllReports>
): { answer: string; results: NLWebResult[] } {
  const q = query.toLowerCase();
  const results: NLWebResult[] = [];

  // Check if asking about models
  const modelKeywords = ['model', 'llm', 'best', 'cheapest', 'fastest', 'tool use', 'coding', 'context', 'compare'];
  if (modelKeywords.some(k => q.includes(k))) {
    const sorted = [...models].sort((a, b) => b.tool_use_score - a.tool_use_score);
    for (const m of sorted.slice(0, 5)) {
      results.push({
        '@type': 'SoftwareApplication',
        url: `https://rareagent.work/models/${m.slug}`,
        name: m.name,
        description: `${m.provider} — Tool Use: ${m.tool_use_score}, Coding: ${m.coding_score}, Cost: $${m.cost_per_1k_tokens}/1k tokens. Best for: ${(m.best_for as string[]).join(', ')}`,
        score: Math.round(m.tool_use_score * 10),
        schema_object: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: m.name, provider: m.provider },
      });
    }
    return { answer: `Top models by tool use score: ${sorted.slice(0, 3).map(m => `${m.name} (${m.tool_use_score})`).join(', ')}`, results };
  }

  // Check if asking about news
  const newsKeywords = ['news', 'latest', 'recent', 'update', 'announcement', 'release'];
  if (newsKeywords.some(k => q.includes(k))) {
    for (const n of news.slice(0, 5)) {
      results.push({
        '@type': 'NewsArticle',
        url: n.url,
        name: n.title,
        description: n.summary,
        score: 80,
        schema_object: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: n.title, datePublished: n.publishedAt },
      });
    }
    return { answer: `Latest ${results.length} news items from the AI agent space.`, results };
  }

  // Default: return reports
  for (const r of reports) {
    results.push({
      '@type': 'Product',
      url: `https://rareagent.work/reports/${r.slug}`,
      name: r.title,
      description: `${r.subtitle}. ${r.audience}. ${r.price} ${r.priceLabel}.`,
      score: 70,
      schema_object: { '@context': 'https://schema.org', '@type': 'Product', name: r.title, offers: { price: r.price.replace('$', ''), priceCurrency: 'USD' } },
    });
  }
  return { answer: `Rare Agent Work offers ${reports.length} operator-grade research reports on AI agent systems.`, results };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query || body.q;
    const prev = body.prev || body.previous || '';

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    if (query.length > 500) {
      return NextResponse.json({ error: 'query too long (max 500 characters)' }, { status: 400 });
    }

    const { answer, results } = await processQuery(query, prev);

    return NextResponse.json({
      '@context': 'https://schema.org',
      query_id: crypto.randomUUID(),
      query,
      answer,
      results,
      source: 'https://rareagent.work',
      protocol: 'nlweb',
      documentation: 'https://rareagent.work/.well-known/agent-card.json',
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');

  if (!q) {
    return NextResponse.json({
      protocol: 'nlweb',
      version: '1.0',
      description: 'NLWeb-compatible natural language query endpoint for Rare Agent Work. Ask questions about AI models, agent news, and research reports.',
      usage: {
        GET: '/api/v1/ask?q=which model is best for coding',
        POST: { url: '/api/v1/ask', body: { query: 'which model is best for coding', prev: 'optional,previous,queries' } },
      },
      examples: [
        'which model has the best tool use score?',
        'what is the cheapest model for coding?',
        'latest news about openai',
        'what reports do you have on multi-agent systems?',
        'compare Claude Opus vs GPT-4o for agentic use',
      ],
      source: 'https://rareagent.work',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (q.length > 500) {
    return NextResponse.json({ error: 'query too long (max 500 characters)' }, { status: 400 });
  }

  const { answer, results } = await processQuery(q);

  return NextResponse.json({
    '@context': 'https://schema.org',
    query_id: crypto.randomUUID(),
    query: q,
    answer,
    results,
    source: 'https://rareagent.work',
    protocol: 'nlweb',
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
