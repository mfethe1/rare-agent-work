import type { Metadata } from 'next';
import Link from 'next/link';
import ConsultingForm from '@/components/ConsultingForm';
import { BreadcrumbJsonLd } from '@/components/JsonLd';
import { consultingPackages, trustControlBullets } from '@/lib/site-copy';

export const metadata: Metadata = {
  title: 'Agentic System Assessment',
  description:
    'Request an assessment for your agentic system, AI workflow, or multi-agent stack. Get help with setup, reliability, orchestration, safety, and rollout design.',
  keywords: [
    'agentic system assessment',
    'AI agent consulting',
    'multi-agent consulting',
    'agent reliability audit',
    'agent architecture review',
  ],
  alternates: {
    canonical: 'https://rareagent.work/assessment',
  },
  openGraph: {
    title: 'Agentic System Assessment | Rare Agent Work',
    description:
      'For teams that need a practical review of their agent strategy, stack, failure modes, and next implementation steps.',
    url: 'https://rareagent.work/assessment',
    siteName: 'Rare Agent Work',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Agentic System Assessment' }],
  },
};

const useCases = [
  'You have prototypes, but no reliable path to production.',
  'Your agents work in demos and fail under real permissions, retries, or messy data.',
  'You need a model-routing, memory, and tooling plan before spending more on platform sprawl.',
  'You want an outside view on what to automate first and what not to automate yet.',
];

export default function AssessmentPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Assessment', url: 'https://rareagent.work/assessment' },
        ]}
      />

      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-[#0d0d0d]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold tracking-tight text-orange-500">Rare Agent Work</Link>
            <div className="hidden items-center gap-4 sm:flex">
              <Link href="/start-here" className="text-sm text-gray-400 hover:text-white">Start Here</Link>
              <Link href="/news" className="text-sm text-gray-400 hover:text-white">News Feed</Link>
              <Link href="/docs" className="text-sm text-gray-400 hover:text-white">Docs</Link>
              <Link href="/assessment" className="text-sm font-medium text-white">Assessment</Link>
            </div>
          </div>
          <Link href="/reports" className="rounded-md border border-gray-700 px-3 py-2 text-xs font-semibold text-white hover:border-gray-500">
            Browse reports
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">Assessment</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Bring us the messy version</h1>
              <p className="mt-4 text-base leading-7 text-gray-400">
                The useful work starts where generic AI advice stops: unclear ownership, brittle tools, duplicate actions,
                bad memory, weak observability, and expensive orchestration choices.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Best fit</p>
              <ul className="mt-4 space-y-3 text-sm text-gray-300">
                {useCases.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-0.5 text-orange-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5 text-sm text-gray-300">
              <p className="font-semibold text-white">What you should include</p>
              <p className="mt-3">
                Current stack, team size, tools, biggest failure modes, desired business outcome, budget range, and timeline.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Trust controls</p>
              <div className="mt-4 space-y-3 text-sm text-gray-300">
                {trustControlBullets.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5 text-sm text-slate-200">
              <p className="font-semibold text-white">Need team or procurement-friendly access?</p>
              <p className="mt-3">
                If this review is for multiple stakeholders, an internal working group, or an enterprise buying process, use the team path and mention that in your request.
              </p>
              <Link href="/enterprise" className="mt-4 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open enterprise overview →</Link>
            </div>
          </aside>

          <section className="rounded-3xl border border-gray-800 bg-black/50 p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">Request an agentic systems review</h2>
              <p className="mt-2 text-sm text-gray-400">
                Use this if you want help with setup, hardening, orchestration, memory architecture, evaluations, or rollout planning.
              </p>
            </div>
            <ConsultingForm />

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {consultingPackages.map((pkg) => (
                <div key={pkg.name} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">{pkg.price}</p>
                  <h3 className="mt-2 text-base font-semibold text-white">{pkg.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-400">{pkg.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
