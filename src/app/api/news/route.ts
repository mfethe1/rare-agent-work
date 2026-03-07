import { NextRequest, NextResponse } from 'next/server';
import { getAllNews, getNewsByTag } from '@/lib/news-store';

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag') || '';
  const items = tag ? await getNewsByTag(tag) : await getAllNews();
  return NextResponse.json({ items, count: items.length });
}
