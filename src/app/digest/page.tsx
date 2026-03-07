import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Weekly AI Agent Digest | Rare Agent Work',
  description: 'A free, condensed summary of the week\'s most important AI agent developments. Updated weekly.',
  openGraph: {
    title: 'Weekly AI Agent Digest — Rare Agent Work',
    description: 'A free, condensed summary of the week\'s most important AI agent developments.',
    url: 'https://rareagent.work/digest',
    siteName: 'Rare Agent Work',
    type: 'website',
  },
  alternates: {
    canonical: 'https://rareagent.work/digest',
  },
};

interface Article {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  source: string | null;
  tags: string[];
  upvotes: number;
  created_at: string;
}

export default async function DigestPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Weekly Digest</h1>
          <p className="text-gray-400">Digest is being configured. Check back soon.</p>
        </div>
      </div>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .gte('created_at', sevenDaysAgo)
    .order('upvotes', { ascending: false })
    .limit(15);

  const topArticles = (articles || []) as Article[];

  // Group by tag for the summary
  const tagGroups: Record<string, Article[]> = {};
  for (const article of topArticles) {
    for (const tag of article.tags || []) {
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push(article);
    }
  }

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date();
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <nav className="border-b border-gray-800 bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="text-xl font-bold tracking-tighter text-white">Rare Agent Work</a>
          <div className="flex items-center gap-6 text-sm">
            <a href="/news" className="text-gray-400 hover:text-white transition-colors">News</a>
            <a href="/models" className="text-gray-400 hover:text-white transition-colors">Models</a>
            <a href="/digest" className="text-white font-semibold">Digest</a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-2.5 py-1 rounded-full">FREE</span>
            <span className="text-gray-500 text-sm">Updated weekly</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Weekly AI Agent Digest
          </h1>
          <p className="text-gray-400 text-lg">
            {formatDate(weekStart)} — {formatDate(weekEnd)} • The week&apos;s most important AI agent developments, condensed.
          </p>
        </div>

        {topArticles.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-400">No articles from this week yet. Check back soon.</p>
          </div>
        ) : (
          <>
            {/* Executive Summary */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-blue-400">📋</span> Executive Summary
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <p className="text-gray-300 leading-relaxed">
                  This week saw <strong className="text-white">{topArticles.length} notable developments</strong> in the AI agent space.
                  {Object.keys(tagGroups).length > 0 && (
                    <> Key themes include{' '}
                      <strong className="text-white">
                        {Object.entries(tagGroups)
                          .sort((a, b) => b[1].length - a[1].length)
                          .slice(0, 3)
                          .map(([tag]) => tag.replace(/-/g, ' '))
                          .join(', ')}
                      </strong>.
                    </>
                  )}
                  {topArticles[0] && (
                    <> The most upvoted story was <em>&ldquo;{topArticles[0].title}&rdquo;</em> with {topArticles[0].upvotes} upvotes.</>
                  )}
                </p>
              </div>
            </section>

            {/* Top Stories */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-yellow-400">🔥</span> Top Stories
              </h2>
              <div className="space-y-4">
                {topArticles.slice(0, 8).map((article, i) => (
                  <div key={article.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-gray-600 font-mono text-sm mt-0.5 w-6 text-right shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white font-medium hover:text-blue-400 transition-colors"
                        >
                          {article.title}
                        </a>
                        {article.summary && (
                          <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">{article.summary}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>▲ {article.upvotes}</span>
                          {article.source && <span className="bg-gray-800 px-2 py-0.5 rounded">{article.source}</span>}
                          {(article.tags || []).slice(0, 3).map((tag) => (
                            <span key={tag} className="text-gray-600">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Category Breakdown */}
            {Object.keys(tagGroups).length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-purple-400">📊</span> By Category
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(tagGroups)
                    .sort((a, b) => b[1].length - a[1].length)
                    .slice(0, 6)
                    .map(([tag, tagArticles]) => (
                      <div key={tag} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <h3 className="text-white font-semibold capitalize mb-2">
                          {tag.replace(/-/g, ' ')} ({tagArticles.length})
                        </h3>
                        <ul className="space-y-1">
                          {tagArticles.slice(0, 3).map((a) => (
                            <li key={a.id} className="text-gray-400 text-sm truncate">
                              <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                                {a.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* CTA */}
            <section className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-8 text-center">
              <h3 className="text-xl font-semibold text-white mb-2">Want deeper analysis?</h3>
              <p className="text-gray-400 mb-4">
                Our paid reports go beyond the headlines — implementation playbooks, architecture decisions, and operator-grade detail.
              </p>
              <a
                href="/#catalog"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                View Reports →
              </a>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
