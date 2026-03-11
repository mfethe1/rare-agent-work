import { NextResponse } from 'next/server';
import { agentCard } from '@/lib/agent-card';

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(agentCard, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
