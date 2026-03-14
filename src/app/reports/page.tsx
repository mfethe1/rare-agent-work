import Link from "next/link";
import BuyButton from "@/components/BuyButton";
import { getAllReports } from "@/lib/reports";
import SiteNav from "@/components/SiteNav";

export const metadata = {
  title: "Implementation Reports | Rare Agent Work",
  description:
    "Operator-grade AI agent implementation playbooks. Full free preview before purchase — methodology, citations, risks, and sample content included.",
};

const colorAccent: Record<string, { border: string; badge: string; btn: string; text: string; glow: string }> = {
  blue:   { border: "border-blue-500/30 hover:border-blue-400/50",   badge: "text-blue-200 bg-blue-900/40 border border-blue-500/30",   btn: "bg-blue-600 hover:bg-blue-500 text-white",   text: "text-blue-400",  glow: "rgba(59,130,246,0.08)" },
  green:  { border: "border-green-500/30 hover:border-green-400/50", badge: "text-green-200 bg-green-900/40 border border-green-500/30", btn: "bg-green-600 hover:bg-green-500 text-white", text: "text-green-400", glow: "rgba(34,197,94,0.08)"  },
  purple: { border: "border-purple-500/30 hover:border-purple-400/50", badge: "text-purple-200 bg-purple-900/40 border border-purple-500/30", btn: "bg-purple-600 hover:bg-purple-500 text-white", text: "text-purple-400", glow: "rgba(168,85,247,0.08)" },
  red:    { border: "border-red-500/30 hover:border-red-400/50",     badge: "text-red-200 bg-red-900/40 border border-red-500/30",     btn: "bg-red-600 hover:bg-red-500 text-white",     text: "text-red-400",   glow: "rgba(239,68,68,0.08)"   },
  amber:  { border: "border-amber-500/30 hover:border-amber-400/50",   badge: "text-amber-200 bg-amber-900/40 border border-amber-500/30",   btn: "bg-amber-600 hover:bg-amber-500 text-white",   text: "text-amber-400",  glow: "rgba(245,158,11,0.08)"  },
};

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return raw;
  }
}

export default function ReportsPage() {
  const reports = getAllReports();

  return (
    <div className="min-h-screen bg-[#050816] text-white">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <SiteNav
        newReport={reports.find((r) => r.isNew) ? { title: reports.find((r) => r.isNew)!.title, slug: reports.find((r) => r.isNew)!.slug, price: reports.find((r) => r.isNew)!.price } : null}
        primaryCta={{ label: 'Browse Reports', href: '/reports' }}
      />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">

        {/* ── Header ────────────────────────────────────────────────── */}
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Implementation Reports</p>
          <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">
            Pick the playbook that matches your problem.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            Every report ships with a full free preview — methodology, citations, sample sections, risks, and action steps.
            One-time purchase. Yours permanently.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Full preview before purchase", "Cited sources on every claim", "One-time purchase · no subscription", "Instant access after checkout"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                <span className="text-cyan-400">✓</span> {item}
              </span>
            ))}
          </div>
        </header>

        {/* ── New report callout ────────────────────────────────────── */}
        {(() => {
          const newest = reports.find((r) => r.isNew);
          if (!newest) return null;
          const c = colorAccent[newest.color] ?? colorAccent.red;
          return (
            <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    New
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Just published</p>
                    <h2 className="mt-1 text-lg font-bold text-white">{newest.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">{newest.valueprop}</p>
                    <p className="mt-1.5 text-xs text-slate-500">Updated {formatDate(newest.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${c.badge}`}>
                    {newest.price}
                  </span>
                  <Link
                    href={`/reports/${newest.slug}`}
                    className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100 transition-colors"
                  >
                    Read free preview →
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Report grid ───────────────────────────────────────────── */}
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {reports.map((report) => {
            const c = colorAccent[report.color] ?? colorAccent.blue;
            return (
              <article
                key={report.slug}
                className={`group relative flex flex-col rounded-2xl border bg-white/[0.03] p-6 backdrop-blur-sm transition-all ${c.border}`}
                style={{ boxShadow: `0 0 40px ${c.glow}` }}
              >
                {report.isNew && (
                  <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    New
                  </span>
                )}

                {/* Price + freshness */}
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${c.badge}`}>
                    {report.price}
                  </span>
                  <span className="text-[10px] text-slate-500">Updated {formatDate(report.updatedAt)}</span>
                </div>

                {/* Title + subtitle */}
                <h2 className="text-base font-bold leading-snug text-white">{report.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{report.subtitle}</p>

                {/* Value proposition */}
                <p className={`mt-3 text-xs leading-5 font-medium ${c.text}`}>{report.valueprop}</p>

                {/* Best for */}
                <p className="mt-3 text-[11px] text-slate-500">
                  For: {report.bestFor.slice(0, 2).join(" · ")}
                </p>

                {/* Proof points */}
                <ul className="mt-4 space-y-1.5">
                  {report.proofPoints.slice(0, 2).map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                      <span className={`mt-0.5 shrink-0 text-[10px] ${c.text}`}>●</span>
                      {pt}
                    </li>
                  ))}
                </ul>

                {/* Actions */}
                <div className="mt-auto flex flex-col gap-2 pt-6">
                  <Link
                    href={`/reports/${report.slug}`}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Read free preview →
                  </Link>
                  <BuyButton
                    plan={report.planKey}
                    label={`Buy — ${report.price}`}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${c.btn}`}
                  />
                </div>
              </article>
            );
          })}
        </section>

        {/* ── Operator Access upsell ────────────────────────────────── */}
        <section className="mt-10 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/40 to-slate-950 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Operator Access — $49/mo</p>
              <h2 className="mt-1.5 text-xl font-bold text-white">Full catalog + rolling updates.</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                All current and future reports, updated as the space changes. Better economics if you&apos;ll use more than one.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/pricing" className="inline-flex rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 transition-colors">
                Compare plans
              </Link>
              <Link href="/enterprise" className="inline-flex rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                Team / Enterprise
              </Link>
            </div>
          </div>
        </section>

        {/* ── Consulting upsell ─────────────────────────────────────── */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">When a report isn&apos;t enough</p>
              <h2 className="mt-1.5 text-xl font-bold text-white">Bring a hard problem directly.</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                Architecture review, implementation rescue, and strategy calls. Every intake is reviewed by a human before any next step.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/assessment" className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors">
                Start an Assessment
              </Link>
              <Link href="/book-demo" className="inline-flex rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-colors">
                Book a Strategy Call
              </Link>
            </div>
          </div>
        </section>

        {/* ── About strip ───────────────────────────────────────────── */}
        <section className="mt-6 rounded-2xl border border-white/8 bg-white/[0.015] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-400">
              <span className="font-semibold text-slate-300">Rare Agent Work</span> is written by Michael Fethe — operator-first, opinionated research for teams that need to know what actually breaks in production.
            </p>
            <div className="flex shrink-0 gap-4 text-sm">
              <Link href="/about" className="font-semibold text-cyan-300 hover:text-cyan-200 transition-colors">About →</Link>
              <Link href="/methodology" className="text-slate-400 hover:text-white transition-colors">Methodology</Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
