export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllNews, getNewsByTag, getAllTags, getNewsSummary, type NewsItem } from '@/lib/news-store';
import { getNewsFreshnessSnapshot } from '@/lib/news-helpers';
import NewsClient from '@/components/NewsClient';
import NewsContextPanel from '@/components/NewsContextPanel';
import BuyButton from '@/components/BuyButton';
import { NewsFeedJsonLd } from '@/components/JsonLd';
import SiteNav from '@/components/SiteNav';

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
  const summaryData = await getNewsSummary();
  const tags = getAllTags(allItems).slice(0, 15);
  const freshness = getNewsFreshnessSnapshot(allItems.map((item) => item.publishedAt));

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      <NewsFeedJsonLd />
      <SiteNav
        variant="news"
        primaryCta={{ label: 'Subscribe · $10/mo', href: '/pricing' }}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Agentic news desk</p>
                  <h1 className="mt-2 text-3xl font-bold text-white">AI agent news with context, not just links</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
                    We surface what changed, why it matters operationally, and what a builder should do next. The framing is intentionally opinionated:
                    fewer generic summaries, more routing signal around deployment risk, stack movement, and workflow implications. Subscribers get the live newsletter,
                    hot-news alerts, and the side-panel copilot for immediate context. If you need help shipping a workflow instead of just reading about one,
                    <Link href="/submit-work" className="ml-1 text-orange-400 underline hover:text-orange-300">submit scoped work for human review</Link>.
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
                    <p className="text-lg font-bold text-white" data-testid="news-total-count">{freshness.totalItems}</p>
                    <p className="text-gray-500">live stories</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                    <p className="text-lg font-bold text-white" data-testid="news-hot-count">{freshness.hotItems}</p>
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

            {items.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
                <p className="text-gray-400">No news items yet. Check back soon.</p>
              </div>
            ) : (
              <NewsClient items={items} />
            )}
          </section>

          <NewsContextPanel
            latestPublishedAt={freshness.latestPublishedAt}
            totalItems={freshness.totalItems}
            hotItems={freshness.hotItems}
            isStale={freshness.stale}
            summaryData={summaryData}
          />
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
