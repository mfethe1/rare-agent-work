import Link from 'next/link';
import { getAllReports } from '@/lib/reports';
import ReportChat from '@/components/ReportChat';
import BuyButton from '@/components/BuyButton';
import ConsultingForm from '@/components/ConsultingForm';
import { WebsiteJsonLd } from '@/components/JsonLd';

const colorMap: Record<string, { border: string; text: string; btn: string }> = {
  blue: { border: 'border-blue-500/20', text: 'text-blue-400', btn: 'bg-blue-600 hover:bg-blue-700' },
  green: { border: 'border-green-500/20', text: 'text-green-400', btn: 'bg-green-600 hover:bg-green-700' },
  purple: { border: 'border-purple-500/20', text: 'text-purple-400', btn: 'bg-purple-600 hover:bg-purple-700' },
};

export default function Home() {
  const reports = getAllReports();

  return (
    <div className="min-h-screen bg-black font-sans text-gray-100 selection:bg-blue-500 selection:text-white">
      <WebsiteJsonLd />

      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-black/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <span className="text-xl font-bold tracking-tighter text-white">Rare Agent Work</span>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/start-here" className="text-xs text-gray-400 transition-colors hover:text-white sm:text-sm">Start Here</Link>
              <Link href="/news" className="text-xs text-gray-400 transition-colors hover:text-white sm:text-sm">News</Link>
              <Link href="/models" className="text-xs text-gray-400 transition-colors hover:text-white sm:text-sm">Models</Link>
              <Link href="/digest" className="hidden text-xs text-gray-400 transition-colors hover:text-white sm:block sm:text-sm">Digest</Link>
              <a href="#catalog" className="hidden text-xs text-gray-400 transition-colors hover:text-white sm:block sm:text-sm">Reports</a>
              <Link href="/assessment" className="hidden text-xs text-gray-400 transition-colors hover:text-white sm:block sm:text-sm">Assessment</Link>
              <a href="#pricing" className="ml-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-gray-200 sm:px-4 sm:text-sm">
                View Pricing
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/60 px-4 py-2 text-sm text-blue-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            Guides for humans. Structured surfaces for agents. Practical systems for teams.
          </div>
          <h1 className="mb-8 text-5xl font-extrabold tracking-tight text-white md:text-7xl">
            Become better at <span className="text-blue-500">building, auditing, and scaling agentic systems</span>
          </h1>
          <p className="mx-auto mb-10 max-w-4xl text-xl leading-relaxed text-gray-400 md:text-2xl">
            Rare Agent Work is building toward the best source for agentic setup: live market intelligence, model comparisons,
            operator-grade research, and direct implementation help for teams that want systems that hold up outside the demo.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/start-here" className="w-full rounded-lg bg-blue-600 px-8 py-4 text-center text-lg font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 sm:w-auto">
              Start Here
            </Link>
            <Link href="/assessment" className="w-full rounded-lg border border-gray-700 px-8 py-4 text-center text-lg font-semibold text-white transition-all hover:bg-gray-800 sm:w-auto">
              Get an Assessment
            </Link>
          </div>
        </div>
      </main>

      <section id="pricing" className="border-y border-gray-800 bg-gray-900 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-3xl font-bold text-white">Clear pricing, clearer outcomes</h2>
            <p className="mx-auto max-w-3xl text-lg text-gray-400">
              Competitors mostly sell links or hype. We should sell speed, interpretation, and access to expertise.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-800 bg-black p-7">
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Free</span>
                <p className="mt-1 text-3xl font-bold text-white">$0</p>
                <p className="mt-1 text-sm text-gray-500">Try the product before committing</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-gray-300">
                <li>✓ Browse the live news feed</li>
                <li>✓ Read report previews</li>
                <li>✓ Ask limited AI questions</li>
              </ul>
              <Link href="/news" className="inline-flex rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700">
                Start free
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-orange-500/40 bg-orange-950/20 p-7">
              <div className="absolute right-4 top-4">
                <span className="rounded-full bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white">Best entry point</span>
              </div>
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-300">Newsletter</span>
                <p className="mt-1 text-3xl font-bold text-white">$10<span className="text-lg font-normal text-gray-400">/mo</span></p>
                <p className="mt-1 text-sm text-gray-400">For people who want the signal without the noise</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-gray-200">
                <li>✓ Weekly premium newsletter</li>
                <li>✓ Hot-news alerts as important stories land</li>
                <li>✓ Side-panel AI context on the news desk</li>
                <li>✓ Operator summaries focused on what changed and what to do next</li>
              </ul>
              <BuyButton plan="newsletter" label="Get the newsletter — $10/mo" className="inline-flex rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700" />
            </div>

            <div className="rounded-2xl border border-blue-500/40 bg-blue-950/20 p-7">
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">Operator Access</span>
                <p className="mt-1 text-3xl font-bold text-white">$49<span className="text-lg font-normal text-gray-400">/mo</span></p>
                <p className="mt-1 text-sm text-gray-400">For teams actively building with agents</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-gray-200">
                <li>✓ Everything in Newsletter</li>
                <li>✓ Full report library and rolling updates</li>
                <li>✓ More AI implementation help</li>
                <li>✓ Priority access to new research drops</li>
              </ul>
              <BuyButton plan="pro" label="Get operator access — $49/mo" className="inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700" />
            </div>
          </div>
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-white">Report Catalog</h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-400">Deep operator-grade reports for buyers who want durable reference material, not just a feed.</p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {reports.map((report) => {
            const c = colorMap[report.color] ?? colorMap.blue;
            const excerpt = report.excerpt[0];
            return (
              <div key={report.slug} className={`flex flex-col rounded-2xl border ${c.border} bg-black p-8 transition-all hover:border-gray-600`}>
                <div className="mb-3 flex items-start justify-between">
                  <span className={`text-2xl font-extrabold ${c.text}`}>{report.price}</span>
                  <span className="rounded border border-gray-800 px-2 py-1 text-xs text-gray-500">{report.priceLabel}</span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-white">{report.title}</h3>
                <p className={`mb-3 text-sm font-semibold ${c.text}`}>{report.subtitle}</p>
                <p className="mb-4 text-sm leading-relaxed text-gray-400">{report.audience}</p>

                <div className={`mb-5 border-l-2 ${c.text.replace('text-', 'border-')} pl-4`}>
                  <p className={`mb-1 text-xs font-semibold ${c.text}`}>{excerpt.heading}</p>
                  <p className="line-clamp-3 text-xs leading-relaxed text-gray-500">
                    {excerpt.body.split('\n\n')[0].replace(/\*\*(.*?)\*\*/g, '$1')}
                  </p>
                </div>

                <div className="mb-5 space-y-2">
                  {report.deliverables.slice(0, 3).map((d) => (
                    <div key={d.title} className="flex items-start gap-2 text-sm">
                      <span>{d.icon}</span>
                      <span className="text-gray-400">{d.title}</span>
                    </div>
                  ))}
                  <p className="pl-6 text-xs text-gray-600">+ {report.deliverables.length - 3} more sections</p>
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

      <section id="guide" className="border-y border-gray-800 bg-gray-900 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-3xl font-bold text-white">Ask the AI guide</h2>
            <p className="text-gray-400">Use the same expert framing that powers the reports and the news desk.</p>
            <p className="mt-2 text-sm text-gray-500">
              <Link href="/auth/login" className="text-blue-400 underline hover:text-blue-300">Sign in</Link>
              {' '}for higher usage limits and full member access.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-700 bg-black/40 p-6">
            <ReportChat placeholder="What should I build first? Which frameworks are real? How do I avoid the common traps?" />
          </div>
        </div>
      </section>

      <section id="consulting" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">Consulting</p>
            <h2 className="mt-3 text-4xl font-bold text-white">Need hands-on help? Bring Michael in directly.</h2>
            <p className="mt-4 text-lg leading-8 text-gray-400">
              Offer strategy, architecture review, deployment design, implementation rescue, and executive briefings for teams building serious agent systems.
            </p>
            <div className="mt-6 space-y-3 text-sm text-gray-300">
              <p>• AI agent product strategy and market positioning</p>
              <p>• Workflow and multi-agent architecture reviews</p>
              <p>• High-trust implementation plans for internal teams and clients</p>
              <p>• Rapid audits of reliability, observability, and deployment risk</p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
            <ConsultingForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-2xl font-bold text-white">Report History</h2>
            <p className="text-sm text-gray-400">Every version archived. Subscribers get access to the full history.</p>
          </div>
          <Link href="/research/history" className="text-sm font-semibold text-blue-400 hover:text-blue-300">
            Full archive →
          </Link>
        </div>
        <div className="divide-y divide-gray-800 rounded-xl border border-gray-800">
          <div className="flex items-start justify-between p-5">
            <div>
              <span className="mb-1 block text-xs font-mono text-gray-500">v1.0 · Mar 4, 2026</span>
              <p className="text-sm font-semibold text-white">Initial Launch — Three core operator reports</p>
              <p className="mt-1 text-xs text-gray-500">Agent Setup in 60 Minutes · Single to Multi-Agent · Empirical Architecture</p>
            </div>
            <span className="rounded border border-green-500/30 bg-green-900/50 px-2 py-1 text-xs text-green-300">Current</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-10 text-center text-sm text-gray-500">
        <p className="mb-3">© {new Date().getFullYear()} Rare Agent Work. Operator-grade AI research and news.</p>
        <div className="mb-3 flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/news" className="transition-colors hover:text-gray-300">News Feed</Link>
          <span className="text-gray-700">·</span>
          <Link href="/models" className="transition-colors hover:text-gray-300">Model Leaderboard</Link>
          <span className="text-gray-700">·</span>
          <Link href="/digest" className="transition-colors hover:text-gray-300">Weekly Digest</Link>
          <span className="text-gray-700">·</span>
          <a href="#consulting" className="transition-colors hover:text-gray-300">Consulting</a>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/research/history" className="transition-colors hover:text-gray-300">Report Archive</Link>
          <span className="text-gray-700">·</span>
          <Link href="/auth/login" className="transition-colors hover:text-gray-300">Sign In</Link>
          <span className="text-gray-700">·</span>
          <a href="mailto:hello@rareagent.work" className="transition-colors hover:text-gray-300">hello@rareagent.work</a>
        </div>
      </footer>
    </div>
  );
}
