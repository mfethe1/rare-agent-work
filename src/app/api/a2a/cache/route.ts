import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  cacheLookupSchema,
  cacheInvalidateSchema,
  cachePolicySchema,
  cachePolicyDeleteSchema,
  cacheWarmSchema,
  lookupCache,
  invalidateCache,
  upsertCachePolicy,
  deleteCachePolicy,
  listCachePolicies,
  getCacheStats,
  getIntentCacheStats,
  storeInCache,
} from '@/lib/a2a/cache';
import { executeIntent, isIntentSupported, getServiceDb } from '@/lib/a2a';

/**
 * GET /api/a2a/cache — Cache statistics and policy listing.
 *
 * Returns aggregated cache hit/miss stats, per-intent breakdown,
 * and all configured cache policies.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const windowHours = Math.min(168, Math.max(1, parseInt(url.searchParams.get('window_hours') ?? '24', 10) || 24));

    const [stats, byIntent, policies] = await Promise.all([
      getCacheStats(windowHours),
      getIntentCacheStats(windowHours),
      listCachePolicies(),
    ]);

    return NextResponse.json({ stats, by_intent: byIntent, policies });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/cache'), { status: 500 });
  }
}

/**
 * POST /api/a2a/cache — Multiplex endpoint for cache operations.
 *
 * Actions (specified via `action` field in body):
 * - "lookup"     — Check if a result is cached for an intent+input
 * - "invalidate" — Invalidate cache entries
 * - "policy"     — Create or update a cache policy
 * - "warm"       — Pre-populate cache by executing an intent
 *
 * This design keeps the URL namespace clean while supporting
 * multiple cache operations through a single endpoint.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body?.action;

    switch (action) {
      case 'lookup':
        return handleLookup(body);
      case 'invalidate':
        return handleInvalidate(body, agent.id);
      case 'policy':
        return handlePolicy(body);
      case 'delete_policy':
        return handleDeletePolicy(body);
      case 'warm':
        return handleWarm(body, agent.id, request.url);
      default:
        return NextResponse.json(
          {
            error: `Unknown cache action: "${action}". Supported: lookup, invalidate, policy, delete_policy, warm.`,
          },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/cache'), { status: 500 });
  }
}

// ──────────────────────────────────────────────
// Action Handlers
// ──────────────────────────────────────────────

async function handleLookup(body: unknown) {
  const parsed = cacheLookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await lookupCache(parsed.data.intent, parsed.data.input);
  return NextResponse.json(result);
}

async function handleInvalidate(body: unknown, agentId: string) {
  const parsed = cacheInvalidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await invalidateCache({
    ...parsed.data,
    invalidated_by: agentId,
  });

  return NextResponse.json(result);
}

async function handlePolicy(body: unknown) {
  const parsed = cachePolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const policy = await upsertCachePolicy(parsed.data);
  if (!policy) {
    return NextResponse.json({ error: 'Failed to create/update cache policy.' }, { status: 500 });
  }

  return NextResponse.json({ policy }, { status: 201 });
}

async function handleDeletePolicy(body: unknown) {
  const parsed = cachePolicyDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const deleted = await deleteCachePolicy(parsed.data.intent_pattern);
  if (!deleted) {
    return NextResponse.json({ error: 'Policy not found or could not be deleted.' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, intent_pattern: parsed.data.intent_pattern });
}

async function handleWarm(body: unknown, agentId: string, requestUrl: string) {
  const parsed = cacheWarmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { intent, input, force } = parsed.data;

  if (!isIntentSupported(intent)) {
    return NextResponse.json(
      { error: `Unsupported intent: "${intent}". Only platform intents can be warmed.` },
      { status: 422 },
    );
  }

  // Check if already cached (unless force)
  if (!force) {
    const existing = await lookupCache(intent, input);
    if (existing.hit && existing.status === 'fresh') {
      return NextResponse.json({
        task_id: existing.entry!.source_task_id,
        cache_key: existing.cache_key,
        was_cached: true,
        status: 'already_cached',
      });
    }
  }

  // Execute the intent and cache the result
  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  }

  // Create a task record for the warm execution
  const { data: task, error: insertError } = await db
    .from('a2a_tasks')
    .insert({
      sender_agent_id: agentId,
      intent,
      priority: 'low',
      status: 'in_progress',
      input,
      ttl_seconds: 300,
    })
    .select('id')
    .single();

  if (insertError || !task) {
    return NextResponse.json(safeErrorBody(insertError, 'db', 'POST /api/a2a/cache warm'), { status: 500 });
  }

  try {
    const result = await executeIntent(intent, input);

    await db.from('a2a_tasks').update({ status: 'completed', result }).eq('id', task.id);

    const cached = await storeInCache({
      intent,
      input,
      result,
      source_task_id: task.id,
      producer_agent_id: agentId,
    });

    return NextResponse.json({
      task_id: task.id,
      cache_key: cached?.cache_key ?? 'uncached',
      was_cached: false,
      status: 'executed',
    }, { status: 201 });
  } catch (execErr) {
    await db.from('a2a_tasks').update({
      status: 'failed',
      error: { code: 'warm_failed', message: 'Cache warm execution failed.' },
    }).eq('id', task.id);

    return NextResponse.json(
      { error: 'Cache warm execution failed.' },
      { status: 500 },
    );
  }
}
