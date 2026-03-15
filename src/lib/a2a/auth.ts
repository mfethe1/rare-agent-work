/**
 * A2A Agent Authentication
 *
 * Agents authenticate via API keys issued at registration.
 * Keys are hashed (SHA-256) before storage; the plain key is returned
 * only once during registration.
 *
 * Header format: Authorization: Bearer ra_<random>
 */

import { createClient } from '@supabase/supabase-js';
import type { RegisteredAgent } from './types';

const KEY_PREFIX = 'ra_';
const KEY_BYTES = 32;

/** Generate a new agent API key and its SHA-256 hash. */
export async function generateAgentApiKey(): Promise<{
  plainKey: string;
  keyHash: string;
  keyPrefix: string;
}> {
  const bytes = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const plainKey = `${KEY_PREFIX}${hex}`;
  const keyPrefix = plainKey.slice(0, 10);
  const keyHash = await hashKey(plainKey);
  return { plainKey, keyHash, keyPrefix };
}

/** SHA-256 hash a key string. */
async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Get a service-role Supabase client for A2A operations. */
function getServiceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Extract and validate an agent API key from a request.
 * Returns the agent record if valid, or null.
 */
export async function authenticateAgent(
  request: Request,
): Promise<RegisteredAgent | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token.startsWith(KEY_PREFIX)) return null;

  const db = getServiceDb();
  if (!db) return null;

  const keyHash = await hashKey(token);

  const { data, error } = await db
    .from('agent_registry')
    .select('*')
    .eq('api_key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  // Update last_seen_at (fire-and-forget)
  db.from('agent_registry')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {});

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    callback_url: data.callback_url,
    capabilities: data.capabilities ?? [],
    trust_level: data.trust_level,
    is_active: data.is_active,
    created_at: data.created_at,
    last_seen_at: data.last_seen_at,
  };
}

export { getServiceDb };
