import Image from 'next/image';
import Link from 'next/link';

import { WebsiteJsonLd } from '@/components/JsonLd';
import { getAllReports } from '@/lib/reports';
import SiteNav from '@/components/SiteNav';
import BuyButton from '@/components/BuyButton';

// Production incidents — specific, named, quantified. Not "common patterns."
const incidentCards = [
  {
    icon: '💣',
    title: 'The bulk-send incident',
    detail: '847 customers got the same email. CSV imported. No deduplication key. No volume cap. The automation ran exactly as designed — and that was the problem.',
    report: 'agent-setup-60',
    reportLabel: 'Agent Setup in 60 Minutes',
  },
  {
    icon: '🔒',
    title: 'Auth cascade, 4 days silent',
    detail: 'Employee left. Service account deleted. 14 workflows failed silently. Error alerts routed to the deleted inbox. Engineering found out from a customer — four days later.',
    report: 'agent-setup-60',
    reportLabel: 'Agent Setup in 60 Minutes',
  },
  {
    icon: '💸',
    title: '$47k in 72 hours',
    detail: 'One config variable wrong on prod deploy. GPT-4o instead of mini. No per-session cost ceiling. No daily spend alert. The bill arrived before anyone noticed.',
    report: 'empirical-agent-architecture',
    reportLabel: 'Empirical Architecture',
  },
  {
    icon: '🧹',
    title: 'Orchestration deadlock',
    detail: 'Multi-agent system hit a coordination loop. Planner and executor passed the same task back and forth 140 times in 8 minutes before someone caught it in the logs.',
    report: 'single-to-multi-agent',
    reportLabel: 'Single to Multi-Agent',
  },
];

// Consulting services — specific, scoped, honest about what they are
const consultingServices = [
  {
    name: 'Operator Review',
    time: '48–72 hrs',
    description: 'Outside diagnostic on stack fit, failure modes, and next actions. For teams that need an unbiased read before a decision.',
    href: '/assessment',
  },
  {
    name: 'Implementation Rescue',
    time: 'Scoped',
    description: 'For brittle workflows, orchestration drift, weak memory architecture, or rollout stalls that need direct intervention.',
    href: '/assessment',
  },
  {
    name: 'Architecture Review',
    time: 'Strategy call',
    description: 'For aligning architecture, governance, vendor selection, and rollout sequencing across engineering and stakeholders.',
    href: '/book-demo',
  },
];

export default function Home() {
  const reports = getAllReports();
  const newReport = reports.find((r) => r.isNew);

  const accentMap: Record<string, { card: string; price: string; btn: string; previewBtn: string }> = {
    blue: {
      card: 'border-blue-500/25 hover:border-blue-400/50',
      price: 'text-blue-300 bg-blue-900/30 border border-blue-500/25',
      btn: 'bg-blue-500 hover:bg-blue-400 text-white shadow-[0_8px_24px_rgba(59,130,246,0.25)]',
      previewBtn: 'border-blue-500/30 text-blue-300 hover:bg-blue-500/10',
    },
    green: {
      card: 'border-green-500/25 hover:border-green-400/50',
      price: 'text-green-300 bg-green-900/30 border border-green-500/25',
      btn: 'bg-green-500 hover:bg-green-400 text-white shadow-[0_8px_24px_rgba(34,197,94,0.25)]',
      previewBtn: 'border-green-500/30 text-green-300 hover:bg-green-500/10',
    },
    purple: {
      card: 'border-purple-500/25 hover:border-purple-400/50',
      price: 'text-purple-300 bg-purple-900/30 border border-purple-500/25',
      btn: 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_8px_24px_rgba(168,85,247,0.25)]',
      previewBtn: 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10',
    },
    red: {
      card: 'border-red-500/25 hover:border-red-400/50',
      price: 'text-red-300 bg-red-900/30 border border-red-500/25',
      btn: 'bg-red-500 hover:bg-red-400 text-white shadow-[0_8px_24px_rgba(239,68,68,0.25)]',
      previewBtn: 'border-red-500/30 text-red-300 hover:bg-red-500/10',
    },
    amber: {
      card: 'border-amber-500/25 hover:border-amber-400/50',
      price: 'text-amber-300 bg-amber-900/30 border border-amber-500/25',
      btn: 'bg-amber-500 hover:bg-amber-400 text-white shadow-[0_8px_24px_rgba(245,158,11,0.25)]',
      previewBtn: 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10',
    },
  };

  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <WebsiteJsonLd />

      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-[-8rem] top-[30rem] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-5rem] h-[26rem] w-[26rem] rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_34%),linear-gradient(180deg,rgba(5,8,22,0.97),rgba(3,6,18,1))]" />
      </div>

      <SiteNav
        newReport={newReport ? { title: newReport.title, slug: newReport.slug, price: newReport.price } : null}
        primaryCta={{ label: 'Browse Reports', href: '/reports' }}
      />

      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">

        {/* ── HERO ────────────────────────────────────────────────── */}
        <section className="text-center">

          {/* Qualifier pill — immediate ICP filter */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-300/25 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90 shadow-[0_0_24px_rgba(34,211,238,0.07)]">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
            For engineering teams shipping production agent systems
          </div>

          {/* Main headline — problem-first, specific */}
          <h1 className="mx-auto mt-7 max-w-5xl text-5xl font-black tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5rem] lg:leading-[1.06]">
            Your agent works in the demo.
            <span className="block mt-2 bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
              Here&apos;s why it breaks in production.
            </span>
          </h1>

          {/* Value prop — specific deliverable, specific audience */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
            Playbooks for the failure modes vendor docs skip — auth cascade, deduplication,
            MCP tool poisoning, orchestration deadlocks, cost explosions.{' '}
            <span className="font-semibold text-white">Read the full preview free before spending a dollar.</span>
          </p>
          {/* Price anchor — the conversion-critical signal most sites bury */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
              <span className="text-sm font-black text-cyan-300">From $29</span>
              <span className="text-xs text-slate-500">· one-time purchase</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
              <span className="text-sm font-black text-emerald-300">100%</span>
              <span className="text-xs text-slate-500">free preview before you buy</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
              <span className="text-sm font-black text-slate-200">Zero</span>
              <span className="text-xs text-slate-500">vendor-sponsored content</span>
            </div>
          </div>

          {/* Primary CTAs */}
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/reports"
              className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_16px_48px_rgba(34,211,238,0.25)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300 sm:w-auto"
            >
              Browse the reports →
            </Link>
            <Link
              href="/assessment"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Get an expert review
            </Link>
          </div>
        </section>

        {/* ── AUTHOR AUTHORITY — before the product ──────────────── */}
        {/*
          Trust is earned by the person, not claimed by the product.
          This section runs BEFORE the report catalog because cold visitors
          need to know who wrote this before they decide if it's worth reading.
        */}
        <section className="mt-12">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-7 sm:p-9 backdrop-blur-sm">
            <div className="grid gap-7 lg:grid-cols-[auto_1fr] lg:items-start lg:gap-10">
              <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left lg:w-48">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-[0_0_32px_rgba(34,211,238,0.1)]">
                  <Image src="/logo-medallion.jpg" alt="Michael Fethe" fill className="object-cover" sizes="64px" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Michael Fethe</p>
                  <p className="mt-0.5 text-xs text-slate-400">Founder, Rare Agent Work</p>
                  <p className="mt-0.5 text-xs text-slate-500">Indianapolis, IN</p>
                </div>
                <a
                  href="mailto:hello@rareagent.work"
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  hello@rareagent.work
                </a>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Why this research exists
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                  The same failures kept appearing across teams shipping AI agents: auth tokens
                  expiring silently at 3am, bulk CSV imports triggering duplicate sends to hundreds
                  of customers, multi-agent systems that worked in staging and looped endlessly in
                  production. The vendor documentation covered setup. Nobody covered the 72-hour
                  window after go-live.
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base sm:leading-8">
                  These reports exist for operators who are past &quot;can I build it?&quot; and are
                  asking &quot;why will this break, and how do I prevent that before it costs me?&quot;
                  The consulting work is for the cases where that question has a deadline or an
                  architecture that&apos;s already in trouble.
                </p>

                {/* Credibility proof — specific claims, not vague stats */}
                <div className="mt-6 flex flex-wrap gap-4">
                  {[
                    { claim: 'Every report is fully previewable', sub: 'Methodology, citations, sample sections, and explicit risks visible before purchase' },
                    { claim: 'Human-reviewed consulting intake', sub: 'No automated routing — every request is read before any next step is proposed' },
                    { claim: 'Zero vendor-sponsored content', sub: 'No affiliate relationships, no sponsored placements, no undisclosed conflicts' },
                  ].map((item) => (
                    <div key={item.claim} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-black/20 px-4 py-3 flex-1 min-w-[200px]">
                      <span className="mt-0.5 text-emerald-400 shrink-0">✓</span>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{item.claim}</p>
                        <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAILURE MODES — visceral problem urgency before the solution ─── */}
        <section className="mt-16">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-400/80">
              Real production failures — not hypotheticals
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
              These are the incidents that shut down automation programs.
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Each failure class is documented in full in the playbook that covers it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {incidentCards.map((fm) => (
              <Link
                key={fm.title}
                href={`/reports/${fm.report}`}
                className="group rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04]"
              >
                <div className="mb-3 text-2xl">{fm.icon}</div>
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">{fm.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{fm.detail}</p>
                <p className="mt-3 text-[10px] font-semibold text-cyan-400/70 group-hover:text-cyan-400 transition-colors">
                  Covered in: {fm.reportLabel} →
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── NEW RELEASES — urgency banner for newest reports ──────────────────────────── */}
        {reports.filter((r) => r.isNew).length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Just published</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {reports.filter((r) => r.isNew).map((report) => {
                const accent = accentMap[report.color] ?? accentMap.red;
                return (
                  <article
                    key={report.slug}
                    className={`relative overflow-hidden rounded-2xl border bg-white/[0.04] p-6 backdrop-blur-sm ${accent.card}`}
                  >
                    <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      New
                    </span>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${accent.price}`}>
                        {report.price}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{report.priceLabel}</span>
                    </div>
                    <h3 className="text-lg font-bold leading-snug text-white">{report.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-400">{report.subtitle}</p>
                    {report.sharpestInsight && (
                      <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">The finding that changes your next decision</p>
                        <p className="text-[11px] leading-5 text-slate-200 italic">
                          &ldquo;{report.sharpestInsight}&rdquo;
                        </p>
                      </div>
                    )}
                    <div className="mt-5 flex gap-2">
                      <Link
                        href={`/reports/${report.slug}`}
                        className={`inline-flex flex-1 items-center justify-center rounded-full border ${accent.previewBtn} bg-transparent px-4 py-2.5 text-sm font-bold transition-all`}
                      >
                        Read free preview →
                      </Link>
                      <BuyButton
                        plan={report.planKey}
                        label={`Buy — ${report.price}`}
                        className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-slate-400 transition-all hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ── REPORTS — the product, immediately after the problem hook ────────── */}
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                All implementation reports
              </p>
              <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
                Pick the playbook that matches your problem.
              </h2>
              <p className="mt-3 max-w-2xl text-base text-slate-400">
                Full free preview on every report — methodology, citations, risks, and sample
                sections before you spend anything.
              </p>
            </div>
            <Link href="/reports" className="hidden shrink-0 text-sm font-semibold text-cyan-300 hover:text-cyan-200 sm:inline-flex">
              All reports →
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => {
              const accent = accentMap[report.color] ?? accentMap.blue;

              return (
                <article
                  key={report.slug}
                  className={`group relative flex flex-col rounded-2xl border bg-white/[0.035] p-6 backdrop-blur-sm transition-all ${accent.card}`}
                >
                  {report.isNew && (
                    <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      New
                    </span>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${accent.price}`}>
                      {report.price}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {report.priceLabel}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold leading-snug text-white">{report.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{report.valueprop}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {report.bestFor.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Sharpest insight — show FIRST complete sentence, never clip mid-thought */}
                  {report.sharpestInsight && (
                    <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">The finding that changes your next decision</p>
                      <p className="text-[11px] leading-5 text-slate-200 italic">
                        &ldquo;{report.sharpestInsight}&rdquo;
                      </p>
                    </div>
                  )}

                  <div className="mt-auto space-y-2 pt-5">
                    {/* Preview is the PRIMARY action for cold visitors */}
                    <Link
                      href={`/reports/${report.slug}`}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-full border ${accent.previewBtn} bg-transparent px-4 py-3 text-sm font-bold transition-all`}
                    >
                      Read the free preview →
                    </Link>
                    {/* Buy is secondary — shown but not primary */}
                    <BuyButton
                      plan={report.planKey}
                      label={`Buy — ${report.price}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-400 transition-all hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Preview includes methodology, citations, and full sample sections. Read before you commit.
          </p>
        </section>

        {/* ── WHO THIS IS FOR — self-selection filter ──────────────── */}
        <section className="mt-12">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 sm:p-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 text-center">
              Who reads these reports
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  role: 'Engineering leads',
                  signal: '✓',
                  detail: "You've shipped a working agent. Now it's failing silently at 3am, spitting duplicate emails, or looping endlessly in a workflow that passed staging. You need a post-demo playbook, not an intro tutorial.",
                },
                {
                  role: 'CTOs & architects',
                  signal: '✓',
                  detail: "You're making decisions: framework selection, evaluation protocol, governance structure. You need cited, defensible analysis you can put in front of a board or procurement team. Not vendor marketing with a different font.",
                },
                {
                  role: 'Technical operators',
                  signal: '✓',
                  detail: "You own the deployment, not just the model. Approval gates, rollback procedures, cost ceilings, the 72-hour window after go-live. Your job is keeping the thing alive after the demo ends.",
                },
              ].map((item) => (
                <div key={item.role} className="rounded-xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-black text-emerald-400">{item.signal}</span>
                    <p className="text-sm font-bold text-white">{item.role}</p>
                  </div>
                  <p className="text-xs leading-5 text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CONSULTING — premium upgrade, after product is established ─────── */}
        <section className="mt-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Human consulting</p>
              <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
                When the report isn&apos;t enough.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-400">
                Architecture review, implementation rescue, and strategy calls for teams with real
                blockers. Every intake is reviewed by a human — no automated routing, no anonymous
                intake theater.
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
                <Link href="/assessment" className="inline-flex rounded-full bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 transition-colors">
                  Start an Assessment
                </Link>
                <Link href="/book-demo" className="inline-flex rounded-full border border-white/20 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
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
                  <span className="mt-3 inline-flex text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                    Open this path →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── API / DOCS STRIP ────────────────────────────────────── */}
        <section className="mt-16 rounded-[2rem] border border-white/10 bg-white/[0.02] p-7 backdrop-blur-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">For builders and agents</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Machine-readable by design.</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Public API (news, reports, models), OpenAPI 3.1, agent discovery card, RSS, and
                llms.txt — all open, no auth required.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/docs" className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors">
                Open Docs
              </Link>
              <Link href="/api/v1/openapi.json" className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                OpenAPI →
              </Link>
            </div>
          </div>
        </section>

        {/* ── LIVE NEWS STRIP ─────────────────────────────────────── */}
        <section className="mt-8 rounded-[2rem] border border-emerald-400/20 bg-emerald-500/[0.05] p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Live news desk</p>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-white">Operator-grade AI news, updated daily.</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Manually curated for teams building production agent systems. No hype. No tutorials.
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

        {/* ── TRUST / ABOUT + ENTERPRISE ──────────────────────────────────────── */}
        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">About the research</p>
            <h2 className="mt-3 text-xl font-bold text-white">Who is behind this and how the research is produced.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Rare Agent Work is opinionated by design — written by Michael Fethe for operators who
              need to know what actually breaks in production, not what vendor marketing says.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/about" className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition-colors">About</Link>
              <Link href="/methodology" className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors">Methodology</Link>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Enterprise &amp; teams</p>
            <h2 className="mt-3 text-xl font-bold text-white">Procurement-friendly access for teams sharing reports.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              If you need shared report access, a governance walkthrough, or a scoped architecture
              review with multiple stakeholders, use the team lane instead of a solo checkout flow.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/enterprise" className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition-colors">Team access</Link>
              <Link href="/assessment" className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors">Request assessment</Link>
            </div>
          </article>
        </section>

        {/* ── NEWSLETTER CTA ──────────────────────────────────────── */}
        <section className="mt-8 rounded-[2rem] border border-fuchsia-400/25 bg-fuchsia-500/[0.07] p-6 sm:p-8">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Newsletter — $10/mo</p>
              <h2 className="mt-2 text-xl font-bold text-white">The week&apos;s AI agent signal, without the noise.</h2>
              <p className="mt-1.5 text-sm text-slate-400">
                The same operator lens as the reports — applied to the week&apos;s AI news. No hype,
                no tutorials, no vendor announcements dressed up as research.
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 inline-flex rounded-full bg-fuchsia-400 px-6 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-fuchsia-300"
            >
              See what&apos;s included →
            </Link>
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────────────────────── */}
        <section className="mt-16 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-sky-600/5 to-fuchsia-600/8 p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">No commitment to read</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold text-white md:text-4xl">
            Read the full preview. Then decide.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-slate-400">
            Every report: full methodology, sample sections, citations, action steps, and
            explicit risks — all free before you buy. If you already know you have a production
            problem, skip the preview and bring it directly for a human review.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/reports"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_12px_40px_rgba(34,211,238,0.2)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              Browse the reports →
            </Link>
            <Link
              href="/assessment"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              Bring a live problem
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-600">Human review response within 24 hours · From $29 · Full preview free</p>
        </section>

      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
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
              <Link href="/reports" className="hover:text-white transition-colors">Reports</Link>
              <Link href="/news" className="hover:text-white transition-colors">News</Link>
              <Link href="/assessment" className="hover:text-white transition-colors">Consulting</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/docs" className="hover:text-white transition-colors">API</Link>
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <a href="mailto:hello@rareagent.work" className="hover:text-white transition-colors">hello@rareagent.work</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
