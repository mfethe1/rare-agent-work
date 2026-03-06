import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const { articleId } = await request.json();

  if (!articleId) {
    return NextResponse.json({ error: 'articleId required' }, { status: 400 });
  }

  const cookieStore = await cookies();

  // Get or create voter token
  let voterToken = cookieStore.get('voter_token')?.value;
  const isNewToken = !voterToken;
  if (!voterToken) {
    voterToken = crypto.randomUUID();
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  // Check if already voted
  const { data: existingVote } = await supabase
    .from('article_votes')
    .select('id')
    .eq('article_id', articleId)
    .eq('voter_token', voterToken)
    .maybeSingle();

  if (existingVote) {
    const response = NextResponse.json({ success: false, reason: 'already_voted' });
    if (isNewToken) {
      response.cookies.set('voter_token', voterToken, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        path: '/',
      });
    }
    return response;
  }

  // Insert vote
  const { error: voteError } = await supabase
    .from('article_votes')
    .insert({ article_id: articleId, voter_token: voterToken });

  if (voteError) {
    return NextResponse.json({ error: 'Vote failed' }, { status: 500 });
  }

  // Increment upvotes
  const { data: article } = await supabase
    .from('articles')
    .select('upvotes, created_at')
    .eq('id', articleId)
    .single();

  if (article) {
    const newUpvotes = (article.upvotes || 0) + 1;
    // HN-style score: upvotes / (age_hours + 2)^1.5
    const ageHours = (Date.now() - new Date(article.created_at).getTime()) / 3600000;
    const newScore = newUpvotes / Math.pow(ageHours + 2, 1.5);

    await supabase
      .from('articles')
      .update({ upvotes: newUpvotes, score: newScore })
      .eq('id', articleId);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('voter_token', voterToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
