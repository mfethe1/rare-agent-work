import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SEED_MODELS = [
  {
    slug: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    tool_use_score: 9.7,
    context_recall_score: 9.5,
    coding_score: 9.3,
    cost_per_1k_tokens: 0.075,
    context_window: 200000,
    best_for: ['complex-agents', 'architecture', 'high-stakes'],
  },
  {
    slug: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    tool_use_score: 9.4,
    context_recall_score: 9.1,
    coding_score: 8.9,
    cost_per_1k_tokens: 0.015,
    context_window: 200000,
    best_for: ['orchestration', 'reasoning', 'long-context'],
  },
  {
    slug: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    tool_use_score: 9.2,
    context_recall_score: 8.7,
    coding_score: 9.0,
    cost_per_1k_tokens: 0.01,
    context_window: 128000,
    best_for: ['multimodal', 'general', 'coding'],
  },
  {
    slug: 'gemini-2-0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    tool_use_score: 8.5,
    context_recall_score: 8.8,
    coding_score: 8.3,
    cost_per_1k_tokens: 0.001,
    context_window: 1000000,
    best_for: ['long-context', 'budget', 'speed'],
  },
  {
    slug: 'mistral-large-2',
    name: 'Mistral Large 2',
    provider: 'Mistral',
    tool_use_score: 8.4,
    context_recall_score: 8.0,
    coding_score: 8.5,
    cost_per_1k_tokens: 0.006,
    context_window: 128000,
    best_for: ['european-data', 'function-calling', 'balance'],
  },
  {
    slug: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    tool_use_score: 8.3,
    context_recall_score: 8.2,
    coding_score: 9.1,
    cost_per_1k_tokens: 0.0008,
    context_window: 128000,
    best_for: ['coding', 'math', 'budget'],
  },
  {
    slug: 'llama-3-3-70b',
    name: 'Llama 3.3 70B',
    provider: 'Meta (Open)',
    tool_use_score: 8.1,
    context_recall_score: 7.9,
    coding_score: 8.4,
    cost_per_1k_tokens: 0.0009,
    context_window: 128000,
    best_for: ['open-source', 'self-hosted', 'cost'],
  },
  {
    slug: 'qwen-2-5-72b',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba (Open)',
    tool_use_score: 8.0,
    context_recall_score: 8.1,
    coding_score: 8.6,
    cost_per_1k_tokens: 0.0004,
    context_window: 128000,
    best_for: ['open-source', 'multilingual', 'coding'],
  },
];

export async function GET(request: NextRequest) {
  const sortBy = request.nextUrl.searchParams.get('sort') || 'tool_use_score';
  const provider = request.nextUrl.searchParams.get('provider') || '';
  const minScore = parseFloat(request.nextUrl.searchParams.get('min_score') || '0');

  // Try DB first, fall back to seed
  let models = SEED_MODELS;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );
    const { data } = await supabase
      .from('models')
      .select('slug, name, provider, tool_use_score, context_recall_score, coding_score, cost_per_1k_tokens, context_window, best_for')
      .order('tool_use_score', { ascending: false });
    if (data && data.length > 0) models = data;
  } catch {
    // Use seed data
  }

  // Filter
  let filtered = models;
  if (provider) {
    filtered = filtered.filter(m => m.provider.toLowerCase().includes(provider.toLowerCase()));
  }
  if (minScore > 0) {
    filtered = filtered.filter(m => m.tool_use_score >= minScore);
  }

  // Sort
  const validSorts = ['tool_use_score', 'context_recall_score', 'coding_score', 'cost_per_1k_tokens', 'context_window'] as const;
  const sortField = validSorts.includes(sortBy as typeof validSorts[number])
    ? sortBy as keyof typeof SEED_MODELS[0]
    : 'tool_use_score';

  filtered.sort((a, b) => {
    const aVal = a[sortField] as number;
    const bVal = b[sortField] as number;
    return sortField === 'cost_per_1k_tokens' ? aVal - bVal : bVal - aVal;
  });

  return NextResponse.json({
    data: filtered,
    count: filtered.length,
    updated_at: new Date().toISOString(),
    source: 'https://rareagent.work/models',
    documentation: 'https://rareagent.work/.well-known/agent-card.json',
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
