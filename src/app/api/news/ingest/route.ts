import { NextRequest, NextResponse } from 'next/server';
import { ingestNews } from '@/lib/news-store';
import { newsIngestSchema, validateRequest } from '@/lib/api-validation';
import { sanitizeError } from '@/lib/api-errors';

export async function POST(request: NextRequest) {
  const apiKey = process.env.INGEST_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'INGEST_API_KEY not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const validation = await validateRequest(request, newsIngestSchema);
    if (!validation.success) return validation.response;

    const rawItems = Array.isArray(validation.data) ? validation.data : validation.data.items;
    // Map validated items to match ingestNews signature (all fields required)
    const items = rawItems.map((item) => ({
      title: item.title,
      url: item.url,
      source: item.source,
      summary: item.summary ?? '',
      category: item.category ?? 'general',
      tags: item.tags ?? [],
      publishedAt: item.publishedAt,
    }));
    const result = await ingestNews(items);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // Never leak raw error details to the client
    const safeMessage = sanitizeError(err, 'validation', 'POST /api/news/ingest');
    return NextResponse.json({ error: safeMessage }, { status: 400 });
  }
}
