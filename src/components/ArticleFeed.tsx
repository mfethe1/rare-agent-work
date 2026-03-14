'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

interface Article {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  source: string | null;
  upvotes: number;
  clicks: number;
  score: number;
  tags: string[];
  created_at: string;
}

interface ArticleFeedProps {
  articles: Article[];
  votedIds: Set<string>;
  activeTag: string;
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TABS = ['All', 'Tool-Use', 'Frameworks', 'Research', 'Open-Source'] as const;
const TAG_MAP: Record<string, string> = {
  'Tool-Use': 'tool-use',
  'Frameworks': 'frameworks',
  'Research': 'research',
  'Open-Source': 'open-source',
};

export default function ArticleFeed({ articles, votedIds, activeTag }: ArticleFeedProps) {
  const [localVoted, setLocalVoted] = useState<Set<string>>(new Set(votedIds));
  const [localUpvotes, setLocalUpvotes] = useState<Record<string, number>>(
    Object.fromEntries(articles.map((a) => [a.id, a.upvotes]))
  );
  const [isPending, startTransition] = useTransition();
  const [clickedIds, setClickedIds] = useState<Set<string>>(new Set());

  const handleVote = async (articleId: string) => {
    if (localVoted.has(articleId)) return;
    setLocalVoted((prev) => new Set([...prev, articleId]));
    setLocalUpvotes((prev) => ({ ...prev, [articleId]: (prev[articleId] || 0) + 1 }));

    startTransition(async () => {
      try {
        await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId }),
        });
      } catch {
        // Revert on error
        setLocalVoted((prev) => {
          const next = new Set(prev);
          next.delete(articleId);
          return next;
        });
        setLocalUpvotes((prev) => ({ ...prev, [articleId]: (prev[articleId] || 1) - 1 }));
      }
    });
  };

  const handleClick = async (article: Article) => {
    if (!clickedIds.has(article.id)) {
      setClickedIds((prev) => new Set([...prev, article.id]));
      // Fire-and-forget click increment
      fetch('/api/articles/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.id }),
      }).catch(() => {});
    }
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  const hasLowCode = articles.some((a) =>
    (a.tags || []).some((t) => t.toLowerCase() === 'low-code')
  );

  return (
    <div className="flex gap-8">
      {/* Main feed */}
      <div className="flex-1 min-w-0">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 flex-wrap">
          {TABS.map((tab) => {
            const tagVal = tab === 'All' ? '' : TAG_MAP[tab];
            const isActive = activeTag === tagVal;
            return (
              <Link
                key={tab}
                href={tab === 'All' ? '/news' : `/news?tag=${tagVal}`}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab}
              </Link>
            );
          })}
        </div>

        {/* Article list */}
        {articles.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No articles yet.</p>
            <p className="text-sm mt-2">Check back soon — Rosie's cron drops new links daily.</p>
          </div>
        ) : (
          <ol className="space-y-0">
            {articles.map((article, index) => {
              const voted = localVoted.has(article.id);
              const upvotes = localUpvotes[article.id] ?? article.upvotes;
              return (
                <li
                  key={article.id}
                  className="flex items-start gap-3 py-3 px-2 rounded-lg hover:bg-gray-900/40 transition-colors group"
                >
                  {/* Rank */}
                  <span className="text-gray-600 text-sm font-mono w-6 text-right shrink-0 pt-0.5">
                    {index + 1}.
                  </span>

                  {/* Upvote button */}
                  <button
                    onClick={() => handleVote(article.id)}
                    disabled={voted || isPending}
                    className={`flex flex-col items-center shrink-0 pt-0.5 ${
                      voted
                        ? 'text-orange-400 cursor-default'
                        : 'text-gray-500 hover:text-orange-400 cursor-pointer'
                    } transition-colors`}
                    title={voted ? 'Already voted' : 'Upvote'}
                  >
                    <span className="text-base leading-none">▲</span>
                    <span className="text-xs font-mono">{upvotes}</span>
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <button
                        onClick={() => handleClick(article)}
                        className="text-left font-medium text-gray-100 hover:text-white text-sm leading-snug"
                      >
                        {article.title}
                      </button>
                      {article.source && (
                        <span className="text-xs text-gray-500 shrink-0">
                          ({article.source})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs text-gray-600">{timeAgo(article.created_at)}</span>

                      {/* Tags */}
                      {article.tags?.map((tag) => (
                        <Link
                          key={tag}
                          href={`/news?tag=${encodeURIComponent(tag)}`}
                          className="text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-600 px-1.5 py-0.5 rounded transition-colors"
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>

                    {article.summary && (
                      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                        {article.summary}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Sidebar — only shown when low-code articles present */}
      {hasLowCode && (
        <aside className="w-64 shrink-0 hidden lg:block">
          <div className="border border-orange-500/20 bg-orange-950/10 rounded-xl p-5 sticky top-20">
            <div className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-3">
              Featured Report
            </div>
            <h3 className="text-white font-bold text-base mb-2 leading-snug">
              Agent Setup in 60 Minutes
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              The operator playbook for deploying no-code and low-code AI agents end-to-end — with real
              architecture, failure modes, and benchmarks.
            </p>
            <div className="space-y-2 mb-4">
              {['n8n + Make + Zapier deep dives', 'Failure mode playbook', 'Cost benchmarks per tool'].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-orange-400 shrink-0">✓</span>
                  {item}
                </div>
              ))}
            </div>
            <a
              href="/reports/agent-setup-60"
              className="block text-center bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Read preview →
            </a>
          </div>
        </aside>
      )}
    </div>
  );
}
