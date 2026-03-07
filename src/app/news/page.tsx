export const dynamic = "force-dynamic";
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import ArticleFeed from '@/components/ArticleFeed';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI Agent News Feed | Rare Agent Work',
  description:
    'Daily-updated Hacker News style feed for AI agent builders. Top articles on frameworks, tool-use, research, and open-source agent tooling.',
  openGraph: {
    title: 'AI Agent News | Rare Agent Work',
    description: 'Best links for AI agent developers — curated daily.',
  },
};

// Revalidate every 5 minutes
export const revalidate = 300;

interface PageProps {
  searchParams: Promise<{ tag?: string }>;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const { tag } = await searchParams;
  const activeTag = tag || '';

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  // Build query
  let query = supabase
    .from('articles')
    .select('id, url, title, summary, source, upvotes, clicks, score, tags, created_at')
    .order('score', { ascending: false })
    .limit(30);

  if (activeTag) {
    query = query.contains('tags', [activeTag]);
  }

  const { data: articles } = await query;

  // Get voter token to pre-mark voted articles
  const voterToken = cookieStore.get('voter_token')?.value;
  let votedIds = new Set<string>();

  if (voterToken && articles && articles.length > 0) {
    const { data: votes } = await supabase
      .from('article_votes')
      .select('article_id')
      .eq('voter_token', voterToken)
      .in('article_id', articles.map((a) => a.id));

    if (votes) {
      votedIds = new Set(votes.map((v) => v.article_id));
    }
  }

  const safeArticles = articles ?? [];

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
              <div className="flex items-center gap-4 hidden sm:flex">
                <Link href="/news" className="text-white text-sm font-medium">News</Link>
                <Link href="/models" className="text-gray-400 hover:text-white text-sm transition-colors">Models</Link>
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
            Top links for agent builders — curated by Rosie, updated daily.
            {activeTag && (
              <span className="ml-2 text-orange-400">
                Filtered: <span className="font-medium">{activeTag}</span>{' '}
                <Link href="/news" className="underline hover:text-orange-300">clear</Link>
              </span>
            )}
          </p>
        </div>

        <ArticleFeed articles={safeArticles} votedIds={votedIds} activeTag={activeTag} />
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
