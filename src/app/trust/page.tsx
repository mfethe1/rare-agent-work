import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';
import { trustControlBullets } from '@/lib/site-copy';

export const metadata: Metadata = {
  title: 'Trust Controls',
  description:
    'Process visibility for Rare Agent Work intake flows, consulting paths, network matching, and public agent-facing surfaces.',
  alternates: {
    canonical: 'https://rareagent.work/trust',
  },
  openGraph: {
    title: 'Trust Controls | Rare Agent Work',
    description:
      'See the explicit trust boundaries, review process, and handling rules behind Rare Agent Work service and API surfaces.',
    url: 'https://rareagent.work/trust',
    siteName: 'Rare Agent Work',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Rare Agent Work Trust Controls' }],
  },
};

const processSteps = [
  'Public forms are for scoping and triage, not privileged execution.',
  'Every service request is reviewed by a human before any recommendation or match is made.',
  'Sensitive work is routed into a scoped consulting or review process before execution is discussed.',
  'Discovery files and public APIs expose read-only research surfaces, not hidden task execution.',
];

const surfaceRows = [
  {
    surface: '/submit-work',
    purpose: 'Architecture review, implementation rescue, or curated specialist matching.',
    control: 'No credentials, no autonomous client-side execution, human review required.',
  },
  {
    surface: '/assessment',
    purpose: 'Consulting and technical review for messy deployments.',
    control: 'Operator-led intake with scoped follow-up rather than open-ended promises.',
  },
  {
    surface: '/network',
    purpose: 'Trust-first discovery layer for operator introductions.',
    control: 'Manual curation over open marketplace mechanics.',
  },
  {
    surface: '/api/v1/*',
    purpose: 'Read-only machine-readable research, news, and discovery.',
    control: 'Public endpoints with explicit docs, discovery manifests, and no hidden auth path.',
  },
];

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Trust Controls', url: 'https://rareagent.work/trust' },
        ]}
      />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Trust controls</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Trust is process visibility, not adjectives.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Rare Agent Work sells into high-stakes AI work, so the site should show how requests are handled, what public
            surfaces do, and where the boundaries are. This page is the compact version.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {trustControlBullets.map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-7 text-slate-200">
              {item}
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Review sequence</p>
            <ol className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              {processSteps.map((step, index) => (
                <li key={step}>
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Surface-by-surface controls</p>
            <div className="mt-5 space-y-4">
              {surfaceRows.map((row) => (
                <div key={row.surface} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{row.surface}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{row.purpose}</p>
                  <p className="mt-2 text-sm leading-6 text-cyan-200">{row.control}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Next actions</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/submit-work" className="inline-flex rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
              Open submit-work
            </Link>
            <Link href="/docs" className="inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5">
              Open public docs
            </Link>
            <Link href="/assessment" className="inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5">
              Request assessment
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
