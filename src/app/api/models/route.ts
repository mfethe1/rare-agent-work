import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 3600;

// Same seed data as models page — single source of truth
const SEED_MODELS = [
  {
    slug: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic',
    tool_use_score: 9.6, context_recall_score: 9.5, coding_score: 9.6,
    cost_per_1k_tokens: 0.015, context_window: 200000,
    best_for: ['orchestration', 'complex-reasoning', 'flagship'],
  },
  {
    slug: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic',
    tool_use_score: 9.4, context_recall_score: 9.1, coding_score: 9.3,
    cost_per_1k_tokens: 0.003, context_window: 200000,
    best_for: ['coding', 'long-context', 'agentic'],
  },
  {
    slug: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI',
    tool_use_score: 9.2, context_recall_score: 8.5, coding_score: 8.8,
    cost_per_1k_tokens: 0.005, context_window: 128000,
    best_for: ['orchestration', 'tool-use', 'multimodal'],
  },
  {
    slug: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', provider: 'Google',
    tool_use_score: 8.8, context_recall_score: 8.9, coding_score: 8.7,
    cost_per_1k_tokens: 0.0035, context_window: 1000000,
    best_for: ['long-context', 'multimodal', 'budget'],
  },
  {
    slug: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI',
    tool_use_score: 7.8, context_recall_score: 7.2, coding_score: 7.5,
    cost_per_1k_tokens: 0.00015, context_window: 128000,
    best_for: ['budget', 'high-volume', 'simple-tasks'],
  },
  {
    slug: 'llama-3-1-405b', name: 'Llama 3.1 405B', provider: 'Meta (via Groq)',
    tool_use_score: 7.5, context_recall_score: 7.0, coding_score: 7.8,
    cost_per_1k_tokens: 0.0008, context_window: 128000,
    best_for: ['open-source', 'self-hosted', 'coding'],
  },
  {
    slug: 'mistral-large-2', name: 'Mistral Large 2', provider: 'Mistral AI',
    tool_use_score: 7.9, context_recall_score: 7.6, coding_score: 8.1,
    cost_per_1k_tokens: 0.002, context_window: 128000,
    best_for: ['coding', 'european-data', 'budget'],
  },
  {
    slug: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek',
    tool_use_score: 6.8, context_recall_score: 8.0, coding_score: 9.0,
    cost_per_1k_tokens: 0.00055, context_window: 128000,
    best_for: ['coding', 'reasoning', 'budget'],
  },
];

type SortField = 'tool_use' | 'context_recall' | 'coding' | 'cost';

const SORT_KEYS: Record<SortField, string> = {
  tool_use: 'tool_use_score',
  context_recall: 'context_recall_score',
  coding: 'coding_score',
  cost: 'cost_per_1k_tokens',
};

export async function GET(request: NextRequest) {
  const sortParam = (request.nextUrl.searchParams.get('sort') || 'tool_use') as SortField;
  const order = request.nextUrl.searchParams.get('order') || 'desc';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 50;

  const sortKey = SORT_KEYS[sortParam] || 'tool_use_score';

  let models = SEED_MODELS;

  // Try Supabase first
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { data } = await supabase
        .from('models')
        .select('slug, name, provider, tool_use_score, context_recall_score, coding_score, cost_per_1k_tokens, context_window, best_for')
        .order(sortKey, { ascending: order === 'asc' })
        .limit(limit);
      if (data && data.length > 0) models = data;
    }
  } catch {
    // Fall through to seed data
  }

  // Sort seed data if DB wasn't available
  if (models === SEED_MODELS) {
    models = [...SEED_MODELS].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey] as number;
      const bVal = (b as Record<string, unknown>)[sortKey] as number;
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    }).slice(0, limit);
  }

  return NextResponse.json(
    { models, count: models.length },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=7200',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
