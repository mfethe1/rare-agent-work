import { NextResponse } from 'next/server';
import { authenticateAgent, getServiceDb, contextStoreSchema, contextQuerySchema } from '@/lib/a2a';
import { emitEvent } from '@/lib/a2a/webhooks';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';

/**
 * POST /api/a2a/context — Store or update a shared context entry.
 *
 * Agents use this to persist knowledge, findings, or decisions that
 * other agents in the same workflow (or any authenticated agent) can query.
 * Upserts on (agent_id, namespace, key) — storing the same key twice updates it.
 *
 * Auth: Bearer token (agent API key) required.
 * Rate-limited per agent based on trust level.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid agent API key.' },
      { status: 401 },
    );
  }

  // Rate limit check
  const rl = await checkRateLimit(agent.id, agent.trust_level, 'context.write');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('context.write', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = contextStoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { namespace, key, value, correlation_id, task_id, content_type, ttl_seconds } = parsed.data;

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Compute expires_at for the upsert (trigger handles it on raw SQL, but
  // Supabase JS client upserts need the value pre-computed for the insert path)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl_seconds * 1000).toISOString();

  const { data: ctx, error } = await db
    .from('agent_contexts')
    .upsert(
      {
        agent_id: agent.id,
        namespace,
        key,
        value,
        correlation_id: correlation_id ?? null,
        task_id: task_id ?? null,
        content_type,
        ttl_seconds,
        expires_at: expiresAt,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'agent_id,namespace,key' },
    )
    .select('id, namespace, key, agent_id, expires_at, created_at, updated_at')
    .single();

  if (error) {
    console.error('[A2A Context] Store error:', error);
    return NextResponse.json({ error: 'Failed to store context.' }, { status: 500 });
  }

  // Emit context.stored event (fire-and-forget)
  emitEvent('context.stored' as Parameters<typeof emitEvent>[0], {
    context_id: ctx.id,
    agent_id: agent.id,
    agent_name: agent.name,
    namespace,
    key,
    correlation_id: correlation_id ?? null,
    task_id: task_id ?? null,
    content_type,
    ttl_seconds,
  });

  return NextResponse.json(
    {
      context_id: ctx.id,
      namespace: ctx.namespace,
      key: ctx.key,
      agent_id: ctx.agent_id,
      expires_at: ctx.expires_at,
      created_at: ctx.created_at,
      updated_at: ctx.updated_at,
    },
    {
      status: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  );
}

/**
 * GET /api/a2a/context — Query shared context entries.
 *
 * Supports filtering by namespace, correlation_id, task_id, agent_id, and key_prefix.
 * Returns only non-expired entries. Any authenticated agent can read any context.
 *
 * Auth: Bearer token (agent API key) required.
 * Rate-limited per agent based on trust level.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid agent API key.' },
      { status: 401 },
    );
  }

  // Rate limit check
  const rlRead = await checkRateLimit(agent.id, agent.trust_level, 'context.read');
  if (!rlRead.allowed) {
    return NextResponse.json(
      rateLimitBody('context.read', rlRead),
      { status: 429, headers: rateLimitHeaders(rlRead) },
    );
  }

  const url = new URL(request.url);
  const params: Record<string, unknown> = {};

  // Extract query params
  const namespace = url.searchParams.get('namespace');
  const correlation_id = url.searchParams.get('correlation_id');
  const task_id = url.searchParams.get('task_id');
  const agent_id = url.searchParams.get('agent_id');
  const key_prefix = url.searchParams.get('key_prefix');
  const limitParam = url.searchParams.get('limit');

  if (namespace) params.namespace = namespace;
  if (correlation_id) params.correlation_id = correlation_id;
  if (task_id) params.task_id = task_id;
  if (agent_id) params.agent_id = agent_id;
  if (key_prefix) params.key_prefix = key_prefix;
  if (limitParam) params.limit = parseInt(limitParam, 10);

  const parsed = contextQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters.', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const query = parsed.data;

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Build the query — only return non-expired entries
  let dbQuery = db
    .from('agent_contexts')
    .select('id, agent_id, namespace, key, value, correlation_id, task_id, content_type, ttl_seconds, expires_at, created_at, updated_at')
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(query.limit);

  if (query.namespace) {
    dbQuery = dbQuery.eq('namespace', query.namespace);
  }
  if (query.correlation_id) {
    dbQuery = dbQuery.eq('correlation_id', query.correlation_id);
  }
  if (query.task_id) {
    dbQuery = dbQuery.eq('task_id', query.task_id);
  }
  if (query.agent_id) {
    dbQuery = dbQuery.eq('agent_id', query.agent_id);
  }
  if (query.key_prefix) {
    dbQuery = dbQuery.like('key', `${query.key_prefix}%`);
  }

  const { data: contexts, error } = await dbQuery;

  if (error) {
    console.error('[A2A Context] Query error:', error);
    return NextResponse.json({ error: 'Failed to query context.' }, { status: 500 });
  }

  return NextResponse.json(
    {
      contexts: contexts ?? [],
      count: contexts?.length ?? 0,
    },
    {
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  );
}

/**
 * DELETE /api/a2a/context?id=<uuid> — Delete a context entry.
 *
 * Only the agent that created the context can delete it.
 *
 * Auth: Bearer token (agent API key) required.
 */
export async function DELETE(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid agent API key.' },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const contextId = url.searchParams.get('id');

  if (!contextId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: id' },
      { status: 400 },
    );
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(contextId)) {
    return NextResponse.json({ error: 'Invalid context ID format.' }, { status: 400 });
  }

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Only the owning agent can delete their context
  const { data: existing } = await db
    .from('agent_contexts')
    .select('id, agent_id')
    .eq('id', contextId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Context entry not found.' }, { status: 404 });
  }

  if (existing.agent_id !== agent.id) {
    return NextResponse.json(
      { error: 'Forbidden. Only the creating agent can delete this context entry.' },
      { status: 403 },
    );
  }

  const { error } = await db
    .from('agent_contexts')
    .delete()
    .eq('id', contextId);

  if (error) {
    console.error('[A2A Context] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete context.' }, { status: 500 });
  }

  return NextResponse.json(
    { deleted: true, context_id: contextId },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
