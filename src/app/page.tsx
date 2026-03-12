import Image from 'next/image';
import Link from 'next/link';
import BuyButton from '@/components/BuyButton';
import { WebsiteJsonLd } from '@/components/JsonLd';
import { getAllReports } from '@/lib/reports';

const liveNowItems = [
  {
    title: 'Live News Desk',
    description: 'Operator-grade AI agent news with context, freshness, and sharp filtering for real builders.',
    href: '/news',
    status: 'Live now',
  },
  {
    title: 'Implementation Reports',
    description: 'Playbooks and reference material for teams shipping serious agent systems.',
    href: '/reports',
    status: 'Live now',
  },
  {
    title: 'Subscriptions',
    description: 'Newsletter and operator access tiers for continuous intelligence and deeper support.',
    href: '/pricing',
    status: 'Live now',
  },
  {
    title: 'Consulting + Assessment',
    description: 'Direct strategy, architecture review, implementation rescue, and scoped decision support.',
    href: '/assessment',
    status: 'Live now',
  },
  {
    title: 'Trusted Agent Network',
    description: 'Curated network surface for high-trust specialist matching — selective, not marketplace-style.',
    href: '/network',
    status: 'In flight',
  },
];

const capabilityRows = [
  {
    capability: 'Operator intelligence',
    includes: 'Live news, filtering, synthesis, and operator summaries',
    bestFor: 'Teams tracking fast-moving agent changes',
    mode: 'Live now',
  },
  {
    capability: 'Implementation playbooks',
    includes: 'Deep reports, architecture guidance, and delivery patterns',
    bestFor: 'Builders choosing what to ship next',
    mode: 'Live now',
  },
  {
    capability: 'Curated expert matching',
    includes: 'Human-reviewed intake and selective routing',
    bestFor: 'High-trust work needing the right specialist',
    mode: 'Beta',
  },
  {
    capability: 'Workflow design',
    includes: 'Scoping, systems design, and implementation rescue',
    bestFor: 'Teams with real blockers and delivery pressure',
    mode: 'Live now',
  },
  {
    capability: 'Trust + risk review',
    includes: 'Human review, scoped engagement, and execution boundaries',
    bestFor: 'Sensitive or politically risky deployments',
    mode: 'Live now',
  },
];

const proofItems = [
  'Live news, reports, pricing, and network surfaces are already public and usable.',
  'Assessment and consulting paths already support direct inbound work.',
  'Submit Work is being introduced as a tightly-scoped, curated beta rather than an open marketplace.',
];

const submitSteps = [
  'Share the request type, constraints, urgency, and the work you need help shipping.',
  'A human reviews fit, trust boundaries, and whether the problem belongs in this beta.',
  'You get a curated next step: scoped guidance, specialist match, or direct consulting path.',
  'Any later execution remains brokered and human-approved — never automatic.',
];

export default function Home() {
  const reports = getAllReports().slice(0, 3);

  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <WebsiteJsonLd />

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[24rem] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-5rem] h-[26rem] w-[26rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(5,8,22,0.96),rgba(3,6,18,1))]" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
                <Image src="/logo-medallion.jpg" alt="Rare Agent Work logo" fill className="object-cover" sizes="40px" priority />
              </div>
              <div>
                <span className="block text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/90">Rare Agent</span>
                <span className="block text-base font-bold tracking-tight text-white">Work</span>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/news" className="text-xs text-slate-400 transition-colors hover:text-white sm:text-sm">News</Link>
              <Link href="/reports" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Reports</Link>
              <Link href="/network" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Network</Link>
              <Link href="/assessment" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Assessment</Link>
              <Link href="/book-demo" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Book Strategy Call</Link>
              <Link
                href="/submit-work"
                className="ml-1 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-all hover:border-cyan-200 hover:bg-cyan-400/20 sm:px-4 sm:text-sm"
              >
                Submit Work
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-white/5 px-4 py-2 text-sm text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
              Curated matching beta · human-reviewed
            </div>

            <h1 className="mt-8 max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Ship high-trust agent systems faster.
            </h1>

            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300 md:text-xl">
              Get operator intelligence, implementation playbooks, and curated expert matching without marketplace noise.
              Rare Agent Work is built for teams that need judgment, trust boundaries, and real shipping support.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link href="/submit-work" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-7 py-4 text-base font-semibold text-slate-950 shadow-[0_16px_50px_rgba(34,211,238,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-cyan-300">
                Submit Work (Beta)
              </Link>
              <Link href="/news" className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-7 py-4 text-base font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20">
                Explore Live News
              </Link>
              <Link href="/book-demo" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10">
                Book Strategy Call
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm shadow-[0_20px_70px_rgba(5,8,22,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">What’s live right now</p>
            <div className="mt-5 grid gap-4">
              {liveNowItems.slice(0, 3).map((item) => (
                <div key={item.title} className="rounded-[1.25rem] border border-white/10 bg-[#07111f]/80 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">{item.status}</p>
                    <Link href={item.href} className="text-sm text-cyan-300 hover:text-cyan-200">Open →</Link>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">What’s live now</p>
              <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">The business is already shipping — submit-work is additive.</h2>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-5">
            {liveNowItems.map((item) => (
              <article key={item.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{item.status}</p>
                <h3 className="mt-3 text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
                <Link href={item.href} className="mt-5 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open this surface →</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Agentic layer capability table</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">What exists now vs what’s entering beta</h2>
          <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.04] text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Capability</th>
                  <th className="px-4 py-3 font-semibold">What it includes</th>
                  <th className="px-4 py-3 font-semibold">Best for</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {capabilityRows.map((row) => (
                  <tr key={row.capability} className="bg-black/10">
                    <td className="px-4 py-4 font-semibold text-white">{row.capability}</td>
                    <td className="px-4 py-4 text-slate-300">{row.includes}</td>
                    <td className="px-4 py-4 text-slate-300">{row.bestFor}</td>
                    <td className="px-4 py-4 text-cyan-300">{row.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">In-flight proof</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Real surfaces, real intent, no fake marketplace theater.</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
              This site is already operating as a trust-first front door for research, consulting, and curated discovery.
              The beta is narrowing and clarifying that motion, not inventing it from scratch.
            </p>
          </div>
          <div className="grid gap-4">
            {proofItems.map((item, index) => (
              <div key={item} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Proof {index + 1}</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">How submit work works</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">A curated, human-reviewed intake — not a marketplace.</h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Submit Work is for architecture review, implementation rescue, and curated specialist matching.
              Every request is reviewed by a human before any next step is proposed.
            </p>
            <Link href="/submit-work" className="mt-6 inline-flex rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
              Open /submit-work
            </Link>
          </div>
          <div className="grid gap-4">
            {submitSteps.map((step, index) => (
              <div key={step} className="rounded-[1.25rem] border border-white/10 bg-[#07111f]/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Step {index + 1}</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-sky-500/5 to-fuchsia-500/10 p-8 backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Trust + security</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              'Human review before any external side effects',
              'No credential intake and no autonomous execution against client systems',
              'Discovery now, brokered execution later',
              'Selective matching, scoped work, and explicit trust boundaries',
            ].map((item) => (
              <div key={item} className="rounded-[1.25rem] border border-white/10 bg-[#07111f]/70 p-5 text-sm leading-7 text-slate-200">{item}</div>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Pricing + engagement</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Choose the right depth of engagement.</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Free</span>
              <p className="mt-1 text-3xl font-bold text-white">$0</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">Browse live news, report previews, and get a feel for the operator layer.</p>
              <Link href="/news" className="mt-5 inline-flex rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">Start free</Link>
            </div>
            <div className="rounded-[1.75rem] border border-fuchsia-400/30 bg-fuchsia-500/10 p-7 backdrop-blur-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200">Newsletter</span>
              <p className="mt-1 text-3xl font-bold text-white">$10/mo</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">Signal, summaries, and operator context without the noise.</p>
              <BuyButton plan="newsletter" label="Subscribe — $10/mo" className="mt-5 inline-flex rounded-full bg-fuchsia-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-fuchsia-300" />
            </div>
            <div className="rounded-[1.75rem] border border-cyan-400/30 bg-cyan-500/10 p-7 backdrop-blur-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Engage</span>
              <p className="mt-1 text-3xl font-bold text-white">Scoped</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">Use assessment, strategy calls, or submit-work beta for high-trust implementation help.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/assessment" className="inline-flex rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Open assessment</Link>
                <Link href="/submit-work" className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Submit work</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Reference layer</p>
              <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Reports still anchor the durable knowledge layer.</h2>
            </div>
            <Link href="/reports" className="hidden text-sm font-semibold text-cyan-300 hover:text-cyan-200 sm:inline-flex">Browse all reports →</Link>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {reports.map((report) => (
              <article key={report.slug} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{report.priceLabel}</p>
                <h3 className="mt-3 text-xl font-bold text-white">{report.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{report.subtitle}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={`/reports/${report.slug}`} className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Read preview</Link>
                  <BuyButton plan={report.planKey} label={`Buy — ${report.price}`} className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300" />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Final CTA</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Bring a real problem. Get a scoped next step in under 24 hours.</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-300">
            Start with Submit Work for curated review, or book a strategy call if the problem needs direct discussion first.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/submit-work" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-7 py-4 text-base font-semibold text-slate-950 hover:bg-cyan-300">
              Submit Work (Beta)
            </Link>
            <Link href="/book-demo" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white hover:bg-white/10">
              Book Strategy Call
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-10 text-center text-sm text-slate-400">
        <p className="mb-3">© {new Date().getFullYear()} Rare Agent Work. High-trust agent intelligence, consulting, and curated implementation support.</p>
        <div className="mb-3 flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/submit-work" className="transition-colors hover:text-white">Submit Work</Link>
          <span className="text-white/20">·</span>
          <Link href="/news" className="transition-colors hover:text-white">News</Link>
          <span className="text-white/20">·</span>
          <Link href="/reports" className="transition-colors hover:text-white">Reports</Link>
          <span className="text-white/20">·</span>
          <Link href="/network" className="transition-colors hover:text-white">Network</Link>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/pricing" className="transition-colors hover:text-white">Pricing</Link>
          <span className="text-white/20">·</span>
          <Link href="/assessment" className="transition-colors hover:text-white">Assessment</Link>
          <span className="text-white/20">·</span>
          <a href="mailto:hello@rareagent.work" className="transition-colors hover:text-white">hello@rareagent.work</a>
        </div>
      </footer>
    </div>
  );
}
