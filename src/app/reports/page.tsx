import Link from "next/link";
import BuyButton from "@/components/BuyButton";
import { getAllReports } from "@/lib/reports";

export const metadata = {
  title: "Implementation Reports | Rare Agent Work",
  description:
    "Operator-grade AI agent implementation playbooks. Full preview before purchase — methodology, citations, risks, and sample content included.",
};

const colorAccent: Record<string, { border: string; badge: string; btn: string; step: string }> = {
  blue:   { border: "border-blue-500/30 hover:border-blue-400/50",   badge: "text-blue-300 bg-blue-900/30 border border-blue-500/25",   btn: "bg-blue-600 hover:bg-blue-500 text-white",   step: "text-blue-300" },
  green:  { border: "border-green-500/30 hover:border-green-400/50", badge: "text-green-300 bg-green-900/30 border border-green-500/25", btn: "bg-green-600 hover:bg-green-500 text-white", step: "text-green-300" },
  purple: { border: "border-purple-500/30 hover:border-purple-400/50", badge: "text-purple-300 bg-purple-900/30 border border-purple-500/25", btn: "bg-purple-600 hover:bg-purple-500 text-white", step: "text-purple-300" },
  red:    { border: "border-red-500/30 hover:border-red-400/50",     badge: "text-red-300 bg-red-900/30 border border-red-500/25",     btn: "bg-red-600 hover:bg-red-500 text-white",     step: "text-red-300" },
};

export default function ReportsPage() {
  const reports = getAllReports();

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-base font-bold text-white hover:text-slate-200 transition-colors">
            ← Rare Agent Work
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/news" className="hidden text-slate-400 hover:text-white sm:block">News</Link>
            <Link href="/assessment" className="hidden text-slate-400 hover:text-white sm:block">Consulting</Link>
            <Link href="/pricing" className="hidden text-cyan-300 hover:text-cyan-200 sm:block">Pricing</Link>
            <Link
              href="/assessment"
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Work With Us
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">

        {/* Header */}
        <header className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Implementation reports</p>
          <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">
            Pick the playbook that matches your problem.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            Every report includes a full free preview — methodology, citations, sample sections, risks, and action steps — before you spend a dollar.
            One-time purchase. Yours permanently.
          </p>
        </header>

        {/* Trust bar */}
        <div className="mt-8 flex flex-wrap gap-3">
          {["Full preview before purchase", "Cited sources on every claim", "One-time purchase — no subscription", "Instant access after checkout"].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
              <span className="text-cyan-400">✓</span> {item}
            </span>
          ))}
        </div>

        {/* Report grid */}
        <section className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {reports.map((report) => {
            const c = colorAccent[report.color] ?? colorAccent.blue;
            return (
              <article
                key={report.slug}
                className={`group relative flex flex-col rounded-2xl border bg-white/[0.035] p-6 backdrop-blur-sm transition-all ${c.border}`}
              >
                {report.isNew && (
                  <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    New
                  </span>
                )}

                {/* Price + freshness */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${c.badge}`}>
                    {report.price}
                  </span>
                  <span className="text-[10px] text-slate-500">Updated {report.updatedAt}</span>
                </div>

                {/* Title + subtitle */}
                <h2 className="mt-4 text-lg font-bold leading-snug text-white">{report.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{report.subtitle}</p>

                {/* Best for */}
                <p className="mt-3 text-xs text-slate-500">
                  {report.bestFor.slice(0, 2).join(" · ")}
                </p>

                {/* Proof points */}
                <ul className="mt-4 space-y-1.5">
                  {report.proofPoints.slice(0, 2).map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                      <span className={`mt-0.5 shrink-0 text-[10px] ${c.step}`}>●</span>
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

        {/* Consulting upsell */}
        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">When a report isn&apos;t enough</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Bring a hard problem directly.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Architecture review, implementation rescue, and strategy calls for teams with real blockers.
              Every intake is reviewed by a human before any next step is proposed.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/assessment"
                className="inline-flex rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300"
              >
                Start an Assessment
              </Link>
              <Link
                href="/book-demo"
                className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Book a Strategy Call
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Bundles &amp; team access</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Need the full catalog or team access?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Compare Operator Access ($49/mo) for the full report catalog, or use the enterprise path for procurement-friendly team access.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                Compare plans
              </Link>
              <Link
                href="/enterprise"
                className="inline-flex rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10"
              >
                Team / Enterprise
              </Link>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Who is behind this</p>
              <p className="mt-1 text-sm leading-7 text-slate-400">
                Rare Agent Work is written by Michael Fethe — operator-first, opinionated research for teams that need to know what actually breaks in production.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/about" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">About →</Link>
              <Link href="/methodology" className="text-sm font-semibold text-slate-400 hover:text-white">Methodology →</Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
