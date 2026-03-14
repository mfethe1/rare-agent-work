import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizeError } from '@/lib/api-errors';

// POST: upsert model data from the cron scraper
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('x-service-key');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || (authHeader !== `Bearer ${serviceKey}` && authHeader !== serviceKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const models = Array.isArray(body) ? body : [body];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Array<{ slug: string; success: boolean; error?: string }> = [];
  for (const model of models) {
    const { slug, name, provider, tool_use_score, context_recall_score, coding_score, cost_per_1k_tokens, context_window, best_for, pricing_url } = model;

    if (!slug || !name || !provider) {
      results.push({ slug, success: false, error: 'slug, name, provider required' });
      continue;
    }

    const { error } = await supabase
      .from('models')
      .upsert(
        {
          slug,
          name,
          provider,
          tool_use_score: tool_use_score ?? null,
          context_recall_score: context_recall_score ?? null,
          coding_score: coding_score ?? null,
          cost_per_1k_tokens: cost_per_1k_tokens ?? null,
          context_window: context_window ?? null,
          best_for: best_for ?? [],
          pricing_url: pricing_url ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' }
      );

    if (error) sanitizeError(error, 'db', `POST /api/models/update [${slug}]`);
    results.push({ slug, success: !error, ...(error ? { error: 'Database update failed' } : {}) });
  }

  return NextResponse.json({ updated: results.filter((r) => r.success).length, results });
}
