import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import {
  agentRegisterSchema,
  generateAgentApiKey,
  getServiceDb,
} from '@/lib/a2a';
import type { AgentRegisterResponse } from '@/lib/a2a';

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
