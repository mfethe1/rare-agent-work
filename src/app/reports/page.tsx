import Link from "next/link";
import BuyButton from "@/components/BuyButton";
import { getAllReports } from "@/lib/reports";
import SiteNav from "@/components/SiteNav";

export const metadata = {
  title: "Implementation Reports",
  description:
    "Operator-grade AI agent implementation playbooks. Full free preview before purchase — methodology, citations, risks, and sample content included.",
};

const colorAccent: Record<
  string,
  {
    border: string;
    badge: string;
    btn: string;
    btnOutline: string;
    text: string;
    glow: string;
    surface: string;
    insightBorder: string;
    insightBg: string;
  }
> = {
  blue: {
    border: "border-blue-500/30",
    badge: "text-blue-200 bg-blue-900/40 border border-blue-500/30",
    btn: "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_8px_24px_rgba(59,130,246,0.2)]",
    btnOutline: "border-blue-500/30 text-blue-300 hover:bg-blue-900/30",
    text: "text-blue-400",
    glow: "rgba(59,130,246,0.06)",
    surface: "from-blue-950/20 to-transparent",
    insightBorder: "border-l-blue-500/60",
    insightBg: "bg-blue-950/30",
  },
  green: {
    border: "border-green-500/30",
    badge: "text-green-200 bg-green-900/40 border border-green-500/30",
    btn: "bg-green-600 hover:bg-green-500 text-white shadow-[0_8px_24px_rgba(34,197,94,0.2)]",
    btnOutline: "border-green-500/30 text-green-300 hover:bg-green-900/30",
    text: "text-green-400",
    glow: "rgba(34,197,94,0.06)",
    surface: "from-green-950/20 to-transparent",
    insightBorder: "border-l-green-500/60",
    insightBg: "bg-green-950/30",
  },
  purple: {
    border: "border-purple-500/30",
    badge: "text-purple-200 bg-purple-900/40 border border-purple-500/30",
    btn: "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_8px_24px_rgba(168,85,247,0.2)]",
    btnOutline: "border-purple-500/30 text-purple-300 hover:bg-purple-900/30",
    text: "text-purple-400",
    glow: "rgba(168,85,247,0.06)",
    surface: "from-purple-950/20 to-transparent",
    insightBorder: "border-l-purple-500/60",
    insightBg: "bg-purple-950/30",
  },
  red: {
    border: "border-red-500/30",
    badge: "text-red-200 bg-red-900/40 border border-red-500/30",
    btn: "bg-red-600 hover:bg-red-500 text-white shadow-[0_8px_24px_rgba(239,68,68,0.2)]",
    btnOutline: "border-red-500/30 text-red-300 hover:bg-red-900/30",
    text: "text-red-400",
    glow: "rgba(239,68,68,0.06)",
    surface: "from-red-950/20 to-transparent",
    insightBorder: "border-l-red-500/60",
    insightBg: "bg-red-950/30",
  },
  amber: {
    border: "border-amber-500/30",
    badge: "text-amber-200 bg-amber-900/40 border border-amber-500/30",
    btn: "bg-amber-600 hover:bg-amber-500 text-white shadow-[0_8px_24px_rgba(245,158,11,0.2)]",
    btnOutline: "border-amber-500/30 text-amber-300 hover:bg-amber-900/30",
    text: "text-amber-400",
    glow: "rgba(245,158,11,0.06)",
    surface: "from-amber-950/20 to-transparent",
    insightBorder: "border-l-amber-500/60",
    insightBg: "bg-amber-950/30",
  },
};

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
}

export default function ReportsPage() {
  const reports = getAllReports();
  const newestReport = reports.find((r) => r.isNew);

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* Background ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-10rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-[20rem] h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/8 blur-3xl" />
      </div>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <SiteNav
        newReport={
          newestReport
            ? {
                title: newestReport.title,
                slug: newestReport.slug,
                price: newestReport.price,
              }
            : null
        }
        primaryCta={{ label: "Browse Reports", href: "/reports" }}
      />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">

        {/* ── HERO ───────────────────────────────────────────────────── */}
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]" />
            {reports.length} implementation reports · full preview free
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl md:text-[3.25rem] md:leading-[1.1]">
            The playbooks operators use when&nbsp;
            <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
              the demo breaks in production.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
            Each report covers a specific failure class in depth — root causes, exact prevention steps,
            and decision frameworks derived from real production incidents.
            Read the full preview before you spend a dollar.
          </p>

          {/* Trust strip */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              { stat: "100%", label: "free preview before purchase" },
              { stat: reports.length.toString(), label: "reports with cited sources" },
              { stat: "8+", label: "production failure classes documented in depth" },
              { stat: "Zero", label: "vendor-sponsored content" },
            ].map((item) => (
              <div key={item.label} className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-cyan-300">{item.stat}</span>
                <span className="text-xs text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── New report callout ────────────────────────────────────── */}
        {newestReport && (() => {
          const c = colorAccent[newestReport.color] ?? colorAccent.amber;
          return (
            <div className="mb-10 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    New
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
                      Just published
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-white">
                      {newestReport.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {newestReport.valueprop}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${c.badge}`}
                  >
                    {newestReport.price}
                  </span>
                  <Link
                    href={`/reports/${newestReport.slug}`}
                    className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100 transition-colors"
                  >
                    Read free preview →
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}


        {/* ── Quick-path matcher — self-select to the right report —──────────────── */}
        <section className="mb-10">
          <div className="rounded-2xl border border-white/8 bg-white/[0.015] px-6 py-5 sm:px-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 text-center">Not sure where to start?</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { situation: "First agent deployment, worried about failure modes", report: "agent-setup-60", label: "Agent Setup in 60 Minutes", price: "$29", color: "blue" },
                { situation: "Single agent working, need to add memory, roles, or parallel execution", report: "single-to-multi-agent", label: "Single to Multi-Agent", price: "$79", color: "green" },
                { situation: "Building a formal eval protocol or presenting to procurement", report: "empirical-agent-architecture", label: "Empirical Architecture", price: "$299", color: "purple" },
                { situation: "Connecting agents to MCP servers and need a security posture", report: "mcp-security", label: "MCP Security", price: "$149", color: "red" },
                { situation: "Something already broke in production and need to learn from it", report: "agent-incident-postmortems", label: "Production Post-Mortems", price: "$149", color: "amber" },
                { situation: "Unsure — need all of the above", report: null, label: "Operator Access", price: "$49/mo", color: "blue" },
              ].map((item) => {
                const borderMap: Record<string, string> = { blue: "border-blue-500/20 hover:border-blue-400/40", green: "border-green-500/20 hover:border-green-400/40", purple: "border-purple-500/20 hover:border-purple-400/40", red: "border-red-500/20 hover:border-red-400/40", amber: "border-amber-500/20 hover:border-amber-400/40" };
                const textMap: Record<string, string> = { blue: "text-blue-300", green: "text-green-300", purple: "text-purple-300", red: "text-red-300", amber: "text-amber-300" };
                const href = item.report ? `/reports/${item.report}` : "/pricing";
                return (
                  <a key={item.situation} href={href} className={`flex flex-col gap-2 rounded-xl border ${borderMap[item.color] ?? "border-white/10"} bg-black/20 p-4 transition-all hover:bg-black/30`}>
                    <p className="text-xs leading-5 text-slate-300">&#8220;{item.situation}&#8221;</p>
                    <p className={`mt-auto text-xs font-bold ${textMap[item.color] ?? "text-slate-300"}`}>{item.label} — {item.price} →</p>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
        {/* ── Report cards — primary conversion surface ──────────────── */}
        <section className="mb-12">
          <div className="space-y-6">
            {reports.map((report) => {
              const c = colorAccent[report.color] ?? colorAccent.blue;
              return (
                <article
                  key={report.slug}
                  className={`group relative overflow-hidden rounded-2xl border bg-white/[0.025] backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.035] ${c.border}`}
                  style={{ boxShadow: `0 0 60px ${c.glow}` }}
                >
                  {/* Top gradient accent strip */}
                  <div className={`h-px w-full bg-gradient-to-r ${c.surface}`} />

                  <div className="p-6 sm:p-7 lg:p-8">

                    {/* ── Header row: price + meta ── */}
                    <div className="mb-5 flex flex-wrap items-center gap-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${c.badge}`}>
                        {report.price}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {report.priceLabel}
                      </span>
                      {report.isNew && (
                        <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          New
                        </span>
                      )}
                      <span className="ml-auto hidden text-[11px] text-slate-500 sm:inline">
                        Updated {formatDate(report.updatedAt)} · {report.readingTime}
                      </span>
                    </div>

                    {/* ── Title + value prop ── */}
                    <h2 className="text-xl font-bold leading-snug text-white sm:text-2xl">
                      {report.title}
                    </h2>
                    <p className={`mt-1 text-sm font-medium ${c.text}`}>
                      {report.subtitle}
                    </p>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                      {report.valueprop}
                    </p>

                    {/* ── Sharpest insight — free value, pulls the sale ── */}
                    {report.sharpestInsight && (
                      <div className={`mt-5 rounded-xl border-l-4 ${c.insightBorder} ${c.insightBg} p-4`}>
                        <p className={`mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${c.text}`}>
                          The finding that changes your next decision
                        </p>
                        <p className="text-sm leading-6 text-slate-200 italic">
                          &ldquo;{report.sharpestInsight}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* ── Key takeaways + CTAs ── */}
                    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">

                      {/* Takeaways */}
                      <div>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                          What you walk away with
                        </p>
                        <ul className="space-y-1.5">
                          {report.keyTakeaways.slice(0, 4).map((kt) => (
                            <li
                              key={kt}
                              className="flex items-start gap-2 text-xs leading-5 text-slate-300"
                            >
                              <span className={`mt-0.5 shrink-0 text-[9px] font-black ${c.text}`}>
                                ▸
                              </span>
                              {kt}
                            </li>
                          ))}
                          {report.keyTakeaways.length > 4 && (
                            <li className="flex items-start gap-2 text-xs leading-5 text-slate-600 italic">
                              <span className="mt-0.5 shrink-0 text-[9px] font-black text-slate-700">▸</span>
                              +{report.keyTakeaways.length - 4} more in the full report
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* CTA block */}
                      <div className="flex flex-col gap-2 lg:min-w-[200px]">
                        <BuyButton
                          plan={report.planKey}
                          label={`Buy — ${report.price}`}
                          className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition-all ${c.btn}`}
                        />
                        <Link
                          href={`/reports/${report.slug}`}
                          className={`inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-all ${c.btnOutline} hover:bg-white/5`}
                        >
                          Read free preview →
                        </Link>
                        <p className="text-center text-[10px] text-slate-600">
                          One-time · instant access
                        </p>
                      </div>
                    </div>

                    {/* ── Deliverables + meta strip ── */}
                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/8 pt-4">
                      {[
                        { label: `${report.deliverables.length} deliverables`, icon: "📦" },
                        { label: `${report.citations.length} cited sources`, icon: "🔗" },
                        { label: `2 free sections · ${Math.max(0, report.excerpt.length - 2)} locked`, icon: "" },
                        { label: `Best for: ${report.bestFor.slice(0, 2).join(" · ")}`, icon: "" },
                      ].map((item) => (
                        <span key={item.label} className="text-[11px] text-slate-500">
                          {item.icon && <span className="mr-1">{item.icon}</span>}
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Comparison table ─────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/8 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Side-by-side comparison
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                Pick the right report for your problem.
              </h2>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="w-44 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Report
                    </th>
                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Best for
                    </th>
                    <th className="w-24 px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Price
                    </th>
                    <th className="w-36 px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Reading time
                    </th>
                    <th className="w-44 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report, idx) => {
                    const c = colorAccent[report.color] ?? colorAccent.blue;
                    return (
                      <tr
                        key={report.slug}
                        className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${idx === reports.length - 1 ? "border-b-0" : ""}`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-start gap-2">
                            {report.isNew && (
                              <span className="mt-0.5 shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                New
                              </span>
                            )}
                            <div>
                              <p className="text-sm font-semibold leading-snug text-white">
                                {report.title}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {report.edition}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <p className="text-xs leading-5 text-slate-400">
                            {report.bestFor.join(" · ")}
                          </p>
                        </td>
                        <td className="px-4 py-5">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${c.badge}`}
                          >
                            {report.price}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <p className="text-xs text-slate-400">
                            {report.readingTime}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1.5">
                            <BuyButton
                              plan={report.planKey}
                              label={`Buy — ${report.price}`}
                              className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${c.btn}`}
                            />
                            <Link
                              href={`/reports/${report.slug}`}
                              className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${c.btnOutline} hover:bg-white/5`}
                            >
                              Free preview →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: compact list */}
            <div className="divide-y divide-white/5 lg:hidden">
              {reports.map((report) => {
                const c = colorAccent[report.color] ?? colorAccent.blue;
                return (
                  <div key={report.slug} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {report.isNew && (
                          <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                            New
                          </span>
                        )}
                        <p className="truncate text-sm font-semibold text-white">
                          {report.title}
                        </p>
                      </div>
                      <p className={`mt-0.5 text-xs font-bold ${c.text}`}>
                        {report.price}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <BuyButton
                        plan={report.planKey}
                        label={`Buy ${report.price}`}
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${c.btn}`}
                      />
                      <Link
                        href={`/reports/${report.slug}`}
                        className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs text-slate-400 transition-colors hover:text-white ${c.btnOutline}`}
                      >
                        Preview →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Operator Access upsell ──────────────────────────────────── */}
        <section className="mb-6">
          <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/40 to-slate-950 p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                  Operator Access — $49/mo
                </p>
                <h2 className="mt-1.5 text-xl font-bold text-white">
                  Full catalog + rolling updates.
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                  All current and future reports, updated as the space changes.
                  Better economics if you&apos;ll use more than one, or if you want new
                  reports automatically included.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    "All reports, including future releases",
                    "AI implementation guide on every report",
                    "Rolling freshness updates as the space changes",
                    "Cancel anytime — no lock-in",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2 text-xs text-slate-400"
                    >
                      <span className="mt-0.5 shrink-0 text-cyan-400">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:min-w-[180px]">
                <div className="rounded-xl border border-cyan-400/20 bg-black/30 p-4 text-center">
                  <p className="text-2xl font-black text-white">$49</p>
                  <p className="text-xs text-slate-400">/month</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    vs. ${reports.reduce(
                      (sum, r) =>
                        sum + (Number(r.price.replace(/[^0-9.]/g, "")) || 0),
                      0
                    )}{" "}
                    if bought individually
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 transition-colors"
                >
                  Compare plans
                </Link>
                <Link
                  href="/enterprise"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  Team / Enterprise
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Consulting upsell ───────────────────────────────────────── */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                When a report isn&apos;t enough
              </p>
              <h2 className="mt-1.5 text-xl font-bold text-white">
                Bring a hard problem directly.
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                Architecture review, implementation rescue, and strategy calls.
                Every intake is reviewed by a human before any next step.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/assessment"
                className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
              >
                Start an Assessment
              </Link>
              <Link
                href="/book-demo"
                className="inline-flex rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-colors"
              >
                Book a Strategy Call
              </Link>
            </div>
          </div>
        </section>

        {/* ── About strip ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.015] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-400">
              <span className="font-semibold text-slate-300">
                Rare Agent Work
              </span>{" "}
              is written by Michael Fethe — operator-first, opinionated
              research for teams that need to know what actually breaks in
              production.
            </p>
            <div className="flex shrink-0 gap-4 text-sm">
              <Link
                href="/about"
                className="font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                About →
              </Link>
              <Link
                href="/methodology"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Methodology
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
