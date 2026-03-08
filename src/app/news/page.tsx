export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllNews, getNewsByTag, getAllTags, type NewsItem } from '@/lib/news-store';
import { getHotNewsCount } from '@/lib/news-helpers';
import NewsClient from '@/components/NewsClient';
import NewsContextPanel from '@/components/NewsContextPanel';
import BuyButton from '@/components/BuyButton';

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
  openGraph: {
    title: 'AI Agent News Feed | Rare Agent Work',
    description: 'Daily-curated news for AI agent builders — frameworks, tool-use, research, and open-source tooling.',
    url: 'https://rareagent.work/news',
    siteName: 'Rare Agent Work',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AI Agent News Feed' }],
  },
  alternates: {
    canonical: 'https://rareagent.work/news',
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
  const latestPublishedAt = allItems[0]?.publishedAt;
  const hotItems = getHotNewsCount(allItems.map((item) => item.publishedAt));

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
                <Link href="/news" className="text-sm font-medium text-white">News Feed</Link>
                <Link href="/digest" className="text-sm text-gray-400 transition-colors hover:text-white">Weekly Digest</Link>
                <Link href="/reports" className="text-sm text-gray-400 transition-colors hover:text-white">Reports</Link>
                <Link href="/assessment" className="text-sm text-gray-400 transition-colors hover:text-white">Assessment</Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BuyButton
                plan="newsletter"
                label="Newsletter · $10/mo"
                className="rounded-md border border-orange-500/40 bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700"
              />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Agentic news desk</p>
                  <h1 className="mt-2 text-3xl font-bold text-white">AI agent news with context, not just links</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
                    We surface what changed, why it matters, and what operators should do next. Subscribers get the live newsletter,
                    hot-news alerts, and the side-panel copilot for immediate context.
                    {activeTag && (
                      <span className="ml-2 text-orange-400">
                        Filtered: <span className="font-medium">{activeTag}</span>{' '}
                        <Link href="/news" className="underline hover:text-orange-300">clear</Link>
                      </span>
                    )}
                  </p>
                </div>
                <div className="grid min-w-[220px] grid-cols-2 gap-3 text-center text-xs">
                  <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                    <p className="text-lg font-bold text-white">{allItems.length}</p>
                    <p className="text-gray-500">live stories</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                    <p className="text-lg font-bold text-white">{hotItems}</p>
                    <p className="text-gray-500">last 24h</p>
                  </div>
                </div>
              </div>
            </div>

            {tags.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {tags.map(({ tag: t, count }) => (
                  <Link
                    key={t}
                    href={`/news?tag=${encodeURIComponent(t)}`}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      t === activeTag
                        ? 'border-orange-600 bg-orange-600 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {t} ({count})
                  </Link>
                ))}
              </div>
            )}

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Why subscribe</p>
                <p className="mt-2 text-sm text-gray-300">Breaking news alerts, weekly briefings, and agent context in one flow.</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Freshness promise</p>
                <p className="mt-2 text-sm text-gray-300">Stories stay recent, ranked by recency + operator relevance.</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Built for action</p>
                <p className="mt-2 text-sm text-gray-300">Every story can be turned into implications, risks, and next steps via the copilot.</p>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
                <p className="text-gray-400">No news items yet. Check back soon.</p>
              </div>
            ) : (
              <NewsClient items={items} />
            )}
          </section>

          <NewsContextPanel latestPublishedAt={latestPublishedAt} totalItems={allItems.length} hotItems={hotItems} />
        </div>
      </main>

      <footer className="mt-12 border-t border-gray-800 py-8 text-center text-xs text-gray-600">
        <p>
          © {new Date().getFullYear()} Rare Agent Work ·{' '}
          <a href="mailto:hello@rareagent.work" className="transition-colors hover:text-gray-400">
            hello@rareagent.work
          </a>
        </p>
      </footer>
    </div>
  );
}
