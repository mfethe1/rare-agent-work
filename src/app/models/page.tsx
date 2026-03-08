import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Model index under review',
  description:
    'The Rare Agent Work model leaderboard is temporarily offline while we rebuild the evaluation with fresher data, transparent methodology, and a live update cadence.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://rareagent.work/models',
  },
};

export default function ModelsPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-[#0d0d0d]/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-12 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-bold tracking-tight text-orange-500">
                Rare Agent Work
              </Link>
              <div className="hidden items-center gap-4 sm:flex">
                <Link href="/news" className="text-sm text-gray-400 transition-colors hover:text-white">News</Link>
                <Link href="/#catalog" className="text-sm text-gray-400 transition-colors hover:text-white">Reports</Link>
                <Link href="/assessment" className="text-sm text-gray-400 transition-colors hover:text-white">Assessment</Link>
              </div>
            </div>
            <Link
              href="/#catalog"
              className="rounded bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700"
            >
              Get Reports
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-950/10 p-8 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">Temporarily offline</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">The model leaderboard is under review.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-300">
            We pulled this page out of public positioning because stale rankings create more confusion than clarity.
            It will only return once the evaluation has fresh data, transparent methodology, and a live maintenance cadence.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-5">
              <h2 className="text-sm font-semibold text-white">Relaunch requirements</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>• Visible last-updated timestamp</li>
                <li>• Clear scoring methodology</li>
                <li>• Automated refresh cadence and alerts</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-5">
              <h2 className="text-sm font-semibold text-white">Why it is offline</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>• Trust matters more than filler content</li>
                <li>• Precise scores need evidence</li>
                <li>• Outdated rankings weaken the rest of the site</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-5">
              <h2 className="text-sm font-semibold text-white">Read these instead</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>• Start Here for implementation order</li>
                <li>• News for platform drift</li>
                <li>• Reports for operator-grade evaluations</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/start-here"
              className="inline-flex items-center rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
            >
              Read Start Here
            </Link>
            <Link
              href="/reports/empirical-architecture"
              className="inline-flex items-center rounded-lg border border-gray-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-gray-500"
            >
              Read the empirical report
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
