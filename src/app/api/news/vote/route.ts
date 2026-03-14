import { NextRequest, NextResponse } from 'next/server';
import { upvoteNews, clickNews } from '@/lib/news-store';
import { validateRequest, newsVoteSchema } from '@/lib/api-validation';

export async function POST(request: NextRequest) {
  const parsed = await validateRequest(request, newsVoteSchema);
  if (!parsed.success) return parsed.response;

  const { id, action } = parsed.data;

  if (action === 'click') {
    const ok = await clickNews(id);
    return NextResponse.json({ ok });
  }

  const ok = await upvoteNews(id);
  return NextResponse.json({ ok });
}
