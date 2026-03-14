import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { safeErrorBody } from '@/lib/api-errors';

const MAX_AGE_DAYS = 14;

function isServiceAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') || request.headers.get('x-service-key');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!authHeader || !serviceKey) return false;
  return authHeader === `Bearer ${serviceKey}` || authHeader === serviceKey;
}

export async function POST(request: NextRequest) {
  if (!isServiceAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { url, title, summary, source, tags, published_at } = body;

  if (!url || !title) {
    return NextResponse.json({ error: 'url and title are required' }, { status: 400 });
  }

  // HARD GATE: published_at is REQUIRED — no date = no ingest
  if (!published_at) {
    return NextResponse.json(
      { error: 'published_at is required. We do not accept undated articles.' },
      { status: 400 }
    );
  }

  const pubDate = new Date(published_at);
  if (isNaN(pubDate.getTime())) {
    return NextResponse.json(
      { error: 'published_at is not a valid date.' },
      { status: 400 }
    );
  }

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  if (pubDate < cutoff) {
    return NextResponse.json(
      { error: `Article too old (published ${published_at}). Only content from the last ${MAX_AGE_DAYS} days is accepted.` },
      { status: 422 }
    );
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('articles')
    .upsert(
      {
        url,
        title,
        summary: summary || null,
        source: source || null,
        tags: tags || [],
        published_at: pubDate.toISOString(),
        upvotes: 0,
        clicks: 0,
        score: 0,
      },
      { onConflict: 'url', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(safeErrorBody(error, 'db', 'POST /api/articles'), { status: 500 });
  }

  return NextResponse.json({ success: true, article: data });
}

export async function GET() {
  return NextResponse.json({ status: 'articles API active', maxAgeDays: MAX_AGE_DAYS });
}
