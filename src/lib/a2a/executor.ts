/**
 * A2A Task Executor
 *
 * Routes task intents to platform capabilities and produces results.
 * Each intent handler receives the task input and returns a result payload
 * or throws to indicate failure.
 */

import type { PlatformIntent } from './types';

type IntentHandler = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** Registry of built-in intent handlers. */
const handlers: Record<string, IntentHandler> = {
  'news.query': handleNewsQuery,
  'report.catalog': handleReportCatalog,
  'models.query': handleModelsQuery,
  'digest.latest': handleDigestLatest,
  'agent.discover': handleAgentDiscover,
  'context.query': handleContextQuery,
};

/** Execute a task intent. Returns the result payload. Throws on failure. */
export async function executeIntent(
  intent: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const handler = handlers[intent];
  if (!handler) {
    throw new IntentNotFoundError(intent);
  }
  return handler(input);
}

/** Check if an intent is supported by the platform. */
export function isIntentSupported(intent: string): boolean {
  return intent in handlers;
}

/** List all platform-supported intents with metadata. */
export function listPlatformIntents(): PlatformIntent[] {
  return [
    {
      intent: 'news.query',
      description: 'Query the curated AI agent news feed. Supports tag filtering.',
      input_schema: {
        type: 'object',
        properties: {
          tag: { type: 'string', description: 'Filter by tag (e.g., "openai", "security")' },
          limit: { type: 'integer', description: 'Max results (default 20)' },
        },
      },
      requires_auth: true,
    },
    {
      intent: 'report.catalog',
      description: 'List all available operator-grade research reports with metadata and pricing.',
      input_schema: { type: 'object', properties: {} },
      requires_auth: true,
    },
    {
      intent: 'models.query',
      description: 'Query model rankings sorted by capability scores.',
      input_schema: {
        type: 'object',
        properties: {
          sort: { type: 'string', enum: ['tool_use', 'context_recall', 'coding', 'cost'] },
          order: { type: 'string', enum: ['asc', 'desc'] },
          limit: { type: 'integer' },
        },
      },
      requires_auth: true,
    },
    {
      intent: 'digest.latest',
      description: 'Get the latest weekly AI agent digest with executive summary.',
      input_schema: { type: 'object', properties: {} },
      requires_auth: true,
    },
    {
      intent: 'agent.discover',
      description: 'Discover agents registered on the platform by capability.',
      input_schema: {
        type: 'object',
        properties: {
          capability: { type: 'string', description: 'Filter by capability ID' },
        },
      },
      requires_auth: true,
    },
    {
      intent: 'context.query',
      description: 'Query the shared agent context store. Returns knowledge, findings, and decisions persisted by agents in collaborative workflows.',
      input_schema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Filter by namespace (e.g., "research", "decisions")' },
          correlation_id: { type: 'string', description: 'Filter by workflow correlation ID' },
          task_id: { type: 'string', format: 'uuid', description: 'Filter by related task ID' },
          agent_id: { type: 'string', format: 'uuid', description: 'Filter by authoring agent ID' },
          key_prefix: { type: 'string', description: 'Filter by key prefix' },
          limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max results (default 50)' },
        },
      },
      requires_auth: true,
    },
  ];
}

// ──────────────────────────────────────────────
// Intent Handlers
// ──────────────────────────────────────────────

async function handleNewsQuery(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Import dynamically to avoid circular deps at module level
  const { getAllNews, getNewsByTag } = await import('@/lib/news-store');
  const tag = typeof input.tag === 'string' ? input.tag : undefined;
  const items = tag ? await getNewsByTag(tag) : await getAllNews();
  const limit = typeof input.limit === 'number' ? Math.min(input.limit, 100) : 20;
  return { items: items.slice(0, limit), count: Math.min(items.length, limit) };
}

async function handleReportCatalog(): Promise<Record<string, unknown>> {
  const { getAllReports } = await import('@/lib/reports');
  const allReports = getAllReports();
  return { reports: allReports, count: allReports.length };
}

async function handleModelsQuery(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Use the same seed data approach as the models API route
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { models: [], count: 0, note: 'Database not configured' };
  }

  const db = createClient(url, key);
  const sort = typeof input.sort === 'string' ? `${input.sort}_score` : 'tool_use_score';
  const order = input.order === 'asc' ? true : false;
  const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 20;

  const { data } = await db
    .from('models')
    .select('*')
    .order(sort, { ascending: order })
    .limit(limit);

  return { models: data ?? [], count: data?.length ?? 0 };
}

async function handleDigestLatest(): Promise<Record<string, unknown>> {
  const { getNewsSummary } = await import('@/lib/news-store');
  const summary = await getNewsSummary();
  if (!summary) {
    return { available: false, message: 'No digest available for this week' };
  }
  return { available: true, digest: summary };
}

async function handleAgentDiscover(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { getServiceDb } = await import('./auth');
  const db = getServiceDb();
  if (!db) {
    return { agents: [], count: 0 };
  }

  let query = db
    .from('agent_registry')
    .select('id, name, description, capabilities, trust_level, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);

  const capability = typeof input.capability === 'string' ? input.capability : undefined;
  if (capability) {
    // Filter agents whose capabilities array contains an object with matching id
    query = query.contains('capabilities', [{ id: capability }]);
  }

  const { data } = await query;
  return { agents: data ?? [], count: data?.length ?? 0 };
}

async function handleContextQuery(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { getServiceDb } = await import('./auth');
  const db = getServiceDb();
  if (!db) {
    return { contexts: [], count: 0 };
  }

  const limit = typeof input.limit === 'number' ? Math.min(input.limit, 100) : 50;

  let query = db
    .from('agent_contexts')
    .select('id, agent_id, namespace, key, value, correlation_id, task_id, content_type, ttl_seconds, expires_at, created_at, updated_at')
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (typeof input.namespace === 'string') {
    query = query.eq('namespace', input.namespace);
  }
  if (typeof input.correlation_id === 'string') {
    query = query.eq('correlation_id', input.correlation_id);
  }
  if (typeof input.task_id === 'string') {
    query = query.eq('task_id', input.task_id);
  }
  if (typeof input.agent_id === 'string') {
    query = query.eq('agent_id', input.agent_id);
  }
  if (typeof input.key_prefix === 'string') {
    query = query.like('key', `${input.key_prefix}%`);
  }

  const { data } = await query;
  return { contexts: data ?? [], count: data?.length ?? 0 };
}

// ──────────────────────────────────────────────
// Error Types
// ──────────────────────────────────────────────

export class IntentNotFoundError extends Error {
  constructor(intent: string) {
    super(`Unsupported intent: ${intent}`);
    this.name = 'IntentNotFoundError';
  }
}
