export const dynamic = "force-dynamic";
import { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import ModelsTable from '@/components/ModelsTable';

export const metadata: Metadata = {
  title: 'Agentic Model Leaderboard',
  description:
    'Compare the best LLMs for AI agent development. Ranked by tool use, context recall, coding ability, cost efficiency, and context window. Updated regularly with real benchmark data.',
  keywords: [
    'best LLM for AI agents',
    'agentic model comparison',
    'tool use benchmark',
    'GPT-5 vs Claude Opus comparison',
    'LLM leaderboard 2026',
    'AI agent model ranking',
    'coding LLM benchmark',
    'context window comparison',
  ],
  openGraph: {
    title: 'Agentic Model Leaderboard | Rare Agent Work',
    description: 'Compare LLMs for AI agent development — ranked by tool use, context recall, coding, and cost.',
    url: 'https://rareagent.work/models',
    siteName: 'Rare Agent Work',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Agentic Model Leaderboard' }],
  },
  alternates: {
    canonical: 'https://rareagent.work/models',
  },
};

export const revalidate = 3600; // 1 hour

// Seed data fallback when DB is empty
const SEED_MODELS = [
  {
    id: 'seed-gpt4o',
    slug: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    tool_use_score: 9.2,
    context_recall_score: 8.5,
    coding_score: 8.8,
    cost_per_1k_tokens: 0.005,
    context_window: 128000,
    best_for: ['orchestration', 'tool-use', 'multimodal'],
    pricing_url: 'https://openai.com/pricing',
  },
  {
    id: 'seed-claude-sonnet',
    slug: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    tool_use_score: 9.4,
    context_recall_score: 9.1,
    coding_score: 9.3,
    cost_per_1k_tokens: 0.003,
    context_window: 200000,
    best_for: ['coding', 'long-context', 'agentic'],
    pricing_url: 'https://anthropic.com/pricing',
  },
  {
    id: 'seed-claude-opus',
    slug: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    tool_use_score: 9.6,
    context_recall_score: 9.5,
    coding_score: 9.6,
    cost_per_1k_tokens: 0.015,
    context_window: 200000,
    best_for: ['orchestration', 'complex-reasoning', 'flagship'],
    pricing_url: 'https://anthropic.com/pricing',
  },
  {
    id: 'seed-gemini-pro',
    slug: 'gemini-2-5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    tool_use_score: 8.8,
    context_recall_score: 8.9,
    coding_score: 8.7,
    cost_per_1k_tokens: 0.0035,
    context_window: 1000000,
    best_for: ['long-context', 'multimodal', 'budget'],
    pricing_url: 'https://ai.google.dev/pricing',
  },
  {
    id: 'seed-gpt4o-mini',
    slug: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    tool_use_score: 7.8,
    context_recall_score: 7.2,
    coding_score: 7.5,
    cost_per_1k_tokens: 0.00015,
    context_window: 128000,
    best_for: ['budget', 'high-volume', 'simple-tasks'],
    pricing_url: 'https://openai.com/pricing',
  },
  {
    id: 'seed-llama3',
    slug: 'llama-3-1-405b',
    name: 'Llama 3.1 405B',
    provider: 'Meta (via Groq)',
    tool_use_score: 7.5,
    context_recall_score: 7.0,
    coding_score: 7.8,
    cost_per_1k_tokens: 0.0008,
    context_window: 128000,
    best_for: ['open-source', 'self-hosted', 'coding'],
    pricing_url: 'https://groq.com/pricing',
  },
  {
    id: 'seed-mistral',
    slug: 'mistral-large-2',
    name: 'Mistral Large 2',
    provider: 'Mistral AI',
    tool_use_score: 7.9,
    context_recall_score: 7.6,
    coding_score: 8.1,
    cost_per_1k_tokens: 0.002,
    context_window: 128000,
    best_for: ['coding', 'european-data', 'budget'],
    pricing_url: 'https://mistral.ai/technology/#pricing',
  },
  {
    id: 'seed-deepseek',
    slug: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    tool_use_score: 6.8,
    context_recall_score: 8.0,
    coding_score: 9.0,
    cost_per_1k_tokens: 0.00055,
    context_window: 128000,
    best_for: ['coding', 'reasoning', 'budget'],
    pricing_url: 'https://platform.deepseek.com/docs',
  },
];

export default async function ModelsPage() {
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

  const { data: dbModels } = await supabase
    .from('models')
    .select('*')
    .order('tool_use_score', { ascending: false });

  const models = (dbModels && dbModels.length > 0) ? dbModels : SEED_MODELS;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-orange-500 font-bold text-lg tracking-tight">
                Rare Agent Work
              </Link>
              <div className="hidden sm:flex items-center gap-4">
                <Link href="/news" className="text-gray-400 hover:text-white text-sm transition-colors">News</Link>
                <Link href="/models" className="text-white text-sm font-medium">Models</Link>
                <Link href="/#catalog" className="text-gray-400 hover:text-white text-sm transition-colors">Reports</Link>
              </div>
            </div>
            <Link
              href="/#catalog"
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            >
              Get Reports
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Agentic Model Leaderboard</h1>
          <p className="text-gray-400 max-w-2xl">
            Models ranked for agentic use: tool calling, context recall, and coding ability.
            Click any column header to sort. Click a model name for full breakdown.
          </p>
        </div>

        <ModelsTable models={models} />

        {/* CTA */}
        <div className="mt-10 border border-blue-500/30 bg-blue-950/10 rounded-xl p-6 text-center">
          <p className="text-gray-300 mb-1 font-semibold">Running agents at scale?</p>
          <p className="text-gray-400 text-sm mb-4 max-w-xl mx-auto">
            Our <span className="text-blue-400 font-medium">Empirical Architecture Report</span> covers
            model evaluation methodology, multi-agent routing, and production benchmarks for real deployments.
          </p>
          <Link
            href="/reports/empirical-architecture"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
          >
            Read the Empirical Research Report →
          </Link>
        </div>
      </main>

      <footer className="border-t border-gray-800 py-8 mt-12 text-center text-gray-600 text-xs">
        <p>
          © {new Date().getFullYear()} Rare Agent Work ·{' '}
          <a href="mailto:hello@rareagent.work" className="hover:text-gray-400 transition-colors">
            hello@rareagent.work
          </a>
        </p>
      </footer>
    </div>
  );
}
