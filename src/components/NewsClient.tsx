'use client';

import { useState } from 'react';
import { formatNewsAge, isBreakingNews } from '@/lib/news-helpers';
import BuyButton from '@/components/BuyButton';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  tags: string[];
  publishedAt: string;
  upvotes: number;
  clicks: number;
}

export default function NewsClient({ items }: { items: NewsItem[] }) {
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [localUpvotes, setLocalUpvotes] = useState<Record<string, number>>({});

  async function handleUpvote(id: string) {
    if (voted.has(id)) return;
    setVoted((prev) => new Set(prev).add(id));
    setLocalUpvotes((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    try {
      await fetch('/api/news/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'upvote' }),
      });
    } catch {
      // Best effort
    }
  }

  async function handleClick(id: string) {
    try {
      await fetch('/api/news/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'click' }),
      });
    } catch {
      // Best effort
    }
  }

  const categoryColors: Record<string, string> = {
    'model-release': 'bg-red-500/20 text-red-400',
    'tool-release': 'bg-blue-500/20 text-blue-400',
    'framework-release': 'bg-purple-500/20 text-purple-400',
    research: 'bg-green-500/20 text-green-400',
    'industry-news': 'bg-yellow-500/20 text-yellow-400',
    community: 'bg-cyan-500/20 text-cyan-400',
    security: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <div className="space-y-3" data-testid="news-feed-list">
      {items.map((item, i) => (
        <div
          key={item.id}
          data-testid="news-story-card"
          className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 transition-colors hover:border-gray-700"
        >
          <div className="flex items-start gap-3">
            <button
              onClick={() => handleUpvote(item.id)}
              className={`flex min-w-[40px] flex-col items-center pt-0.5 ${
                voted.has(item.id) ? 'text-orange-500' : 'text-gray-600 hover:text-orange-400'
              } transition-colors`}
            >
              <span className="text-lg leading-none">▲</span>
              <span className="mt-0.5 text-xs font-mono">{item.upvotes + (localUpvotes[item.id] || 0)}</span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start gap-2">
                <span className="mt-1 text-xs font-mono text-gray-600">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleClick(item.id)}
                    className="leading-tight text-white transition-colors hover:text-orange-400 font-medium"
                  >
                    {item.title}
                  </a>
                  <span className="ml-2 text-xs text-gray-600">({new URL(item.url).hostname.replace('www.', '')})</span>
                </div>
              </div>

              {item.summary && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-400">{item.summary}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    categoryColors[item.category] || 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {item.category.replace(/-/g, ' ')}
                </span>
                {isBreakingNews(item.publishedAt) && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-300">breaking</span>
                )}
                <span>{item.source}</span>
                <span>{formatNewsAge(item.publishedAt)}</span>
                {item.clicks > 0 && <span>{item.clicks} clicks</span>}
                {(item.tags || []).slice(0, 3).map((tag) => (
                  <a
                    key={tag}
                    href={`/news?tag=${encodeURIComponent(tag)}`}
                    className="text-gray-600 transition-colors hover:text-gray-400"
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="mt-8 rounded-2xl border border-orange-500/30 bg-orange-950/20 p-6 text-center">
        <h3 className="mb-2 text-xl font-bold text-white">Stay on top without babysitting the feed.</h3>
        <p className="mx-auto max-w-xl text-sm text-gray-300">
          The live desk stays browseable. Subscribe for the newsletter, hot-news alerts, and operator-grade synthesis layered on top.
        </p>
        <div className="mt-4 flex justify-center">
          <BuyButton
            plan="newsletter"
            label="Subscribe for alerts + synthesis ($10/mo)"
            className="rounded-xl bg-orange-600 px-8 py-3 text-sm font-bold tracking-wide text-white shadow-lg transition-all hover:bg-orange-500 hover:shadow-orange-500/20"
          />
        </div>
      </div>
    </div>
  );
}
