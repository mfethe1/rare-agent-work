import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/usage?period=month — owner-only usage dashboard
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
  const reviewKey = process.env.REVIEW_API_KEY || process.env.INGEST_API_KEY;

  if (!apiKey || apiKey !== reviewKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const db = createClient(url, key);
  const period = request.nextUrl.searchParams.get('period') || 'month';

  let since: string;
  if (period === 'day') {
    since = new Date(Date.now() - 86400000).toISOString();
  } else if (period === 'week') {
    since = new Date(Date.now() - 7 * 86400000).toISOString();
  } else {
    since = new Date(Date.now() - 30 * 86400000).toISOString();
  }

  // Aggregate usage
  const { data: usage } = await db
    .from('token_usage')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  const items = usage || [];

  // Aggregate by user
  const byUser: Record<string, {
    email: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    providerCost: number;
    billedCost: number;
  }> = {};

  // Aggregate by app
  const byApp: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    providerCost: number;
    billedCost: number;
  }> = {};

  for (const item of items) {
    const uid = item.user_id || 'anon';
    if (!byUser[uid]) {
      byUser[uid] = { email: item.user_email || 'anonymous', requests: 0, inputTokens: 0, outputTokens: 0, providerCost: 0, billedCost: 0 };
    }
    byUser[uid].requests++;
    byUser[uid].inputTokens += item.input_tokens || 0;
    byUser[uid].outputTokens += item.output_tokens || 0;
    byUser[uid].providerCost += item.cost_usd || 0;
    byUser[uid].billedCost += item.markup_cost_usd || 0;

    const app = item.app || 'unknown';
    if (!byApp[app]) {
      byApp[app] = { requests: 0, inputTokens: 0, outputTokens: 0, providerCost: 0, billedCost: 0 };
    }
    byApp[app].requests++;
    byApp[app].inputTokens += item.input_tokens || 0;
    byApp[app].outputTokens += item.output_tokens || 0;
    byApp[app].providerCost += item.cost_usd || 0;
    byApp[app].billedCost += item.markup_cost_usd || 0;
  }

  const totalProviderCost = items.reduce((s, i) => s + (i.cost_usd || 0), 0);
  const totalBilledCost = items.reduce((s, i) => s + (i.markup_cost_usd || 0), 0);

  return NextResponse.json({
    period,
    since,
    totalRequests: items.length,
    totalProviderCost: Math.round(totalProviderCost * 10000) / 10000,
    totalBilledCost: Math.round(totalBilledCost * 10000) / 10000,
    margin: Math.round((totalBilledCost - totalProviderCost) * 10000) / 10000,
    byUser,
    byApp,
  });
}
