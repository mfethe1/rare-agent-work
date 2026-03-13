import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Enterprise & Team Access | Rare Agent Work',
  description: 'Team-friendly access for operator reports, architecture guidance, and scoped enterprise engagements.',
};

const needs = [
  'You need team access to reports or shared internal distribution.',
  'You want a credibility layer for governance, architecture, or rollout decisions.',
  'You need an outside review before standardizing frameworks or tooling choices.',
  'You want a scoped engagement instead of open-ended consulting sprawl.',
];

const offers = [
  'Team access and internal sharing path for current report catalog',
  'Architecture review and implementation-risk assessment',
  'Governance / evaluation framing for production AI systems',
  'Curated specialist matching when the problem needs the right operator, not a marketplace blast',
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <BreadcrumbJsonLd items={[{ name: 'Home', url: 'https://rareagent.work' }, { name: 'Enterprise', url: 'https://rareagent.work/enterprise' }]} />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Enterprise & team access</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">For teams that need more than a solo checkout flow.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Rare Agent Work can support team-oriented access, architecture guidance, and scoped engagements for organizations evaluating or deploying serious agent systems.
          </p>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold text-white">Common team needs</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
              {needs.map((item) => (
                <li key={item} className="flex gap-3"><span className="mt-0.5 text-cyan-300">•</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
            <h2 className="text-2xl font-semibold text-white">What we can offer</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
              {offers.map((item) => (
                <li key={item} className="flex gap-3"><span className="mt-0.5 text-cyan-200">•</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-2xl font-semibold text-white">Best next step</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            If you need team licenses, procurement-friendly access, or a scoped review of your agent architecture, use the assessment path and mention team size, stakeholders, and what decision you need to make.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/assessment" className="rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Request team assessment</Link>
            <Link href="/reports" className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Browse reports</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
