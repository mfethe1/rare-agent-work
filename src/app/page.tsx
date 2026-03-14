import Image from 'next/image';
import Link from 'next/link';
import BuyButton from '@/components/BuyButton';
import { WebsiteJsonLd } from '@/components/JsonLd';
import { getAllReports } from '@/lib/reports';
import { operatorProofStats, startHereRoutes, trustControlBullets } from '@/lib/site-copy';

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
  'Every public report includes citations, freshness timestamps, explicit risks, and preview content before purchase.',
  'The public API already exposes agent-readable news, report metadata, NL query, OpenAPI, RSS, and discovery manifests.',
  'Submit Work, consulting, and network surfaces state their trust boundaries instead of implying hidden automation.',
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
            <Link href="/" className="flex items-center gap-3 flex-shrink-0">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
                <Image src="/logo-medallion.jpg" alt="Rare Agent Work logo" fill className="object-cover" sizes="40px" priority />
              </div>
              <div>
                <span className="block text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/90">Rare Agent</span>
                <span className="block text-base font-bold tracking-tight text-white">Work</span>
              </div>
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              <Link href="/reports" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">Reports</Link>
              <Link href="/news" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">News</Link>
              <Link href="/assessment" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">Consulting</Link>
              <Link href="/docs" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">Docs</Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/reports" className="hidden text-sm font-medium text-slate-300 transition-colors hover:text-white sm:block md:hidden">Reports</Link>
              <Link href="/news" className="text-sm font-medium text-slate-300 transition-colors hover:text-white sm:hidden">News</Link>
              <Link
                href="/reports"
                className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition-all hover:border-cyan-200 hover:bg-cyan-400/20"
              >
                View Reports
              </Link>
              <Link
                href="/assessment"
                className="hidden rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-cyan-300 sm:inline-flex"
              >
                Work With Us
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
              For engineering teams shipping production AI agents
            </div>

            <h1 className="mt-8 max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Research, consulting, and APIs for teams building serious agent systems.
            </h1>

            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300 md:text-xl">
              Operator-grade reports, a live AI news desk, and direct consulting paths — without the generic AI content noise.
              Buy a concrete playbook, bring a hard implementation problem, or integrate the public API into your stack.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link href="/reports" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-7 py-4 text-base font-semibold text-slate-950 shadow-[0_16px_50px_rgba(34,211,238,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-cyan-300">
                Browse Reports
              </Link>
              <Link href="/assessment" className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-7 py-4 text-base font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20">
                Talk to a Consultant
              </Link>
              <Link href="/news" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10">
                Live News →
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm shadow-[0_20px_70px_rgba(5,8,22,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">What you get</p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[1.25rem] border border-white/10 bg-[#07111f]/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Implementation reports</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">3 playbooks</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">Full preview before purchase. Cited sources, explicit risks, and action steps — not blog posts.</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-[#07111f]/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Live consulting path</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Human-reviewed</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">Architecture review, implementation rescue, and strategy calls. No automated intake theater.</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-[#07111f]/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Public API surfaces</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">5 endpoints</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">OpenAPI-documented news, reports, models, NL query, and discovery manifests for agent integration.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 rounded-[2rem] border border-cyan-300/20 bg-cyan-400/[0.06] p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Start here</p>
              <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Choose the right first click.</h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                The site has multiple surfaces because it serves different jobs. This section removes the guesswork.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {startHereRoutes.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-[1.25rem] border border-white/10 bg-[#07111f]/80 p-5 transition-colors hover:border-cyan-300/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{item.badge}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p>
                  <span className="mt-4 inline-flex text-sm font-semibold text-cyan-300">Open route →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">What’s live now</p>
              <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Every surface is live and available now.</h2>
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
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">How it works</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Transparent process. Visible methodology. No black boxes.</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
              Research, consulting, and API surfaces built for operators who need to trust what they&apos;re buying.
              Citations are visible before purchase. Every consulting intake is human-reviewed. No opaque automation.
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

        <section className="mt-20 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Trust controls</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Visible process beats vague trust language.</h2>
            <div className="mt-6 grid gap-3">
              {trustControlBullets.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-[#07111f]/80 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">For buyers with real stakes</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
              <p>Research buyers can start with previews and one-time reports.</p>
              <p>Consultants can use reports and docs as a working evidence pack for proposals and delivery alignment.</p>
              <p>Enterprise teams can start with an assessment or submit-work intake when governance and ownership are part of the problem.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pricing" className="inline-flex rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Compare plans</Link>
              <Link href="/docs" className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Open docs</Link>
            </div>
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

        <section className="mt-20 grid gap-6 lg:grid-cols-3">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Trust scaffolding</p>
            <h2 className="mt-3 text-2xl font-bold text-white">See how the research is produced.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">If you want to know who this is for, what standards the research follows, and how freshness is handled, start with the trust pages.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/about" className="inline-flex rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300">About</Link>
              <Link href="/methodology" className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Methodology</Link>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">For agents + builders</p>
            <h2 className="mt-3 text-2xl font-bold text-white">Use the machine-readable layer.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Rare Agent Work also exposes public APIs, OpenAPI, agent metadata, and llms.txt surfaces for agent-native use cases.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/docs" className="inline-flex rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Open docs</Link>
              <Link href="/api/v1/openapi.json" className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">OpenAPI</Link>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">For teams</p>
            <h2 className="mt-3 text-2xl font-bold text-white">Need team or enterprise access?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">If you need procurement-friendly access, shared report usage, or a scoped architecture review, use the team lane instead of a solo checkout flow.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/enterprise" className="inline-flex rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Team access</Link>
              <Link href="/assessment" className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Request assessment</Link>
            </div>
          </article>
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
              <p className="mt-3 text-sm leading-7 text-slate-200">Assessment, strategy calls, and curated specialist matching for high-trust implementation work.</p>
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
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Get started today</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Bring a real problem. Get a concrete next step within 24 hours.</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-300">
            Every engagement starts with a human review. Start with a strategy call if you want to talk it through first.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/assessment" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-7 py-4 text-base font-semibold text-slate-950 hover:bg-cyan-300">
              Start an Assessment
            </Link>
            <Link href="/book-demo" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white hover:bg-white/10">
              Book a Strategy Call
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
