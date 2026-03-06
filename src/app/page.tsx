import Link from 'next/link';
import { getAllReports } from '@/lib/reports';
import ReportChat from '@/components/ReportChat';
import BuyButton from '@/components/BuyButton';

const colorMap: Record<string, { border: string; text: string; btn: string }> = {
  blue:   { border: 'border-blue-500/20',   text: 'text-blue-400',   btn: 'bg-blue-600 hover:bg-blue-700' },
  green:  { border: 'border-green-500/20',  text: 'text-green-400',  btn: 'bg-green-600 hover:bg-green-700' },
  purple: { border: 'border-purple-500/20', text: 'text-purple-400', btn: 'bg-purple-600 hover:bg-purple-700' },
};

export default function Home() {
  const reports = getAllReports();

  return (
    <div className="min-h-screen bg-black text-gray-100 selection:bg-blue-500 selection:text-white font-sans">

      {/* Nav */}
      <nav className="border-b border-gray-800 sticky top-0 z-50 bg-black/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-xl font-bold tracking-tighter text-white">Rare Agent Work</span>
            <div className="flex items-center gap-3">
              <a href="#catalog" className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block">Reports</a>
              <a href="#guide" className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block">AI Guide</a>
              <Link href="/auth/login" className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block">Sign in</Link>
              <a href="#catalog" className="bg-white text-black px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-200 transition-colors">
                Get Access
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-500/30 rounded-full px-4 py-2 text-sm text-blue-300 mb-8">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Updated every 3 days — next refresh in 2 days
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8">
            Operator-Grade AI Research{' '}
            <span className="text-blue-500">You Can Actually Use</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-10 leading-relaxed max-w-3xl mx-auto">
            Practical, deeply researched reports on low-code automation, multi-agent systems, and empirical deployment standards.
            Not tutorials. Not overviews. Operator playbooks with real implementation detail.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <a href="#catalog" className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 w-full sm:w-auto text-center">
              View Report Catalog
            </a>
            <a href="#guide" className="border border-gray-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-all w-full sm:w-auto text-center">
              Ask the AI Guide
            </a>
          </div>
        </div>
      </main>

      {/* Value Prop Section — replaces raw Free Access Pass */}
      <section id="access" className="bg-gray-900 border-y border-gray-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">
              Start reading free. Upgrade when you need more.
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Every report has a free preview. Paid plans unlock full access, AI-guided implementation, and rolling research updates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free Card */}
            <div className="bg-black border border-gray-800 rounded-2xl p-7 flex flex-col">
              <div className="mb-5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Free</span>
                <p className="text-3xl font-bold text-white mt-1">$0</p>
                <p className="text-gray-500 text-sm mt-1">No signup required for previews</p>
              </div>
              <ul className="space-y-3 mb-7 flex-1">
                {[
                  '1 rotating report every 2 weeks',
                  'Full report archive browsing',
                  'No signup required for previews',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                {reports.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/reports/${r.slug}`}
                    className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
                  >
                    Preview: {r.title}
                  </Link>
                ))}
              </div>
            </div>

            {/* Paid Card */}
            <div className="bg-blue-950/20 border border-blue-500/40 rounded-2xl p-7 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">Best Value</span>
              </div>
              <div className="mb-5">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Starter · Pro</span>
                <p className="text-3xl font-bold text-white mt-1">From $29<span className="text-lg font-normal text-gray-400">/mo</span></p>
                <p className="text-gray-400 text-sm mt-1">Cancel anytime</p>
              </div>
              <ul className="space-y-3 mb-7 flex-1">
                {[
                  'All reports — current and future',
                  'AI Implementation Guide (Claude Sonnet)',
                  'Token-based usage (50k–200k/mo)',
                  'PDF downloads (Pro)',
                  'Early access to new reports (Pro)',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-200">
                    <span className="text-blue-400 mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <BuyButton label="Start with Starter — $29/mo" plan="starter" />
                <BuyButton label="Go Pro — $99/mo" plan="pro" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Report Catalog */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Report Catalog</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Three deeply researched, operator-grade reports. Buy individually or subscribe for all three plus rolling updates.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reports.map((report) => {
            const c = colorMap[report.color] ?? colorMap.blue;
            const excerpt = report.excerpt[0];
            return (
              <div key={report.slug} className={`bg-black border ${c.border} hover:border-gray-600 rounded-2xl p-8 transition-all flex flex-col`}>
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-2xl font-extrabold ${c.text}`}>{report.price}</span>
                  <span className="text-xs text-gray-500 border border-gray-800 px-2 py-1 rounded">{report.priceLabel}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{report.title}</h3>
                <p className={`text-sm font-semibold ${c.text} mb-3`}>{report.subtitle}</p>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">{report.audience}</p>

                {/* Mini preview of real content */}
                <div className={`border-l-2 ${c.text.replace('text-', 'border-')} pl-4 mb-5`}>
                  <p className={`text-xs font-semibold ${c.text} mb-1`}>{excerpt.heading}</p>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-3">
                    {excerpt.body.split('\n\n')[0].replace(/\*\*(.*?)\*\*/g, '$1')}
                  </p>
                </div>

                <div className="space-y-2 mb-5">
                  {report.deliverables.slice(0, 3).map((d) => (
                    <div key={d.title} className="flex items-start gap-2 text-sm">
                      <span>{d.icon}</span>
                      <span className="text-gray-400">{d.title}</span>
                    </div>
                  ))}
                  <p className="text-gray-600 text-xs pl-6">+ {report.deliverables.length - 3} more sections</p>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  <Link href={`/reports/${report.slug}`}
                    className={`text-center text-sm ${c.text} hover:underline font-semibold`}>
                    Read preview →
                  </Link>
                  <BuyButton label={`Buy — ${report.price}`} plan={report.planKey} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Subscription box */}
        <div className="max-w-4xl mx-auto border border-blue-500/30 bg-blue-950/20 rounded-2xl p-8 md:p-10 mt-12 text-center">
          <div className="inline-flex items-center gap-2 text-blue-300 text-sm font-semibold mb-4">
            <span>★★★★★</span>
            <span>Best Value</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-3">All Access — Starter Plan</h3>
          <p className="text-gray-300 mb-2 text-lg">$29/mo — Cancel anytime</p>
          <ul className="text-gray-400 text-sm space-y-1 mb-6 max-w-md mx-auto">
            <li>✓ All current reports + every future report</li>
            <li>✓ Content updated every 3 days with fresh research</li>
            <li>✓ AI Implementation Guide (50k tokens/mo)</li>
            <li>✓ Full report history archive access</li>
          </ul>
          <BuyButton label="Get Starter Access — $29/mo" plan="starter" />
        </div>
      </section>

      {/* AI Guide */}
      <section id="guide" className="bg-gray-900 border-y border-gray-800 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-3">Ask the Agent Setup Guide</h2>
            <p className="text-gray-400">Expert AI implementation help, powered by Claude Sonnet 4.6. Ask about platforms, architecture, failure modes, or which report fits your use case.</p>
            <p className="text-sm text-gray-500 mt-2">
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 underline">Sign in</Link>
              {' '}to unlock AI guide access (Starter and Pro plans).
            </p>
          </div>
          <div className="border border-gray-700 rounded-2xl p-6 bg-black/40">
            <ReportChat placeholder="What's the right agent framework for my team? How do I avoid common pitfalls?" />
          </div>
        </div>
      </section>

      {/* Report History */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Report History</h2>
            <p className="text-gray-400 text-sm">Every version archived. Subscribers get access to the full history.</p>
          </div>
          <Link href="/research/history" className="text-blue-400 hover:text-blue-300 text-sm font-semibold">
            Full archive →
          </Link>
        </div>
        <div className="border border-gray-800 rounded-xl divide-y divide-gray-800">
          <div className="p-5 flex items-start justify-between">
            <div>
              <span className="text-xs font-mono text-gray-500 mb-1 block">v1.0 · Mar 4, 2026</span>
              <p className="text-white font-semibold text-sm">Initial Launch — Three core operator reports</p>
              <p className="text-gray-500 text-xs mt-1">Agent Setup in 60 Minutes · Single to Multi-Agent · Empirical Architecture</p>
            </div>
            <span className="text-xs bg-green-900/50 text-green-300 border border-green-500/30 px-2 py-1 rounded">Current</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-10 text-center text-gray-500 text-sm">
        <p className="mb-2">© {new Date().getFullYear()} Rare Agent Work. Operator-grade AI research.</p>
        <p>
          <a href="mailto:hello@rareagent.work" className="hover:text-gray-300 transition-colors">hello@rareagent.work</a>
          {' · '}
          <Link href="/research/history" className="hover:text-gray-300 transition-colors">Report Archive</Link>
          {' · '}
          <Link href="/auth/login" className="hover:text-gray-300 transition-colors">Sign In</Link>
        </p>
      </footer>
    </div>
  );
}
