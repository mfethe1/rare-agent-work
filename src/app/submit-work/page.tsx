import type { Metadata } from 'next';
import Link from 'next/link';
import SubmitWorkForm from '@/components/SubmitWorkForm';
import { BreadcrumbJsonLd, FAQJsonLd, ServiceJsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Submit Work (Beta)',
  description:
    'Submit scoped AI agent work for human-reviewed architecture review, implementation rescue, or curated specialist matching.',
  alternates: { canonical: 'https://rareagent.work/submit-work' },
  openGraph: {
    title: 'Submit Work (Beta) | Rare Agent Work',
    description:
      'A brokered discovery intake for high-trust agent work: human-reviewed, curated, and explicitly not a marketplace.',
    url: 'https://rareagent.work/submit-work',
    siteName: 'Rare Agent Work',
    type: 'website',
  },
};

const faq = [
  {
    question: 'What can I submit?',
    answer: 'This beta only accepts Architecture Review, Implementation Rescue, and Curated Specialist Match requests.',
  },
  {
    question: 'Is this a marketplace or open bidding flow?',
    answer: 'No. This is a curated, human-reviewed intake for scoped work and selective matching.',
  },
  {
    question: 'Will you execute directly against my systems?',
    answer: 'No. This intake is for discovery and review only. Any later execution would be separately scoped and human-approved.',
  },
];

export default function SubmitWorkPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <BreadcrumbJsonLd items={[{ name: 'Home', url: 'https://rareagent.work' }, { name: 'Submit Work', url: 'https://rareagent.work/submit-work' }]} />
      <ServiceJsonLd
        name="Submit Work Beta"
        description="Human-reviewed intake for architecture review, implementation rescue, and curated specialist matching."
        url="https://rareagent.work/submit-work"
        serviceType="AI agent consulting and specialist matching"
      />
      <FAQJsonLd questions={faq} />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Curated matching beta</p>
            <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">Submit serious work for human-reviewed triage.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              This is a brokered discovery intake for teams that need architecture review, implementation rescue,
              or curated specialist matching. It is selective by design and explicitly not a marketplace.
            </p>

            <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5 text-sm leading-7 text-cyan-100">
              <strong>Trust boundary:</strong> no credential intake, no direct autonomous execution against client systems,
              discovery now and brokered execution later, with human review before external side effects.
            </div>

            <div className="mt-8 grid gap-4">
              {[
                'Architecture Review',
                'Implementation Rescue',
                'Curated Specialist Match',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">{item}</div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">How review works</p>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <li>1. You submit the work type, context, and constraints.</li>
                <li>2. We review fit, trust boundaries, urgency, and scope.</li>
                <li>3. If it fits, you get a curated next step within 24 hours.</li>
              </ol>
            </div>

            <p className="mt-6 text-sm text-slate-400">
              Prefer to talk first? <Link href="/book-demo" className="text-cyan-300 hover:text-cyan-200">Book a strategy call</Link>.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <SubmitWorkForm />
          </div>
        </section>
      </main>
    </div>
  );
}
