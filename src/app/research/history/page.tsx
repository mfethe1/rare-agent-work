import { Metadata } from 'next';
import Link from 'next/link';
import reportHistory from '../../../../public/research/report-history.json';

export const metadata: Metadata = {
  title: 'Report Archive — Version History | Rare Agent Work',
  description:
    'Browse every version of our operator-grade AI research reports. Subscribers get full access to all historical versions and rolling updates.',
  alternates: {
    canonical: 'https://rareagent.work/research/history',
  },
};

interface HistoryEntry {
  id: string;
  date: string;
  version: string;
  title: string;
  summary: string;
  reports: string[];
  changes: string;
}

export default function ReportHistoryPage() {
  const entries = reportHistory as HistoryEntry[];

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
      <nav className="border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-white font-bold tracking-tighter">← Rare Agent Work</Link>
          <a href="/reports" className="bg-white text-black px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-200 transition-colors">
            Get Access
          </a>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-4">Report Archive</h1>
          <p className="text-gray-400 text-lg">Every report version since launch. Subscribers get full access to all historical versions.</p>
        </div>

        <div className="space-y-4">
          {entries.slice().reverse().map((entry, i) => (
            <div key={entry.id} className="border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition-colors">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-gray-900 border border-gray-800 px-2 py-1 rounded text-gray-400">
                    v{entry.version}
                  </span>
                  <span className="text-sm text-gray-500">{entry.date}</span>
                  {i === 0 && (
                    <span className="text-xs bg-green-900/50 text-green-300 border border-green-500/30 px-2 py-1 rounded">
                      Current
                    </span>
                  )}
                </div>
              </div>
              <h2 className="text-white font-bold text-lg mb-2">{entry.title}</h2>
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">{entry.summary}</p>
              {entry.changes && (
                <p className="text-gray-500 text-xs mb-4 italic">Changes: {entry.changes}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {entry.reports.map((slug) => (
                  <Link key={slug} href={`/reports/${slug}`}
                    className="text-xs border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors">
                    {slug} →
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 border border-blue-500/30 bg-blue-950/20 rounded-xl p-6 text-center">
          <h3 className="text-white font-bold mb-2">Get Notified on Every Update</h3>
          <p className="text-gray-400 text-sm mb-4">Subscribe for rolling updates every 3 days. New research, revised content, and release notes — plus unlimited AI guide access.</p>
          <a href="/reports" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors">
            Upgrade to Operator Access — $49/mo →
          </a>
        </div>
      </main>

      <footer className="border-t border-gray-800 py-8 text-center text-gray-600 text-sm">
        <p>© {new Date().getFullYear()} Rare Agent Work</p>
      </footer>
    </div>
  );
}
