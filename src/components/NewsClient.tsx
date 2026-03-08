'use client';

import { useState } from 'react';
import { formatNewsAge, isBreakingNews } from '@/lib/news-helpers';

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
    'research': 'bg-green-500/20 text-green-400',
    'industry-news': 'bg-yellow-500/20 text-yellow-400',
    'community': 'bg-cyan-500/20 text-cyan-400',
    'security': 'bg-orange-500/20 text-orange-400',
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Upvote */}
            <button
              onClick={() => handleUpvote(item.id)}
              className={`flex flex-col items-center min-w-[40px] pt-0.5 ${
                voted.has(item.id) ? 'text-orange-500' : 'text-gray-600 hover:text-orange-400'
              } transition-colors`}
            >
              <span className="text-lg leading-none">▲</span>
              <span className="text-xs font-mono mt-0.5">
                {item.upvotes + (localUpvotes[item.id] || 0)}
              </span>
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-gray-600 font-mono text-xs mt-1">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleClick(item.id)}
                    className="text-white font-medium hover:text-orange-400 transition-colors leading-tight"
                  >
                    {item.title}
                  </a>
                  <span className="ml-2 text-gray-600 text-xs">({new URL(item.url).hostname.replace('www.', '')})</span>
                </div>
              </div>

              {item.summary && (
                <p className="text-gray-400 text-sm mt-1.5 leading-relaxed line-clamp-2">
                  {item.summary}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  categoryColors[item.category] || 'bg-gray-800 text-gray-400'
                }`}>
                  {item.category.replace(/-/g, ' ')}
                </span>
                {isBreakingNews(item.publishedAt) && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-300">breaking</span>
                )}
                <span>{item.source}</span>
                <span>{formatNewsAge(item.publishedAt)}</span>
                {item.clicks > 0 && <span>{item.clicks} clicks</span>}
                {item.tags.slice(0, 3).map((tag) => (
                  <a
                    key={tag}
                    href={`/news?tag=${encodeURIComponent(tag)}`}
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
