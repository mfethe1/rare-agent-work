import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'About Rare Agent Work',
  description: 'Who Rare Agent Work is for, how the research is produced, and why the product is built around trust, implementation quality, and operator-grade judgment.',
};

const principles = [
  'Operator-grade over hype-grade: we optimize for implementation usefulness, not applause lines.',
  'Trust boundaries are product features: human review, scoped work, and explicit control points matter.',
  'Research must earn authority: freshness, citations, and methodology should be visible, not implied.',
  'Agent-native surfaces deserve first-class treatment: APIs, docs, and machine-readable context are part of the product.',
];

const whatWeDo = [
  'Curate high-signal AI and agent-system news for serious builders.',
  'Publish implementation reports that compress months of platform, architecture, and governance learning.',
  'Help teams make better build-vs-buy, rollout, and reliability decisions before they waste expensive cycles.',
  'Create a trust-first path for consulting, architecture review, and curated specialist matching.',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <BreadcrumbJsonLd items={[{ name: 'Home', url: 'https://rareagent.work' }, { name: 'About', url: 'https://rareagent.work/about' }]} />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">About</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Rare Agent Work exists to make serious agent work easier to trust and easier to ship.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            We are building a research, implementation, and decision-support layer for teams working on AI systems that have to survive real constraints: messy permissions,
            brittle tools, unclear ownership, governance pressure, and expensive architecture choices.
          </p>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold text-white">What we do</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
              {whatWeDo.map((item) => (
                <li key={item} className="flex gap-3"><span className="mt-0.5 text-cyan-300">•</span><span>{item}</span></li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
            <h2 className="text-2xl font-semibold text-white">Who it is for</h2>
            <div className="mt-5 grid gap-3 text-sm text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">Founders and operators trying to ship the first real workflow without creating silent chaos.</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">Engineering teams choosing frameworks, memory layers, and evaluation paths with real production consequences.</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">Technical leaders who need governance, methodology, and rollout discipline — not just more demos.</div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-semibold text-white">Operating principles</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {principles.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-300">{item}</div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold text-white">What makes this different</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Most AI content either sells generic optimism or collapses into implementation trivia. Rare Agent Work is trying to occupy the harder middle:
              opinionated enough to be useful, rigorous enough to be defensible, and commercial enough to help teams actually move.
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-300">
              <p className="font-semibold text-white">Operator point of view</p>
              <p className="mt-2">
                Michael Fethe’s perspective matters here because the product is not pretending to be neutral content infrastructure. It is deliberately shaped around shipping, trust boundaries, and practical implementation pressure.
              </p>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Next best step</p>
            <div className="mt-4 space-y-3">
              <Link href="/methodology" className="block rounded-full bg-cyan-400 px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-300">Review methodology</Link>
              <Link href="/reports" className="block rounded-full border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/10">Browse reports</Link>
              <Link href="/assessment" className="block rounded-full border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/10">Request assessment</Link>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
