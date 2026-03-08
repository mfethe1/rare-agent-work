import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Start Here for Agentic Systems',
  description:
    'A practical starting point for teams building agentic systems: strategy, stack selection, reliability, memory, orchestration, and rollout order.',
  keywords: [
    'agentic systems guide',
    'how to build agentic systems',
    'agent setup guide',
    'multi-agent systems roadmap',
    'production agent architecture',
  ],
  alternates: {
    canonical: 'https://rareagent.work/start-here',
  },
  openGraph: {
    title: 'Start Here for Agentic Systems | Rare Agent Work',
    description:
      'The shortest path from AI curiosity to a production-ready agentic system.',
    url: 'https://rareagent.work/start-here',
    siteName: 'Rare Agent Work',
    type: 'article',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Start Here for Agentic Systems' }],
  },
};

const tracks = [
  {
    title: 'If you are just getting started',
    bullets: [
      'Pick one narrow workflow before you pick a framework.',
      'Prove value with a single agent plus human approval.',
      'Add memory, orchestration, and autonomy only after you have repeatable wins.',
    ],
    cta: { href: '/reports/agent-setup-60', label: 'Read the 60-minute setup guide' },
  },
  {
    title: 'If you already have agents in the wild',
    bullets: [
      'Audit failure modes: retries, duplicate actions, auth drift, timeouts, and silent hallucinations.',
      'Add traces, checkpoints, evaluation loops, and clear rollback paths.',
      'Treat memory and tool-use as reliability systems, not features.',
    ],
    cta: { href: '/reports/empirical-agent-architecture', label: 'Read the architecture research report' },
  },
  {
    title: 'If you are scaling to a team or multi-agent system',
    bullets: [
      'Define role boundaries before adding more agents.',
      'Centralize evidence, state, and ownership so handoffs do not collapse.',
      'Instrument cost, latency, and quality before you scale traffic.',
    ],
    cta: { href: '/reports/single-to-multi-agent', label: 'Read the multi-agent transition playbook' },
  },
];

const principles = [
  {
    title: 'Start with one painful workflow',
    body: 'Leadership comes from practical wins, not broad claims. Replace one expensive, repetitive, high-friction workflow first.',
  },
  {
    title: 'Design for failure on day one',
    body: 'Agentic systems fail in messy ways: retries, stale context, tool mismatch, auth drift, and hidden cost spikes. Build controls early.',
  },
  {
    title: 'Separate content for humans and agents',
    body: 'Humans need opinionated guidance. Agents need clean structured endpoints, canonical docs, and predictable machine-readable surfaces.',
  },
  {
    title: 'Turn expertise into reusable systems',
    body: 'To become a category leader, publish frameworks, evaluations, and implementation assets that compound over time.',
  },
];

export default function StartHerePage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Start Here', url: 'https://rareagent.work/start-here' },
        ]}
      />

      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-[#0d0d0d]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold tracking-tight text-orange-500">Rare Agent Work</Link>
            <div className="hidden items-center gap-4 sm:flex">
              <Link href="/start-here" className="text-sm font-medium text-white">Start Here</Link>
              <Link href="/news" className="text-sm text-gray-400 hover:text-white">News Feed</Link>
              <Link href="/assessment" className="text-sm text-gray-400 hover:text-white">Assessment</Link>
            </div>
          </div>
          <Link href="/assessment" className="rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700">
            Get an assessment
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">Start here</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            The shortest path from AI curiosity to a production-grade agentic system
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-400">
            Most teams jump straight into frameworks and demos. The teams that win get the operating order right:
            pick the workflow, define the failure budget, instrument the system, then scale it.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-4">
          {principles.map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
              <h2 className="text-base font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-3">
          {tracks.map((track) => (
            <div key={track.title} className="flex flex-col rounded-2xl border border-gray-800 bg-black/40 p-6">
              <h2 className="text-xl font-semibold text-white">{track.title}</h2>
              <ul className="mt-4 space-y-3 text-sm text-gray-300">
                {track.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span className="mt-0.5 text-orange-400">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <Link href={track.cta.href} className="mt-6 text-sm font-semibold text-orange-400 hover:text-orange-300">
                {track.cta.label} →
              </Link>
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">What leadership actually looks like</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-gray-300">
              <p>
                The category leader in agentic systems will not be the loudest site. It will be the one with the clearest frameworks,
                strongest failure analysis, best comparative evaluations, and most useful operator-grade artifacts.
              </p>
              <p>
                Rare Agent Work already has the right bones: research, model comparisons, and agent-readable surfaces.
                The next step is to make the site more navigable for humans, more structured for agents, and more explicit about implementation outcomes.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Recommended path</p>
            <ol className="mt-4 space-y-4 text-sm text-gray-300">
              <li>1. Start with the setup guide.</li>
              <li>2. Follow the live news feed for platform drift.</li>
              <li>3. Read the operator reports for deeper evaluations.</li>
              <li>4. Use an assessment before scaling or buying tools.</li>
            </ol>
            <div className="mt-6 space-y-3">
              <Link href="/reports/empirical-architecture" className="block rounded-xl border border-gray-700 px-4 py-3 text-sm font-medium text-white hover:border-gray-500">
                Read the empirical report
              </Link>
              <Link href="/news" className="block rounded-xl border border-gray-700 px-4 py-3 text-sm font-medium text-white hover:border-gray-500">
                Track platform changes
              </Link>
              <Link href="/assessment" className="block rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700">
                Request an assessment
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
