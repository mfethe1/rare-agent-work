import { Metadata } from 'next';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';

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
    <div className="min-h-screen bg-[#050816] text-gray-100">
      <SiteNav primaryCta={{ label: 'Browse Reports', href: '/reports' }} />

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
              href="/methodology"
              className="inline-flex items-center rounded-lg border border-gray-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-gray-500"
            >
              Review methodology
            </Link>
            <Link
              href="/reports/empirical-agent-architecture"
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
