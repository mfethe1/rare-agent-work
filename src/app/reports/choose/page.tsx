import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Choose the Right Report',
  description: 'A fast guide to choosing the right Rare Agent Work report based on your current stage, problem, and team needs.',
};

const options = [
  {
    title: 'I need to launch my first real workflow',
    fit: 'Best for founders, operators, and non-technical teams that need a practical first win without overbuilding.',
    href: '/reports/agent-setup-60',
    cta: 'Start with Agent Setup in 60 Minutes',
  },
  {
    title: 'I already have one agent and coordination is becoming the real problem',
    fit: 'Best for engineering teams adding roles, memory, orchestration, and multi-agent structure.',
    href: '/reports/single-to-multi-agent',
    cta: 'Start with From Single Agent to Multi-Agent',
  },
  {
    title: 'I need evaluation, governance, and defensible standards',
    fit: 'Best for technical leaders, architects, and teams making production decisions that need to survive scrutiny.',
    href: '/reports/empirical-agent-architecture',
    cta: 'Start with the Empirical Research Edition',
  },
];

export default function ChooseReportPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <BreadcrumbJsonLd items={[{ name: 'Home', url: 'https://rareagent.work' }, { name: 'Reports', url: 'https://rareagent.work/reports' }, { name: 'Choose', url: 'https://rareagent.work/reports/choose' }]} />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Report chooser</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Pick the right report in under a minute.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            If you are not sure where to start, choose based on the problem you have right now — not the most advanced-sounding title.
          </p>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {options.map((option) => (
            <article key={option.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-semibold text-white">{option.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">{option.fit}</p>
              <Link href={option.href} className="mt-6 inline-flex rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                {option.cta}
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-2xl font-semibold text-white">Still not sure?</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            If the problem is messy, political, or tied to a buying decision, skip the guessing and use the assessment path instead.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/assessment" className="rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Request assessment</Link>
            <Link href="/reports" className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Browse all reports</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
