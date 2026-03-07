import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// DELETE articles older than 14 days — called by cron
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('x-service-key');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || (authHeader !== `Bearer ${serviceKey}` && authHeader !== serviceKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Remove articles where BOTH published_at and created_at are older than 14 days
  // Use published_at as primary (more accurate), fall back to created_at
  const { data: stale, error: fetchErr } = await supabase
    .from('articles')
    .select('id, title, created_at, published_at')
    .or(`published_at.lt.${fourteenDaysAgo},and(published_at.is.null,created_at.lt.${fourteenDaysAgo})`);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!stale || stale.length === 0) {
    return NextResponse.json({ removed: 0, message: 'No stale articles' });
  }

  const ids = stale.map((a) => a.id);

  // Delete votes first (FK constraint)
  await supabase.from('article_votes').delete().in('article_id', ids);
  const { error: delErr } = await supabase.from('articles').delete().in('id', ids);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({
    removed: stale.length,
    titles: stale.map((a) => a.title),
  });
}
