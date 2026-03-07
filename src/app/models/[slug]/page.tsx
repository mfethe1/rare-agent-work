export const dynamic = "force-dynamic";
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Seed data (same as models/page.tsx — keep in sync or extract to lib)
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
    use_cases: [
      'Multi-step tool-calling pipelines',
      'Vision + text workflows',
      'OpenAI ecosystem integrations',
    ],
    comparison_tips: 'Best when you need strong tool-use with wide ecosystem support. More expensive than Claude Sonnet but well-supported in most frameworks.',
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
    use_cases: [
      'Agentic coding tasks with file access',
      'Long-document analysis and summarization',
      'Multi-turn tool-calling loops',
    ],
    comparison_tips: 'Best balance of cost and capability for agent workloads. Outperforms GPT-4o on coding tasks at lower cost.',
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
    use_cases: [
      'Complex multi-agent orchestration',
      'High-stakes reasoning chains',
      'Tasks requiring deep planning and reflection',
    ],
    comparison_tips: 'Reserve for tasks where cost is secondary to quality. Ideal as orchestrator in a tiered agent system with cheaper models as workers.',
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
    use_cases: [
      'Processing entire codebases in a single context',
      'Document-heavy workflows (legal, medical)',
      'Multimodal analysis at scale',
    ],
    comparison_tips: '1M context window is a genuine differentiator. Best for tasks that require full corpus comprehension rather than multi-hop retrieval.',
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
    use_cases: [
      'High-volume classification and routing',
      'Simple extraction tasks',
      'First-pass triage in multi-agent pipelines',
    ],
    comparison_tips: 'Cheapest capable model for simple tasks. Use as a worker node in multi-agent systems where complex reasoning is handled by a stronger model.',
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
    use_cases: [
      'Air-gapped / self-hosted deployments',
      'Workloads with data sovereignty requirements',
      'Cost-sensitive coding automation',
    ],
    comparison_tips: 'Best open-source option for teams that need full data control. Quality lags frontier models but strong for coding and sufficient for many tasks.',
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
    use_cases: [
      'EU data residency requirements (EU hosting available)',
      'Coding assistants on a budget',
      'Multilingual agent workflows',
    ],
    comparison_tips: 'Strong coding and tool-use at a mid-tier price. Good option when EU data residency is a hard requirement.',
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
    use_cases: [
      'Complex mathematical reasoning chains',
      'Code generation at very low cost',
      'Tasks where transparency of reasoning steps matters',
    ],
    comparison_tips: 'Excellent coding at very low cost. Tool-use reliability is lower than frontier models — validate carefully before using in autonomous loops.',
  },
];

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const model = SEED_MODELS.find((m) => m.slug === slug);
  if (!model) return { title: 'Model Not Found | Rare Agent Work' };

  return {
    title: `${model.name} for AI Agents | Rare Agent Work`,
    description: `${model.name} by ${model.provider}: tool use ${model.tool_use_score}/10, coding ${model.coding_score}/10, context ${model.context_window?.toLocaleString()} tokens. Best for ${model.best_for?.join(', ')}. See full breakdown and comparison tips.`,
    keywords: [
      `best LLM for ${model.best_for?.[0] || 'AI agents'}`,
      `${model.name} review`,
      `${model.provider} model comparison`,
      'agentic AI model',
      'LLM tool use benchmark',
    ],
  };
}

function ScoreBadge({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 9.0
      ? 'text-green-400 border-green-500/40 bg-green-950/30'
      : score >= 7.0
      ? 'text-yellow-400 border-yellow-500/40 bg-yellow-950/30'
      : 'text-red-400 border-red-500/40 bg-red-950/30';
  return (
    <div className={`border rounded-xl p-4 ${color}`}>
      <div className="text-3xl font-bold font-mono">{score.toFixed(1)}</div>
      <div className="text-sm mt-1 opacity-80">{label}</div>
    </div>
  );
}

export default async function ModelDetailPage({ params }: PageProps) {
  const { slug } = await params;

  // Try DB first, fall back to seed
  let model: typeof SEED_MODELS[0] | null = null;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (data) model = { ...SEED_MODELS[0], ...data };
  } catch {
    // Fallback to seed
  }

  if (!model) {
    model = SEED_MODELS.find((m) => m.slug === slug) ?? null;
  }

  if (!model) notFound();

  const allModels = SEED_MODELS.filter((m) => m.slug !== slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-6">
          <Link href="/models" className="hover:text-gray-300 transition-colors">← Models</Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">{model.name}</h1>
              <p className="text-gray-400 mt-1 text-lg">{model.provider}</p>
            </div>
            {model.pricing_url && (
              <a
                href={model.pricing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
              >
                View Pricing →
              </a>
            )}
          </div>

          {/* Best for chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            {model.best_for?.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full bg-orange-950/30 text-orange-300 border border-orange-500/20"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Score grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
          <ScoreBadge label="Tool Use" score={model.tool_use_score} />
          <ScoreBadge label="Context Recall" score={model.context_recall_score} />
          <ScoreBadge label="Coding" score={model.coding_score} />
        </div>

        {/* Specs */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cost per 1k tokens</p>
            <p className="text-xl font-mono font-semibold text-white">
              {model.cost_per_1k_tokens !== null
                ? `$${model.cost_per_1k_tokens.toFixed(5)}`
                : '—'}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Context Window</p>
            <p className="text-xl font-mono font-semibold text-white">
              {model.context_window !== null
                ? model.context_window >= 1000000
                  ? `${(model.context_window / 1000000).toFixed(0)}M tokens`
                  : `${(model.context_window / 1000).toFixed(0)}k tokens`
                : '—'}
            </p>
          </div>
        </div>

        {/* Use cases */}
        {'use_cases' in model && model.use_cases && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">Ideal Use Cases</h2>
            <ul className="space-y-3">
              {(model.use_cases as string[]).map((uc) => (
                <li key={uc} className="flex items-start gap-3 text-gray-300">
                  <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                  {uc}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comparison tips */}
        {'comparison_tips' in model && model.comparison_tips && (
          <div className="mb-10 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-3">Comparison Notes</h2>
            <p className="text-gray-300 leading-relaxed">{model.comparison_tips as string}</p>
          </div>
        )}

        {/* CTA */}
        <div className="border border-blue-500/30 bg-blue-950/10 rounded-xl p-6 text-center mb-10">
          <p className="text-gray-300 font-semibold mb-1">Running agents at scale?</p>
          <p className="text-gray-400 text-sm mb-4 max-w-lg mx-auto">
            Our Empirical Architecture Report covers model evaluation methodology, multi-agent routing, and
            production cost benchmarks for real deployments.
          </p>
          <Link
            href="/reports/empirical-architecture"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
          >
            Read the Research →
          </Link>
        </div>

        {/* Compare others */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Compare Other Models</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {allModels.map((m) => (
              <Link
                key={m.slug}
                href={`/models/${m.slug}`}
                className="block border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-colors"
              >
                <p className="font-semibold text-white text-sm">{m.name}</p>
                <p className="text-gray-500 text-xs mb-2">{m.provider}</p>
                <div className="flex gap-2 text-xs">
                  <span className="text-gray-400">Tool: <span className="text-white">{m.tool_use_score}</span></span>
                  <span className="text-gray-400">Code: <span className="text-white">{m.coding_score}</span></span>
                </div>
              </Link>
            ))}
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
