import { NextRequest, NextResponse } from 'next/server';
import { getAllNews } from '@/lib/news-store';
import { getAllReports } from '@/lib/reports';

/**
 * GET /api/v1/context
 * Public/Subscribed API endpoint to retrieve research papers and agentic systems context.
 * Useful for contextualizing LLMs on the latest state-of-the-art agent frameworks.
 */

export async function GET(request: NextRequest) {
  // TODO (Winnie/Mack): Wire up real subscription check using Bearer token vs Stripe status
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header. Please provide a valid subscriber API key.' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.replace('Bearer ', '').trim();
  
  // Basic validation check - Winnie to expand with real API keys table
  // For now, allow known system keys so it works before full auth is wired
  const isSystemKey = apiKey === process.env.INGEST_API_KEY || apiKey === process.env.REVIEW_API_KEY;
  
  // NOTE: This is temporary. Mack/Winnie must implement real subscriber API key validation.
  // We need an `api_keys` table linking to `subscriptions` in Supabase.
  if (!isSystemKey && apiKey !== 'dev_subscriber_key') {
     return NextResponse.json({ error: 'Invalid API key or not a subscribed user' }, { status: 403 });
  }

  try {
    // 1. Fetch latest agentic news and papers
    const allNews = await getAllNews();
    const latestNews = allNews.slice(0, 50);

    // 2. Fetch our operator-grade research reports
    const allReports = await getAllReports();

    // In a real RAG endpoint, we could take a ?query=... param and filter or embed.
    // For now, return the raw structured context for the subscriber to use in their own systems.

    return NextResponse.json({
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Rare Agent Work - Agentic Systems Context',
      description: 'Context and metadata for the latest researched papers and agent systems.',
      data: {
        news: latestNews,
        reports: allReports,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'https://rareagent.work',
        usage_policy: 'Requires active Rare Agent Work subscription.'
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
