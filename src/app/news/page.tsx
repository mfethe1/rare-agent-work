export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllNews, getNewsByTag, getAllTags, type NewsItem } from '@/lib/news-store';
import NewsClient from '@/components/NewsClient';

export const metadata: Metadata = {
  title: 'AI Agent News Feed',
  description:
    'Daily-updated news feed for AI agent builders. Top articles on frameworks, tool-use, research, and open-source agent tooling — curated and ranked.',
  keywords: [
    'AI agent news',
    'LLM framework updates',
    'agent tooling news',
    'AI automation news',
    'multi-agent systems news',
  ],
  alternates: {
    canonical: 'https://rareagent.work/news',
  },
  openGraph: {
    title: 'AI Agent News Feed | Rare Agent Work',
    description: 'Daily-curated news for AI agent builders — frameworks, tool-use, research, and open-source tooling.',
    url: 'https://rareagent.work/news',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AI Agent News Feed' }],
  },
};

interface PageProps {
  searchParams: Promise<{ tag?: string }>;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const { tag } = await searchParams;
  const activeTag = tag || '';

  const items: NewsItem[] = activeTag ? await getNewsByTag(activeTag) : await getAllNews();
  const allItems = await getAllNews();
  const tags = getAllTags(allItems).slice(0, 15);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-orange-500 font-bold text-lg tracking-tight">
                Rare Agent Work
              </Link>
              <div className="hidden sm:flex items-center gap-4">
                <Link href="/news" className="text-white text-sm font-medium">News</Link>
                <Link href="/models" className="text-gray-400 hover:text-white text-sm transition-colors">Models</Link>
                <Link href="/digest" className="text-gray-400 hover:text-white text-sm transition-colors">Digest</Link>
                <Link href="/#catalog" className="text-gray-400 hover:text-white text-sm transition-colors">Reports</Link>
              </div>
            </div>
            <Link
              href="/#catalog"
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            >
              Get Reports
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">AI Agent News</h1>
          <p className="text-gray-500 text-sm">
            Top links for agent builders — curated daily, verified, max 14 days old.
            {activeTag && (
              <span className="ml-2 text-orange-400">
                Filtered: <span className="font-medium">{activeTag}</span>{' '}
                <Link href="/news" className="underline hover:text-orange-300">clear</Link>
              </span>
            )}
          </p>
        </div>

        {/* Tag filters */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map(({ tag: t, count }) => (
              <Link
                key={t}
                href={`/news?tag=${encodeURIComponent(t)}`}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  t === activeTag
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                {t} ({count})
              </Link>
            ))}
          </div>
        )}

        {/* Feed */}
        {items.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400">No news items yet. Check back soon.</p>
          </div>
        ) : (
          <NewsClient items={items} />
        )}
      </main>

      <footer className="border-t border-gray-800 py-8 mt-12 text-center text-gray-600 text-xs">
        <p>
          © {new Date().getFullYear()} Rare Agent Work ·{' '}
          <a href="mailto:hello@rareagent.work" className="hover:text-gray-400 transition-colors">
            hello@rareagent.work
          </a>
        </p>
      </footer>
    </div>
  );
}
