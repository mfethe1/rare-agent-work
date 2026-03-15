import { NextResponse } from 'next/server';
import { listPlatformIntents } from '@/lib/a2a';
import { getServiceDb } from '@/lib/a2a';
import { ALL_EVENT_TYPES, EVENT_DOMAINS } from '@/lib/a2a/webhooks';

/**
 * GET /api/a2a/capabilities — Discover platform capabilities.
 *
 * Public endpoint (no auth required). Lists all supported task intents,
 * webhook event types, and their input schemas so agents can self-configure.
 */
export async function GET() {
  const intents = listPlatformIntents();

  // Count active registered agents (best-effort)
  let registeredAgents = 0;
  const db = getServiceDb();
  if (db) {
    const { count } = await db
      .from('agent_registry')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    registeredAgents = count ?? 0;
  }

  return NextResponse.json({
    platform: 'rareagent.work',
    version: '1.0.0',
    intents,
    webhooks: {
      description: 'Subscribe to platform events and receive HMAC-signed HTTP callbacks.',
      subscription_endpoint: '/api/a2a/subscriptions',
      event_types: ALL_EVENT_TYPES,
      wildcard_domains: EVENT_DOMAINS,
      signature_algorithm: 'HMAC-SHA256',
      signature_header: 'X-Webhook-Signature',
      max_subscriptions_per_agent: 10,
      retry_policy: {
        max_attempts: 6,
        backoff: 'exponential',
        delays_seconds: [30, 120, 600, 3600, 21600],
      },
    },
    registered_agents: registeredAgents,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
