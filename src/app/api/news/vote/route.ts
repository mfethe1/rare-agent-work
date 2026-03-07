import { NextRequest, NextResponse } from 'next/server';
import { upvoteNews, clickNews } from '@/lib/news-store';

export async function POST(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (action === 'click') {
      const ok = await clickNews(id);
      return NextResponse.json({ ok });
    }

    const ok = await upvoteNews(id);
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
