import Link from "next/link";
import BuyButton from "@/components/BuyButton";
import { getAllReports } from "@/lib/reports";
import { consultingPackages } from "@/lib/site-copy";
import SiteNav from "@/components/SiteNav";

export const metadata = {
  title: "Pricing",
  description: "Three-tier access model: free browsing, one-time reports, or subscription plans for operators.",
};

export default function PricingPage() {
  const reports = getAllReports();

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <SiteNav primaryCta={{ label: 'Browse Reports', href: '/reports' }} />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {/* Header */}
        <header className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Pricing</p>
          <h1 className="text-4xl font-bold sm:text-5xl">Three ways to access operator-grade intelligence</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Start free, buy reports as you need them, subscribe for full access, or <Link href="/submit-work" className="text-cyan-300 underline hover:text-cyan-200">submit scoped work for human-reviewed matching</Link>.
          </p>
        </header>

        <section className="mb-16 rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-8 backdrop-blur-sm">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Help me choose</p>
              <h2 className="mt-3 text-3xl font-bold text-white">Pick the buying path in under a minute.</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold text-white">Just staying up to date</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Start with the $10/mo newsletter if you want signal, summaries, and hot-news context without buying technical reports.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold text-white">Need one concrete playbook</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Buy a one-time report if you have a specific problem to solve right now and don’t want another subscription.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold text-white">Actively building with agents</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Choose Operator Access if your team needs all reports, deeper AI guidance, and ongoing updates while shipping.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">What token budgets really mean</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <li>Free = light experimentation and a few quick questions each day.</li>
                <li>Operator Access = hundreds of deeper implementation questions each month.</li>
                <li>If you hate token math, ignore it — choose based on whether you need casual reading, one report, or an active build partner.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Tier 1: Free */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Free Access</h2>
            <p className="mt-2 text-slate-400">Try the product before committing. No credit card required.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Always Free</span>
                  <p className="mt-1 text-4xl font-bold text-white">$0</p>
                </div>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                    <span>Browse the live news feed with freshness signals</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                    <span>Read full previews of all research reports</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                    <span>Ask a small number of AI questions for lightweight exploration before you commit</span>
                  </li>
                <li className="flex items-start gap-3">
                    <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                    <span>Subscribe to the $10/mo newsletter for hot-news alerts and context</span>
                  </li>
                </ul>
              </div>
              <div className="flex items-center justify-center lg:justify-end">
                <Link
                  href="/news"
                  className="inline-flex rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                >
                  Start browsing for free →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Tier 2: One-Time Reports */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">One-Time Reports</h2>
            <p className="mt-2 text-slate-400">
              Buy exactly what you need. Lifetime access, no subscription required. Every report includes visible methodology, citations, risks, and preview content before purchase.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {reports.map((report) => {
              const colorMap: Record<string, { border: string; badge: string; button: string }> = {
                blue: {
                  border: "border-blue-400/30",
                  badge: "border-blue-300/30 bg-blue-300/10 text-blue-200",
                  button: "bg-blue-600 hover:bg-blue-700",
                },
                green: {
                  border: "border-green-400/30",
                  badge: "border-green-300/30 bg-green-300/10 text-green-200",
                  button: "bg-green-600 hover:bg-green-700",
                },
                purple: {
                  border: "border-purple-400/30",
                  badge: "border-purple-300/30 bg-purple-300/10 text-purple-200",
                  button: "bg-purple-600 hover:bg-purple-700",
                },
              };
              const c = colorMap[report.color] || colorMap.blue;

              return (
                <div
                  key={report.slug}
                  className={`rounded-2xl border ${c.border} bg-white/5 p-6 transition-all hover:border-white/30`}
                >
                  <div className="mb-4">
                    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${c.badge}`}>
                      {report.price} {report.priceLabel}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{report.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{report.subtitle}</p>
                  <p className="mt-3 text-xs text-slate-400">{report.audience}</p>
                  <div className="mt-6 flex flex-col gap-3">
                    <BuyButton
                      plan={report.planKey}
                      label={`Buy for ${report.price}`}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors ${c.button}`}
                    />
                    <Link
                      href={`/reports/${report.slug}`}
                      className="text-center text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Read preview + proof →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-16 rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-8 backdrop-blur-sm">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">Bundles and buyer paths</p>
              <h2 className="mt-3 text-3xl font-bold text-white">Get the full report stack in one shot.</h2>
              <p className="mt-3 max-w-3xl text-slate-300">
                If you already know you need the operator playbook, the multi-agent architecture guide, and the empirical governance brief, don’t make three separate buying decisions.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold text-white">Best solo path</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Buy one report first if you have one urgent decision: framework choice, first workflow setup, or evaluation design.</p>
                </div>
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-5">
                  <p className="text-sm font-semibold text-white">Best repeat-use path</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Choose Operator Access if you expect to use multiple reports, want rolling updates, and need the AI guide regularly.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold text-white">Best team path</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Use assessment or submit-work if the real problem is routing, governance, ownership, or implementation rescue rather than content access alone.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Bundle signal</p>
              <p className="mt-2 text-3xl font-bold text-white">$199 suggested bundle</p>
              <p className="mt-2 text-sm text-slate-300">Includes all 5 current reports, best for teams standardizing how they build and evaluate agent systems.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/assessment" className="inline-flex rounded-full bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300">Request bundle access</Link>
                <Link href="/reports" className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Review reports</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Tier 3: Subscription Plans */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Subscription Plans</h2>
            <p className="mt-2 text-slate-400">
              Continuous access, rolling updates, and higher AI budgets for teams actively shipping.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Newsletter Plan */}
            <div className="relative overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-8 backdrop-blur-sm">
              <div className="absolute right-6 top-6">
                <span className="rounded-full bg-fuchsia-400 px-3 py-1 text-xs font-semibold text-slate-950">
                  Best entry point
                </span>
              </div>
              <div className="mb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200">Newsletter</span>
                <p className="mt-1 text-4xl font-bold text-white">
                  $10<span className="text-xl font-normal text-slate-300">/mo</span>
                </p>
                <p className="mt-2 text-sm text-slate-300">For people who want the signal without the noise</p>
              </div>
              <ul className="mb-8 space-y-3 text-sm text-slate-100">
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-fuchsia-300" />
                  <span>Weekly premium newsletter with operator summaries</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-fuchsia-300" />
                  <span>Hot-news alerts as important stories land</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-fuchsia-300" />
                  <span>Side-panel AI context on the news desk</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-fuchsia-300" />
                  <span>No paywall on news pages</span>
                </li>
              </ul>
              <BuyButton
                plan="newsletter"
                label="Subscribe — $10/mo"
                className="w-full rounded-lg bg-fuchsia-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-fuchsia-300"
              />
            </div>

            {/* Starter Plan */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-500/10 p-8 backdrop-blur-sm">
              <div className="absolute right-6 top-6">
                <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-950">
                  Most popular
                </span>
              </div>
              <div className="mb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">Starter</span>
                <p className="mt-1 text-4xl font-bold text-white">
                  $29<span className="text-xl font-normal text-slate-300">/mo</span>
                </p>
                <p className="mt-2 text-sm text-slate-300">All reports + AI guide for solo operators and small teams</p>
              </div>
              <ul className="mb-8 space-y-3 text-sm text-slate-100">
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-300" />
                  <span><strong>Everything in Newsletter</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-300" />
                  <span>Full access to all research reports + rolling updates</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-300" />
                  <span>AI implementation guide (100 requests/day, $15/week budget)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-300" />
                  <span>Access to new research drops on publish</span>
                </li>
              </ul>
              <BuyButton
                plan="starter"
                label="Subscribe — $29/mo"
                className="w-full rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300"
              />
            </div>

            {/* Operator Access Plan */}
            <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-8 backdrop-blur-sm">
              <div className="absolute right-6 top-6">
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  For operators
                </span>
              </div>
              <div className="mb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Operator Access</span>
                <p className="mt-1 text-4xl font-bold text-white">
                  $49<span className="text-xl font-normal text-slate-300">/mo</span>
                </p>
                <p className="mt-2 text-sm text-slate-300">For teams actively building with agents</p>
              </div>
              <ul className="mb-8 space-y-3 text-sm text-slate-100">
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span><strong>Everything in Starter</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>5x higher AI token budget (500 requests/day, $60/week)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>Priority access to new research drops</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-300" />
                  <span>Best support path for urgent implementation work</span>
                </li>
              </ul>
              <BuyButton
                plan="pro"
                label="Subscribe — $49/mo"
                className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
              />
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Consultant and enterprise packaging</h2>
            <p className="mt-2 text-slate-400">
              Some buyers need a working session, audit, or scoped intervention instead of a content-only purchase.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {consultingPackages.map((pkg) => (
              <div key={pkg.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{pkg.price}</p>
                <h3 className="mt-3 text-xl font-bold text-white">{pkg.name}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{pkg.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/assessment" className="inline-flex rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
              Request assessment
            </Link>
            <Link href="/submit-work" className="inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5">
              Submit work
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-8 text-center">
          <p className="text-sm text-gray-500">
            All plans are billed monthly. Cancel anytime. Need help choosing?{" "}
            <Link href="/assessment" className="text-cyan-300 hover:text-cyan-200 underline">
              Take the assessment
            </Link>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
