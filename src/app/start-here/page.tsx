import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';
import { integrationPatterns, operatorProofStats, startHereRoutes } from '@/lib/site-copy';
import SiteNav from '@/components/SiteNav';

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
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Start Here', url: 'https://rareagent.work/start-here' },
        ]}
      />

      <SiteNav
        primaryCta={{ label: 'Get an Assessment', href: '/assessment' }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-14rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-[30rem] h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/8 blur-3xl" />
      </div>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Start here</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            The shortest path from AI curiosity to a production-grade agentic system
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-400">
            Most teams jump straight into frameworks and demos. The teams that win get the operating order right:
            pick the workflow, define the failure budget, instrument the system, then scale it.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-4">
          {operatorProofStats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{item.label}</h2>
              <p className="mt-3 text-3xl font-bold text-white">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-4">
          {startHereRoutes.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-5 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/[0.08]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{item.badge}</p>
              <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200">Open →</span>
            </Link>
          ))}
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-3">
          {tracks.map((track) => (
            <div key={track.title} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-6">
              <h2 className="text-xl font-semibold text-white">{track.title}</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {track.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <Link href={track.cta.href} className="mt-6 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                {track.cta.label} →
              </Link>
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Working principles</p>
            <div className="mt-5 grid gap-4">
              {principles.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">If you are integrating Rare Agent Work into a workflow</p>
            <div className="mt-5 space-y-4">
              {integrationPatterns.map((item) => (
                <div key={item.title} className="rounded-2xl border border-cyan-400/15 bg-black/20 p-4">
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">What leadership actually looks like</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
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

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recommended path</p>
            <ol className="mt-4 space-y-4 text-sm text-slate-300">
              <li>1. Start with the setup guide.</li>
              <li>2. Follow the live news feed for platform drift.</li>
              <li>3. Read the operator reports for deeper evaluations.</li>
              <li>4. Use an assessment before scaling or buying tools.</li>
            </ol>
            <div className="mt-6 space-y-3">
              <Link href="/reports/empirical-agent-architecture" className="block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.07]">
                Read the empirical report →
              </Link>
              <Link href="/news" className="block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.07]">
                Track platform changes →
              </Link>
              <Link href="/assessment" className="block rounded-full bg-cyan-400 px-4 py-3 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300">
                Request an assessment
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t border-white/10 py-8 text-center text-xs text-slate-600">
        <p>
          © {new Date().getFullYear()} Rare Agent Work ·{' '}
          <Link href="/" className="hover:text-slate-400 transition-colors">Home</Link>
          {' · '}
          <Link href="/reports" className="hover:text-slate-400 transition-colors">Reports</Link>
          {' · '}
          <Link href="/about" className="hover:text-slate-400 transition-colors">About</Link>
        </p>
      </footer>
    </div>
  );
}
