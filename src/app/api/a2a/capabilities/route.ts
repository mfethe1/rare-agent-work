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
    version: '1.1.0',
    intents,
    task_lifecycle: {
      description: 'Bidirectional task protocol: submit tasks and receive callbacks from assigned agents.',
      submit_endpoint: '/api/a2a/tasks',
      status_endpoint: '/api/a2a/tasks/{id}',
      update_endpoint: '/api/a2a/tasks/{id}',
      update_method: 'PATCH',
      agent_settable_statuses: ['in_progress', 'completed', 'failed'],
      valid_transitions: {
        accepted: ['in_progress', 'completed', 'failed'],
        in_progress: ['completed', 'failed'],
      },
      update_schema: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['in_progress', 'completed', 'failed'] },
          result: { type: 'object', description: 'Required when status is "completed".' },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', maxLength: 128 },
              message: { type: 'string', maxLength: 2000 },
            },
            description: 'Required when status is "failed".',
          },
        },
      },
      ttl_enforcement: 'Tasks that exceed ttl_seconds are auto-expired. Updates to expired tasks return HTTP 410.',
    },
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
