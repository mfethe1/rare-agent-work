import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import {
  agentRegisterSchema,
  generateAgentApiKey,
  getServiceDb,
  authenticateAgent,
} from '@/lib/a2a';
import { agentSearchSchema } from '@/lib/a2a/validation';
import { searchAgents } from '@/lib/a2a/discovery';
import type { AgentRegisterResponse, AgentTrustLevel } from '@/lib/a2a';
import type { AgentAvailability } from '@/lib/a2a/discovery';

/**
 * GET /api/a2a/agents — Search and discover registered agents.
 *
 * Supports filtering by capability, trust level, availability, and free-text search.
 * Returns enriched profiles with reputation, availability, and contract data.
 * Requires authentication.
 *
 * Query parameters:
 *   query, capability, trust_levels (comma-separated), availability (comma-separated),
 *   active_only, sort_by, sort_order, offset, limit
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const rawParams: Record<string, unknown> = {};

    // Parse query params
    const q = url.searchParams.get('query');
    if (q) rawParams.query = q;

    const cap = url.searchParams.get('capability');
    if (cap) rawParams.capability = cap;

    const tl = url.searchParams.get('trust_levels');
    if (tl) rawParams.trust_levels = tl.split(',').filter(Boolean) as AgentTrustLevel[];

    const av = url.searchParams.get('availability');
    if (av) rawParams.availability = av.split(',').filter(Boolean) as AgentAvailability[];

    const activeOnly = url.searchParams.get('active_only');
    if (activeOnly !== null) rawParams.active_only = activeOnly !== 'false';

    const sortBy = url.searchParams.get('sort_by');
    if (sortBy) rawParams.sort_by = sortBy;

    const sortOrder = url.searchParams.get('sort_order');
    if (sortOrder) rawParams.sort_order = sortOrder;

    const offset = url.searchParams.get('offset');
    if (offset) rawParams.offset = parseInt(offset, 10);

    const limit = url.searchParams.get('limit');
    if (limit) rawParams.limit = parseInt(limit, 10);

    // Validate
    const parsed = agentSearchSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters.', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await searchAgents(parsed.data);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=10' },
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/agents'),
      { status: 500 },
    );
  }
}

/**
 * POST /api/a2a/agents — Register a new agent on the platform.
 *
 * Returns the agent ID and a one-time API key.
 * The plain API key is never stored; only its SHA-256 hash is persisted.
 *
 * No auth required for registration (the key IS the auth artifact).
 * Rate-limited by IP in production.
 */
export async function POST(request: Request) {
  const parsed = await validateRequest(request, agentRegisterSchema);
  if (!parsed.success) return parsed.response;

  const { name, description, callback_url, capabilities } = parsed.data;

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      { status: 503 },
    );
  }

  try {
    const { plainKey, keyHash, keyPrefix } = await generateAgentApiKey();

    const { data, error } = await db
      .from('agent_registry')
      .insert({
        name,
        description,
        callback_url: callback_url ?? null,
        capabilities,
        trust_level: 'untrusted',
        api_key_hash: keyHash,
        api_key_prefix: keyPrefix,
      })
      .select('id, trust_level, created_at')
      .single();

    if (error || !data) {
      return NextResponse.json(
        safeErrorBody(error, 'db', 'POST /api/a2a/agents'),
        { status: 500 },
      );
    }

    const response: AgentRegisterResponse = {
      agent_id: data.id,
      api_key: plainKey,
      trust_level: data.trust_level,
      created_at: data.created_at,
    };

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'X-Agent-Key-Notice': 'Store this API key securely. It cannot be retrieved again.',
      },
    });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/agents'),
      { status: 500 },
    );
  }
}
