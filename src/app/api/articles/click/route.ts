import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const { articleId } = await request.json();
  if (!articleId) return NextResponse.json({ ok: false });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: article } = await supabase
    .from('articles')
    .select('clicks')
    .eq('id', articleId)
    .single();

  if (article) {
    await supabase
      .from('articles')
      .update({ clicks: (article.clicks || 0) + 1 })
      .eq('id', articleId);
  }

  return NextResponse.json({ ok: true });
}
