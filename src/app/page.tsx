import Image from 'next/image';
import Link from 'next/link';
import { getAllReports } from '@/lib/reports';
import ReportChat from '@/components/ReportChat';
import BuyButton from '@/components/BuyButton';
import ConsultingForm from '@/components/ConsultingForm';
import { WebsiteJsonLd } from '@/components/JsonLd';

const colorMap: Record<string, { border: string; text: string; btn: string }> = {
  blue: { border: 'border-cyan-400/20', text: 'text-cyan-300', btn: 'bg-cyan-500 hover:bg-cyan-400' },
  green: { border: 'border-emerald-400/20', text: 'text-emerald-300', btn: 'bg-emerald-500 hover:bg-emerald-400' },
  purple: { border: 'border-fuchsia-400/20', text: 'text-fuchsia-300', btn: 'bg-fuchsia-500 hover:bg-fuchsia-400' },
};



export default function Home() {
  const reports = getAllReports();

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
              <Link href="/news" prefetch={true} className="text-xs text-slate-400 transition-colors hover:text-white sm:text-sm">News Feed</Link>
              <Link href="/digest" prefetch={true} className="text-xs text-slate-400 transition-colors hover:text-white sm:text-sm">Weekly Digest</Link>
              <Link href="/reports" prefetch={true} className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Reports</Link>
              <Link href="/assessment" prefetch={true} className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Assessment</Link>
              <Link
                href="/pricing"
                prefetch={true}
                className="ml-1 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-all hover:border-cyan-200 hover:bg-cyan-400/20 sm:px-4 sm:text-sm"
              >
                View Plans
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <section className="flex flex-col items-center text-center">
          <div className="flex flex-col items-center">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-white/5 px-4 py-2 text-sm text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
              RareAgent.work for people actually shipping agents
            </div>

            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Bespoke intelligence for the
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-300 bg-clip-text text-transparent">
                rare agents doing real work
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              Rare Agent Work blends a premium operator news desk, applied research, and direct implementation support.
              Less generic AI content. More signal, sharper taste, and a brand that looks like it belongs in the room.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row justify-center">
              <Link href="/news" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-7 py-4 text-base font-semibold text-slate-950 shadow-[0_16px_50px_rgba(34,211,238,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-cyan-300">
                Explore live news
              </Link>
              <Link href="/reports" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10">
                Browse reports
              </Link>
            </div>
          </div>
        </section>
      </main>

      <section className="border-y border-white/10 bg-white/[0.03] py-20 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-16 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Platform Capabilities</p>
            <h2 className="mt-3 text-4xl font-bold text-white md:text-5xl">Three ways to accelerate your agent practice</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              From real-time intelligence to implementation expertise, Rare Agent Work delivers the clarity and support technical leaders need to ship production-grade agentic systems.
            </p>
          </header>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Daily Intelligence Feed */}
            <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-500/5 to-transparent backdrop-blur-sm transition-all hover:border-cyan-400/30 hover:shadow-[0_0_40px_rgba(34,211,238,0.15)]">
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src="/logos/Gemini_Generated_Image_e39wpje39wpje39w.jpg"
                  alt="Real-time intelligence monitoring for AI agent systems"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200 backdrop-blur-md">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                    Live updates
                  </div>
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-white">Daily Intelligence Feed</h3>
                <p className="mt-3 text-base leading-7 text-slate-300">
                  Stay ahead of the curve with curated, operator-grade news synthesized from academic research, framework releases, and community breakthroughs. Every story is filtered for signal, not hype.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-cyan-400">✓</span>
                    <span>Real-time updates on model releases, framework changes, and deployment patterns</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-cyan-400">✓</span>
                    <span>AI-powered context panel for instant technical deep-dives</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-cyan-400">✓</span>
                    <span>Weekly digest delivered to subscribers with actionable takeaways</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <Link
                    href="/news"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
                  >
                    Explore the news feed
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </div>
            </article>

            {/* Deep-Dive Reports */}
            <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-fuchsia-500/5 to-transparent backdrop-blur-sm transition-all hover:border-fuchsia-400/30 hover:shadow-[0_0_40px_rgba(217,70,239,0.15)]">
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src="/logos/Gemini_Generated_Image_b1ebffb1ebffb1eb.jpg"
                  alt="Comprehensive research reports for agentic architecture"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold text-fuchsia-200 backdrop-blur-md">
                    <span className="text-fuchsia-400">📚</span>
                    Reference library
                  </div>
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-white">Deep-Dive Reports</h3>
                <p className="mt-3 text-base leading-7 text-slate-300">
                  Operator-grade implementation playbooks that cut through the noise. From single-agent setup to multi-agent orchestration, get the architectural guidance you need to build with confidence.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-fuchsia-400">✓</span>
                    <span>Battle-tested patterns for production deployment and reliability</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-fuchsia-400">✓</span>
                    <span>Framework comparisons with real-world performance benchmarks</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-fuchsia-400">✓</span>
                    <span>Decision trees for tool selection, observability, and cost optimization</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <Link
                    href="/reports"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-300 transition-colors hover:text-fuchsia-200"
                  >
                    Browse the report catalog
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </div>
            </article>

            {/* Enterprise Implementation */}
            <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-500/5 to-transparent backdrop-blur-sm transition-all hover:border-emerald-400/30 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src="/logos/Gemini_Generated_Image_mtgvo9mtgvo9mtgv.jpg"
                  alt="Enterprise consulting for AI agent implementation"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200 backdrop-blur-md">
                    <span className="text-emerald-400">🤝</span>
                    Direct access
                  </div>
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-white">Enterprise Implementation</h3>
                <p className="mt-3 text-base leading-7 text-slate-300">
                  Bring Michael in for hands-on strategy, architecture review, and deployment design. Perfect for teams that need expert guidance to de-risk their agent roadmap and accelerate time-to-production.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-emerald-400">✓</span>
                    <span>Product strategy and market positioning for agent-powered offerings</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-emerald-400">✓</span>
                    <span>Multi-agent workflow design and reliability audits</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 text-emerald-400">✓</span>
                    <span>Executive briefings and technical decision support</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <Link
                    href="/assessment"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition-colors hover:text-emerald-200"
                  >
                    Request consulting
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Three-Tier Access Model</p>
            <h2 className="mb-3 text-3xl font-bold text-white">Start free, buy reports, or subscribe</h2>
            <p className="mx-auto max-w-3xl text-lg text-slate-300">
              Operator-grade intelligence with transparent pricing. No hype, no fluff—just speed, interpretation, and access to expertise.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Free Access</span>
                <p className="mt-1 text-3xl font-bold text-white">$0</p>
                <p className="mt-1 text-sm text-slate-400">Try before you commit</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-slate-300">
                <li>✓ Browse live news feed</li>
                <li>✓ Read all report previews</li>
                <li>✓ Limited AI questions (10/day)</li>
                <li>✓ Model leaderboard access</li>
              </ul>
              <Link href="/news" className="inline-flex rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15">
                Start free
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-[1.75rem] border border-fuchsia-400/30 bg-fuchsia-500/10 p-7 backdrop-blur-sm">
              <div className="absolute right-4 top-4">
                <span className="rounded-full bg-fuchsia-400 px-2.5 py-1 text-xs font-semibold text-slate-950">Best entry point</span>
              </div>
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200">Newsletter</span>
                <p className="mt-1 text-3xl font-bold text-white">$10<span className="text-lg font-normal text-slate-300">/mo</span></p>
                <p className="mt-1 text-sm text-slate-300">Signal without the noise</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-slate-100">
                <li>✓ Weekly premium newsletter</li>
                <li>✓ Hot-news alerts</li>
                <li>✓ Side-panel AI context</li>
                <li>✓ Operator summaries</li>
              </ul>
              <BuyButton plan="newsletter" label="Subscribe — $10/mo" className="inline-flex rounded-full bg-fuchsia-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-fuchsia-300" />
            </div>

            <div className="rounded-[1.75rem] border border-cyan-400/30 bg-cyan-500/10 p-7 backdrop-blur-sm">
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Operator Access</span>
                <p className="mt-1 text-3xl font-bold text-white">$49<span className="text-lg font-normal text-slate-300">/mo</span></p>
                <p className="mt-1 text-sm text-slate-300">For teams actively shipping</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-slate-100">
                <li>✓ Everything in Newsletter</li>
                <li>✓ Full report library + updates</li>
                <li>✓ Higher AI budget (500/day)</li>
                <li>✓ Priority research access</li>
              </ul>
              <BuyButton plan="pro" label="Subscribe — $49/mo" className="inline-flex rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300" />
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              Or buy individual reports ($29–$299).{" "}
              <Link href="/pricing" className="text-cyan-300 hover:text-cyan-200 underline">
                View full pricing →
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Three ways to access</p>
          <h2 className="mb-4 text-4xl font-bold text-white">Free browsing, one-time reports, or subscriptions</h2>
          <p className="mx-auto max-w-3xl text-lg text-slate-300">
            Operator-grade intelligence delivered three ways: start free, buy exactly what you need, or subscribe for continuous access and rolling updates.
          </p>
        </div>

        <div className="mb-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-[1.75rem] border border-fuchsia-400/30 bg-fuchsia-500/10 p-7 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-fuchsia-400 px-2.5 py-1 text-xs font-semibold text-slate-950">New core offer</span>
              <span className="text-sm font-semibold text-fuchsia-200">$10/mo</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Newsletter membership</h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Weekly premium newsletter, hot-news alerts, and side-panel AI context built for subscribed operators.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li>✓ Premium newsletter</li>
              <li>✓ Hot-news alerts</li>
              <li>✓ Contextual AI chat on the news feed</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <BuyButton plan="newsletter" label="Get newsletter — $10/mo" className="inline-flex rounded-full bg-fuchsia-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-fuchsia-300" />
              <Link href="/pricing" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                View pricing
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-cyan-400/30 bg-cyan-500/10 p-7 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">Live desk</span>
              <span className="text-sm font-semibold text-cyan-200">Updated continuously</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Hot-news feed + subscriber copilot</h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Breaking agent news with context beside the feed — what changed, why it matters, and what a team should do next.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li>✓ Freshness signals on the feed</li>
              <li>✓ Side-panel context chat</li>
              <li>✓ Built for operators, not casual readers</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/news" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300">
                Open live news
              </Link>
              <Link href="/digest" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Read digest
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-emerald-400/30 bg-emerald-500/10 p-7 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">Direct access</span>
              <span className="text-sm font-semibold text-emerald-200">Consulting</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Bring Michael in</h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              For teams that need strategy, architecture review, implementation help, or an operator-grade audit of what they are building.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li>✓ Intake form on-site</li>
              <li>✓ Email routed directly to Michael</li>
              <li>✓ Best for serious agent teams</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="#assessment" className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300">
                Request consulting
              </Link>
              <Link href="/assessment" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Open assessment
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-10 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Reference library</p>
              <h3 className="mt-2 text-2xl font-bold text-white">Operator-grade reports still anchor the catalog</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                The reports remain the durable reference layer: implementation playbooks, architecture guidance, and technical decision support.
              </p>
            </div>
            <Link href="/reports" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
              Browse all reports
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {reports.map((report) => {
            const c = colorMap[report.color] ?? colorMap.blue;
            const excerpt = report.excerpt[0];
            return (
              <div key={report.slug} className={`flex flex-col rounded-[1.75rem] border ${c.border} bg-white/[0.04] p-8 transition-all hover:-translate-y-1 hover:border-white/20`}>
                <div className="mb-3 flex items-start justify-between">
                  <span className={`text-2xl font-extrabold ${c.text}`}>{report.price}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">{report.priceLabel}</span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-white">{report.title}</h3>
                <p className={`mb-3 text-sm font-semibold ${c.text}`}>{report.subtitle}</p>
                <p className="mb-4 text-sm leading-relaxed text-slate-300">{report.audience}</p>

                <div className={`mb-5 border-l-2 ${c.text.replace('text-', 'border-')} pl-4`}>
                  <p className={`mb-1 text-xs font-semibold ${c.text}`}>{excerpt.heading}</p>
                  <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">
                    {excerpt.body.split('\n\n')[0].replace(/\*\*(.*?)\*\*/g, '$1')}
                  </p>
                </div>

                <div className="mb-5 space-y-2">
                  {report.deliverables.slice(0, 3).map((d) => (
                    <div key={d.title} className="flex items-start gap-2 text-sm">
                      <span>{d.icon}</span>
                      <span className="text-slate-300">{d.title}</span>
                    </div>
                  ))}
                  <p className="pl-6 text-xs text-slate-500">+ {report.deliverables.length - 3} more sections</p>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  <Link href={`/reports/${report.slug}`} className={`text-center text-sm font-semibold ${c.text} hover:underline`}>
                    Read preview →
                  </Link>
                  <BuyButton label={`Buy — ${report.price}`} plan={report.planKey} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="guide" className="border-y border-white/10 bg-white/[0.03] py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-3xl font-bold text-white">Ask the AI guide</h2>
            <p className="text-slate-300">Use the same expert framing that powers the reports and the news desk.</p>
            <p className="mt-2 text-sm text-slate-400">
              <Link href="/auth/login" className="text-cyan-300 underline hover:text-cyan-200">Sign in</Link>
              {' '}for higher usage limits and full member access.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-[#07111f]/90 p-6 shadow-[0_20px_60px_rgba(5,8,22,0.55)]">
            <ReportChat placeholder="What should I build first? Which frameworks are real? How do I avoid the common traps?" />
          </div>
        </div>
      </section>

      <section id="assessment" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Assessment</p>
            <h2 className="mt-3 text-4xl font-bold text-white">Need hands-on help? Bring Michael in directly.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Strategy, architecture review, deployment design, implementation rescue, and executive briefings for teams building serious agent systems.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>• AI agent product strategy and market positioning</p>
              <p>• Workflow and multi-agent architecture reviews</p>
              <p>• High-trust implementation plans for internal teams and clients</p>
              <p>• Rapid audits of reliability, observability, and deployment risk</p>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <ConsultingForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="mb-2 text-2xl font-bold text-white">Report History</h2>
            <p className="text-sm text-slate-400">Every version archived. Subscribers get access to the full history.</p>
          </div>
          <Link href="/research/history" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            Full archive →
          </Link>
        </div>
        <div className="divide-y divide-white/10 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03]">
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <span className="mb-1 block text-xs font-mono text-slate-400">v1.0 · Mar 4, 2026</span>
              <p className="text-sm font-semibold text-white">Initial Launch — Three core operator reports</p>
              <p className="mt-1 text-xs text-slate-400">Agent Setup in 60 Minutes · Single to Multi-Agent · Empirical Architecture</p>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">Current</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-sm text-slate-400">
        <p className="mb-3">© {new Date().getFullYear()} Rare Agent Work. Bespoke operator-grade AI research and news.</p>
        <div className="mb-3 flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/news" className="transition-colors hover:text-white">News Feed</Link>
          <span className="text-white/20">·</span>
          <Link href="/digest" className="transition-colors hover:text-white">Weekly Digest</Link>
          <span className="text-white/20">·</span>
          <Link href="/assessment" className="transition-colors hover:text-white">Assessment</Link>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/research/history" className="transition-colors hover:text-white">Report Archive</Link>
          <span className="text-white/20">·</span>
          <Link href="/auth/login" className="transition-colors hover:text-white">Sign In</Link>
          <span className="text-white/20">·</span>
          <a href="mailto:hello@rareagent.work" className="transition-colors hover:text-white">hello@rareagent.work</a>
        </div>
      </footer>
    </div>
  );
}
