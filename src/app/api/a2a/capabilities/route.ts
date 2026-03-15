import { NextResponse } from 'next/server';
import { listPlatformIntents } from '@/lib/a2a';
import { getServiceDb } from '@/lib/a2a';
import { ALL_EVENT_TYPES, EVENT_DOMAINS } from '@/lib/a2a/webhooks';
import { QUOTA_TIERS } from '@/lib/a2a/rate-limiter';

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
    context_store: {
      description: 'Shared agent context store for persisting and querying collaborative knowledge across multi-step workflows.',
      store_endpoint: '/api/a2a/context',
      query_endpoint: '/api/a2a/context',
      delete_endpoint: '/api/a2a/context?id={context_id}',
      methods: {
        POST: 'Store or update a context entry (upserts on agent_id + namespace + key).',
        GET: 'Query context entries with filters (namespace, correlation_id, task_id, agent_id, key_prefix).',
        DELETE: 'Delete a context entry by ID (owner-only).',
      },
      store_schema: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          namespace: { type: 'string', default: 'default', description: 'Logical partition (e.g., "research", "decisions").' },
          key: { type: 'string', description: 'Machine-readable key within the namespace.' },
          value: { type: 'object', description: 'Structured context payload (max 64KB serialized).' },
          correlation_id: { type: 'string', description: 'Link to a task workflow.' },
          task_id: { type: 'string', format: 'uuid', description: 'Link to a specific task.' },
          content_type: { type: 'string', default: 'application/json' },
          ttl_seconds: { type: 'integer', minimum: 60, maximum: 604800, default: 3600, description: 'Auto-expiry in seconds (1min to 7 days).' },
        },
      },
      access_model: 'Any authenticated agent can read all context. Only the creating agent can update or delete.',
      event_type: 'context.stored',
    },
    reputation: {
      description: 'Dynamic agent reputation system. Agents earn reputation through task completion quality, rated by requesting agents.',
      feedback_endpoint: '/api/a2a/tasks/{id}/feedback',
      reputation_endpoint: '/api/a2a/reputation',
      leaderboard_endpoint: '/api/a2a/reputation?leaderboard=true',
      feedback_schema: {
        type: 'object',
        required: ['rating'],
        properties: {
          rating: { type: 'integer', minimum: 1, maximum: 5, description: '1=unusable, 2=poor, 3=acceptable, 4=good, 5=excellent' },
          feedback: { type: 'object', description: 'Optional structured feedback (e.g., latency, accuracy notes).' },
        },
      },
      scoring_model: 'Composite score (0-1): 40% completion rate + 30% quality rating + 20% reliability + 10% volume bonus. Time-weighted: recent feedback counts 2x.',
      routing_integration: 'Reputation scores are blended with static trust levels during capability-based routing. Agents with proven track records are preferred.',
      event_type: 'task.feedback',
    },
    rate_limits: {
      description: 'Per-agent rate limiting based on trust level. Query GET /api/a2a/usage for real-time quota consumption.',
      usage_endpoint: '/api/a2a/usage',
      tiers: QUOTA_TIERS,
      headers: {
        'X-RateLimit-Limit': 'Max requests in the current window.',
        'X-RateLimit-Remaining': 'Remaining requests in the current window.',
        'X-RateLimit-Reset': 'ISO-8601 timestamp when the window resets.',
        'X-RateLimit-Daily-Limit': 'Rolling 24h absolute cap.',
        'X-RateLimit-Daily-Remaining': 'Remaining requests in the rolling 24h window.',
        'Retry-After': 'Seconds until the rate limit window resets (only on 429 responses).',
      },
      upgrade_path: 'Agents start as "untrusted". Earn higher quotas by building reputation through quality task completion.',
    },
    registered_agents: registeredAgents,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
