import Image from 'next/image';
import Link from 'next/link';
import BuyButton from '@/components/BuyButton';

import { WebsiteJsonLd } from '@/components/JsonLd';
import { getAllReports } from '@/lib/reports';

const trustSignals = [
  { icon: '🔍', label: 'Full preview before purchase', detail: 'Read methodology, citations, risks, and sample content before spending a dollar.' },
  { icon: '📎', label: 'Cited sources on every report', detail: 'Every recommendation traces to a verifiable source, not the author\'s opinion.' },
  { icon: '⚡', label: 'One-time purchase, yours permanently', detail: 'No subscription required. Buy once, download, use forever.' },
  { icon: '🛡️', label: 'Human review on consulting intake', detail: 'Every consulting request is read by a human before any next step is proposed.' },
];

const howItWorks = [
  {
    step: '01',
    title: 'Read the preview for free',
    body: 'Every report ships with a full preview: executive summary, sample sections, citations, action steps, and explicit risks. Enough to judge fit before you buy.',
  },
  {
    step: '02',
    title: 'Buy once, use immediately',
    body: 'One-time purchase. No subscription required. The full report unlocks instantly with access to the AI implementation guide powered by Claude.',
  },
  {
    step: '03',
    title: 'Bring hard problems to consulting',
    body: 'When the report isn\'t enough — messy architecture, political blockers, live incidents — use the assessment path for direct human review.',
  },
];

const consultingServices = [
  {
    name: 'Operator Review',
    time: '48–72 hrs',
    description: 'Short diagnostic for stack fit, failure modes, and next actions when a team needs an outside read fast.',
    href: '/assessment',
  },
  {
    name: 'Implementation Rescue',
    time: 'Scoped engagement',
    description: 'For brittle workflows, orchestration drift, weak memory, or rollout stalls that need direct intervention.',
    href: '/assessment',
  },
  {
    name: 'Architecture Review',
    time: 'Strategy call',
    description: 'For teams aligning architecture, governance, vendor selection, and rollout sequencing across stakeholders.',
    href: '/book-demo',
  },
];

export default function Home() {
  const reports = getAllReports();

  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <WebsiteJsonLd />

      {/* Background ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-[-8rem] top-[30rem] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-5rem] h-[26rem] w-[26rem] rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_34%),linear-gradient(180deg,rgba(5,8,22,0.97),rgba(3,6,18,1))]" />
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 flex-shrink-0">
              <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
                <Image src="/logo-medallion.jpg" alt="Rare Agent Work logo" fill className="object-cover" sizes="36px" priority />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">Rare Agent Work</span>
            </Link>

            <div className="hidden items-center gap-7 md:flex">
              <Link href="/reports" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">Reports</Link>
              <Link href="/news" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">News</Link>
              <Link href="/assessment" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">Consulting</Link>
              <Link href="/docs" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">API Docs</Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/reports"
                className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition-all hover:border-cyan-200 hover:bg-cyan-400/20"
              >
                Browse Reports
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

      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-300/25 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90 shadow-[0_0_24px_rgba(34,211,238,0.07)]">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
            For engineering teams shipping production AI agents
          </div>

          <h1 className="mx-auto mt-7 max-w-5xl text-5xl font-black tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.25rem] lg:leading-[1.06]">
            Stop guessing.<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-400 bg-clip-text text-transparent"> Ship agents that actually work.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
            Operator-grade implementation playbooks for teams building real agent systems.
            Full preview before purchase. Cited sources. No generic AI content.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/reports"
              className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_16px_48px_rgba(34,211,238,0.25)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300 sm:w-auto"
            >
              Browse Reports — Free Preview →
            </Link>
            <Link
              href="/assessment"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Talk to a Consultant
            </Link>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Preview every report for free · One-time purchase · No subscription required
          </p>
        </section>

        {/* ── Trust signals row ──────────────────────────────────────── */}
        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trustSignals.map((signal) => (
            <div
              key={signal.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
            >
              <span className="text-2xl">{signal.icon}</span>
              <p className="mt-3 text-sm font-semibold text-white">{signal.label}</p>
              <p className="mt-1.5 text-xs leading-6 text-slate-400">{signal.detail}</p>
            </div>
          ))}
        </section>

        {/* ── Reports ────────────────────────────────────────────────── */}
        <section className="mt-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Implementation reports</p>
              <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
                Pick the playbook that matches your problem.
              </h2>
              <p className="mt-3 max-w-2xl text-base text-slate-400">
                Every report ships with a full free preview — methodology, citations, risks, and sample sections — before you spend a dollar.
              </p>
            </div>
            <Link href="/reports" className="hidden shrink-0 text-sm font-semibold text-cyan-300 hover:text-cyan-200 sm:inline-flex">
              All reports →
            </Link>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {reports.map((report) => {
              const accentMap: Record<string, string> = {
                blue: 'border-blue-500/30 hover:border-blue-400/50',
                green: 'border-green-500/30 hover:border-green-400/50',
                purple: 'border-purple-500/30 hover:border-purple-400/50',
                red: 'border-red-500/30 hover:border-red-400/50',
              };
              const badgeMap: Record<string, string> = {
                blue: 'text-blue-300 bg-blue-900/30 border border-blue-500/25',
                green: 'text-green-300 bg-green-900/30 border border-green-500/25',
                purple: 'text-purple-300 bg-purple-900/30 border border-purple-500/25',
                red: 'text-red-300 bg-red-900/30 border border-red-500/25',
              };
              const btnMap: Record<string, string> = {
                blue: 'bg-blue-600 hover:bg-blue-500 text-white',
                green: 'bg-green-600 hover:bg-green-500 text-white',
                purple: 'bg-purple-600 hover:bg-purple-500 text-white',
                red: 'bg-red-600 hover:bg-red-500 text-white',
              };
              const accent = accentMap[report.color] ?? accentMap.blue;
              const badge = badgeMap[report.color] ?? badgeMap.blue;
              const btn = btnMap[report.color] ?? btnMap.blue;

              return (
                <article
                  key={report.slug}
                  className={`group relative flex flex-col rounded-2xl border bg-white/[0.035] p-6 backdrop-blur-sm transition-all ${accent}`}
                >
                  {report.isNew && (
                    <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
                  )}
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${badge}`}>
                    {report.price}
                  </span>
                  <h3 className="mt-4 text-lg font-bold leading-snug text-white">{report.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{report.subtitle}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Best for: {report.bestFor.slice(0, 2).join(' · ')}
                  </p>
                  <div className="mt-auto pt-6 flex flex-col gap-2">
                    <Link
                      href={`/reports/${report.slug}`}
                      className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Read free preview →
                    </Link>
                    <BuyButton
                      plan={report.planKey}
                      label={`Buy — ${report.price}`}
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${btn}`}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────── */}
        <section className="mt-20 rounded-[2rem] border border-white/10 bg-white/[0.02] p-8 sm:p-10 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">How it works</p>
          <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
            No risk. Full transparency before you pay.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {howItWorks.map((item) => (
              <div key={item.step} className="flex gap-5">
                <span className="mt-0.5 shrink-0 text-3xl font-black text-cyan-300/40">{item.step}</span>
                <div>
                  <h3 className="text-base font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Newsletter CTA ─────────────────────────────────────────── */}
        <section className="mt-12 rounded-[2rem] border border-fuchsia-400/25 bg-fuchsia-500/[0.07] p-6 sm:p-8">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Newsletter — $10/mo</p>
              <h2 className="mt-2 text-xl font-bold text-white">Operator-grade AI signal, weekly.</h2>
              <p className="mt-1.5 text-sm text-slate-400">
                Curated AI agent news, platform changes, and implementation notes — without the noise.
              </p>
            </div>
            <BuyButton
              plan="newsletter"
              label="Subscribe — $10/mo"
              className="shrink-0 inline-flex rounded-full bg-fuchsia-400 px-6 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-fuchsia-300"
            />
          </div>
        </section>

        {/* ── Consulting ─────────────────────────────────────────────── */}
        <section className="mt-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Human consulting</p>
              <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
                When the report isn&apos;t enough.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-400">
                Architecture review, implementation rescue, and strategy calls for teams with real blockers.
                Every intake is reviewed by a human — no automated routing, no anonymous intake theater.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  'No credential intake in public forms.',
                  'Human review before any scoped next step.',
                  'No autonomous execution against client systems.',
                  'Scoped engagement with explicit boundaries.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="mt-0.5 text-cyan-400">✓</span>
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/assessment" className="inline-flex rounded-full bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300">
                  Start an Assessment
                </Link>
                <Link href="/book-demo" className="inline-flex rounded-full border border-white/20 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
                  Book a Strategy Call
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              {consultingServices.map((service) => (
                <Link
                  key={service.name}
                  href={service.href}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-cyan-300/30 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-base font-bold text-white">{service.name}</h3>
                    <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
                      {service.time}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{service.description}</p>
                  <span className="mt-3 inline-flex text-xs font-semibold text-cyan-400 group-hover:text-cyan-300">
                    Open this path →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── API / Docs strip ───────────────────────────────────────── */}
        <section className="mt-20 rounded-[2rem] border border-white/10 bg-white/[0.02] p-7 backdrop-blur-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">For builders and agents</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Machine-readable by design.</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Public API (news, reports, models), OpenAPI 3.1 spec, agent discovery card, RSS, and llms.txt — all open, no auth required.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/docs" className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
                Open Docs
              </Link>
              <Link href="/api/v1/openapi.json" className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white">
                OpenAPI →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Live news strip ────────────────────────────────────────── */}
        <section className="mt-8 rounded-[2rem] border border-emerald-400/20 bg-emerald-500/[0.05] p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Live news desk</p>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-white">Operator-grade AI news, updated daily.</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Curated and filtered for teams building production agent systems. No hype. No tutorials.
              </p>
            </div>
            <Link
              href="/news"
              className="shrink-0 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-200 transition-all hover:bg-emerald-500/15"
            >
              Read today&apos;s feed →
            </Link>
          </div>
        </section>

        {/* ── Trust / about ──────────────────────────────────────────── */}
        <section className="mt-20 grid gap-6 lg:grid-cols-2">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">About the research</p>
            <h2 className="mt-3 text-xl font-bold text-white">Who is behind this and how the research is produced.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Rare Agent Work is opinionated by design — written by Michael Fethe for operators who need to know what actually breaks in production, not what vendor marketing says.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/about" className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">About</Link>
              <Link href="/methodology" className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Methodology</Link>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Enterprise &amp; teams</p>
            <h2 className="mt-3 text-xl font-bold text-white">Procurement-friendly access for teams sharing reports.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              If you need shared report access, a governance walkthrough, or a scoped architecture review with multiple stakeholders, use the team lane.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/enterprise" className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Team access</Link>
              <Link href="/assessment" className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Request assessment</Link>
            </div>
          </article>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────────── */}
        <section className="mt-20 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-sky-600/5 to-fuchsia-600/8 p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Ready to start?</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold text-white md:text-4xl">
            A concrete next step in under 24 hours.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-slate-400">
            Browse a report with a full free preview, or bring a hard implementation problem for a human review.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/reports"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_12px_40px_rgba(34,211,238,0.2)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              Browse Reports
            </Link>
            <Link
              href="/assessment"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              Start an Assessment
            </Link>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-white/10 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/" className="flex items-center gap-2.5">
                <div className="relative h-8 w-8 overflow-hidden rounded-lg border border-white/15">
                  <Image src="/logo-medallion.jpg" alt="Rare Agent Work" fill className="object-cover" sizes="32px" />
                </div>
                <span className="text-sm font-bold text-white">Rare Agent Work</span>
              </Link>
              <p className="mt-2 text-xs text-slate-500">
                © {new Date().getFullYear()} Rare Agent Work. Operator-grade AI agent research and consulting.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              <Link href="/reports" className="hover:text-white">Reports</Link>
              <Link href="/news" className="hover:text-white">News</Link>
              <Link href="/assessment" className="hover:text-white">Consulting</Link>
              <Link href="/pricing" className="hover:text-white">Pricing</Link>
              <Link href="/docs" className="hover:text-white">Docs</Link>
              <Link href="/about" className="hover:text-white">About</Link>
              <a href="mailto:hello@rareagent.work" className="hover:text-white">hello@rareagent.work</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
