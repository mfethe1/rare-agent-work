import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Methodology | Rare Agent Work',
  description: 'How Rare Agent Work evaluates sources, updates reports, thinks about freshness, and distinguishes synthesis from implementation judgment.',
};

const standards = [
  {
    title: 'Freshness is explicit',
    body: 'Reports and public surfaces should carry visible update timestamps. If a surface matters operationally, recency should not be hidden in the codebase.',
  },
  {
    title: 'Synthesis is not enough',
    body: 'The goal is not to summarize public AI chatter. The goal is to compress tradeoffs, failure modes, and implementation consequences into something operators can actually use.',
  },
  {
    title: 'Trust boundaries are named',
    body: 'Where human review exists, we say so. Where autonomous execution does not exist, we say so. Ambiguity around control is a reliability bug.',
  },
  {
    title: 'Machine-readable access matters',
    body: 'If agents are a real audience, API docs, OpenAPI, llms.txt, and agent cards should not feel like afterthoughts.',
  },
];

const process = [
  'Track high-signal developments in AI, agent tooling, frameworks, governance, and deployment behavior.',
  'Filter for changes that affect operators, implementers, or technical decision-makers.',
  'Synthesize the practical implication: what changed, why it matters, and what a serious team should do next.',
  'Package learning into reports, public docs, and assessment-ready guidance that can survive scrutiny.',
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <BreadcrumbJsonLd items={[{ name: 'Home', url: 'https://rareagent.work' }, { name: 'Methodology', url: 'https://rareagent.work/methodology' }]} />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Methodology</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">How Rare Agent Work turns AI noise into operator-grade guidance.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            We care less about being first than about being useful. That means preferring decision quality, implementation relevance, and explicit trust boundaries over generic commentary.
          </p>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold text-white">Research process</h2>
            <ol className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
              {process.map((item, index) => (
                <li key={item} className="flex gap-3"><span className="text-cyan-300">{index + 1}.</span><span>{item}</span></li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
            <h2 className="text-2xl font-semibold text-white">What this is not</h2>
            <div className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
              <p>Not a generic AI newsletter chasing headlines.</p>
              <p>Not a promise of fully autonomous magic where none exists.</p>
              <p>Not a substitute for real technical due diligence inside your team.</p>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {standards.map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/10 bg-black/25 p-6">
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-semibold text-white">Primary outputs</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">News surfaces for staying current on material changes.</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">Reports for durable implementation guidance and evaluation frameworks.</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">Assessment and consulting paths for teams that need direct judgment and scoped next steps.</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/docs" className="rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Open docs</Link>
            <Link href="/reports" className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Browse reports</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
