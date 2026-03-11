'use client';

import ReportChat from '@/components/ReportChat';

interface NewsContextPanelProps {
  latestPublishedAt?: string;
  totalItems: number;
  hotItems: number;
  isStale?: boolean;
  summaryData?: { summary: string; updatedAt: string } | null;
}

function formatFreshness(date?: string) {
  if (!date) return 'No live feed yet';
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

export default function NewsContextPanel({ latestPublishedAt, totalItems, hotItems, isStale = false, summaryData }: NewsContextPanelProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-20">
      <div className="rounded-2xl border border-orange-500/30 bg-orange-950/20 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Subscriber Copilot</p>
            <h2 className="mt-1 text-xl font-bold text-white">Ask what matters</h2>
          </div>
          <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-1 text-[11px] font-medium text-orange-200">
            Live context
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-300">
          Get fast context on breaking agent news, who it affects, and what to do next.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-gray-800 bg-black/30 p-3">
            <p className="text-lg font-bold text-white">{totalItems}</p>
            <p className="text-gray-500">stories</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-black/30 p-3">
            <p className="text-lg font-bold text-white">{hotItems}</p>
            <p className="text-gray-500">hot now</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-black/30 p-3">
            <p className="text-lg font-bold text-white">24/7</p>
            <p className="text-gray-500">monitoring</p>
          </div>
        </div>

        <p className={`mt-4 text-xs ${isStale ? 'text-red-300' : 'text-gray-500'}`} data-testid="news-feed-freshness">
          {formatFreshness(latestPublishedAt)}
          {isStale ? ' · feed needs refresh' : ''}
        </p>
      </div>

      {summaryData && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-400">AI Summary</p>
            <div className="text-right">
              <p className="text-[10px] uppercase text-gray-500">Updated every 3h</p>
              <p className="text-[10px] text-gray-500" data-testid="news-summary-freshness">{formatFreshness(summaryData.updatedAt)}</p>
            </div>
          </div>
          <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap text-gray-300">
            {summaryData.summary}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <ReportChat
          reportSlug="news-feed"
          placeholder="What changed here, why does it matter, and what should a team do next?"
        />
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Why this wins</p>
        <ul className="mt-3 space-y-2 text-sm text-gray-300">
          <li>• Context beside the feed, not hidden behind another page</li>
          <li>• Clear freshness signal so people trust the product</li>
          <li>• Subscriber value tied to speed + interpretation, not just links</li>
        </ul>
      </div>
    </aside>
  );
}
