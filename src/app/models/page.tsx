export const dynamic = "force-dynamic";
import { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import ModelsTable from '@/components/ModelsTable';

export const metadata: Metadata = {
  title: 'Model index under review',
  description:
    'The Rare Agent Work model leaderboard is temporarily offline while we rebuild the evaluation with fresher data, transparent methodology, and a live update cadence.',
  robots: {
    index: false,
    follow: true,
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
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      <nav className="border-b border-gray-800 sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-orange-500 font-bold text-lg tracking-tight">
                Rare Agent Work
              </Link>
              <div className="hidden sm:flex items-center gap-4">
                <Link href="/news" className="text-gray-400 hover:text-white text-sm transition-colors">News</Link>
                <Link href="/#catalog" className="text-gray-400 hover:text-white text-sm transition-colors">Reports</Link>
                <Link href="/assessment" className="text-gray-400 hover:text-white text-sm transition-colors">Assessment</Link>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-950/10 p-8 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">Temporarily offline</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">The model leaderboard is under review.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-300">
            We pulled this page out of public circulation because stale rankings create more confusion than clarity.
            It will only return once the evaluation has fresh data, transparent methodology, and a live maintenance cadence.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-5">
              <h2 className="text-sm font-semibold text-white">What changes before relaunch</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>• Visible last-updated timestamp</li>
                <li>• Clear scoring methodology</li>
                <li>• Automated refresh cadence and alerts</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-5">
              <h2 className="text-sm font-semibold text-white">Why we pulled it</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>• Trust matters more than filler content</li>
                <li>• Precise scores need real evidence</li>
                <li>• Outdated rankings weaken the rest of the site</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-5">
              <h2 className="text-sm font-semibold text-white">What to read instead</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>• Start Here for implementation order</li>
                <li>• News for platform drift</li>
                <li>• Reports for operator-grade evaluations</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/start-here"
              className="inline-flex items-center rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
            >
              Read Start Here
            </Link>
            <Link
              href="/reports/empirical-architecture"
              className="inline-flex items-center rounded-lg border border-gray-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-gray-500"
            >
              Read the empirical report
            </Link>
          </div>
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
