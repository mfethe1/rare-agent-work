import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // Auth check: require service role key in header
  const authHeader = request.headers.get('authorization') || request.headers.get('x-service-key');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { url, title, summary, source, tags } = body;

  if (!url || !title) {
    return NextResponse.json({ error: 'url and title are required' }, { status: 400 });
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
        upvotes: 0,
        clicks: 0,
        score: 0,
      },
      { onConflict: 'url', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, article: data });
}

export async function GET() {
  return NextResponse.json({ status: 'articles seed API active' });
}
