import Link from "next/link";
import { getAllReports } from "@/lib/reports";
import { startHereRoutes } from "@/lib/site-copy";

const colorMap: Record<
  string,
  {
    badge: string;
    border: string;
    button: string;
  }
> = {
  blue: { badge: "text-blue-400 bg-blue-900/40 border-blue-500/30", border: "border-blue-500/30", button: "bg-blue-600 hover:bg-blue-700" },
  green: { badge: "text-green-400 bg-green-900/40 border-green-500/30", border: "border-green-500/30", button: "bg-green-600 hover:bg-green-700" },
  purple: { badge: "text-purple-400 bg-purple-900/40 border-purple-500/30", border: "border-purple-500/30", button: "bg-purple-600 hover:bg-purple-700" },
};

export const metadata = {
  title: "Reports | Rare Agent Work",
  description:
    "Browse operator-grade AI reports: practical implementation playbooks, architecture decisions, and decision frameworks.",
};

export default function ReportsPage() {
  const reports = getAllReports();

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <nav className="border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold text-white">
            Rare Agent Work
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/news" className="text-gray-300 hover:text-white">
              News Feed
            </Link>
            <Link href="/docs" className="text-gray-300 hover:text-white">
              Docs
            </Link>
            <Link href="/enterprise" className="text-gray-300 hover:text-white">
              Enterprise
            </Link>
            <Link href="/assessment" className="text-gray-300 hover:text-white">
              Assessment
            </Link>
            <Link href="/pricing" className="text-cyan-300 hover:text-cyan-200">
              Pricing
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Operator Reports</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            A curated catalog of the reports used by operators implementing serious agent systems.
            Every preview includes methodology, source citations, risks, and action steps before you buy.
          </p>
        </header>

        <section className="mb-10 grid gap-4 lg:grid-cols-4">
          {startHereRoutes.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-cyan-300/40">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{item.badge}</p>
              <h2 className="mt-2 text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => {
            const c = colorMap[report.color] || colorMap.blue;

            return (
              <article
                key={report.slug}
                className={`rounded-2xl border ${c.border} bg-white/5 p-5 transition-colors hover:border-white/30`}
              >
                <p className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${c.badge}`}>
                  {report.price}
                </p>
                <h2 className="mt-3 text-lg font-semibold text-white">{report.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{report.subtitle}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Best for</p>
                <p className="mt-2 text-sm text-slate-300">{report.bestFor.join(' • ')}</p>
                <div className="mt-6">
                  <Link
                    href={`/reports/${report.slug}`}
                    className={`inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${c.button}`}
                  >
                    Open preview
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold text-white">Need the full catalog, bundles, or a buyer path?</h2>
          <p className="mt-2 text-slate-300">
            Compare one-time reports, Operator Access, consultant-friendly bundles, and enterprise working sessions from the pricing page.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              Compare plans
            </Link>
            <Link
              href="/enterprise"
              className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Team / enterprise access
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
