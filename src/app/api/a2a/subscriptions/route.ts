import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent, getServiceDb } from '@/lib/a2a';
import {
  subscriptionCreateSchema,
  hashSecret,
  ALL_EVENT_TYPES,
  EVENT_DOMAINS,
} from '@/lib/a2a/webhooks';
import type { SubscriptionCreateResponse, SubscriptionListResponse } from '@/lib/a2a/webhooks';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';

/**
 * POST /api/a2a/subscriptions — Create a webhook subscription.
 *
 * Agents subscribe to event patterns and provide a target URL + HMAC secret.
 * When matching events fire, the platform delivers HMAC-signed payloads
 * to the target URL.
 *
 * Rate-limited per agent based on trust level.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  // Rate limit check
  const rl = await checkRateLimit(agent.id, agent.trust_level, 'subscription.create');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('subscription.create', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = await validateRequest(request, subscriptionCreateSchema);
  if (!parsed.success) return parsed.response;

  const { target_url, events, secret, label } = parsed.data;

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      { status: 503 },
    );
  }

  try {
    // Check subscription limit per agent (max 10)
    const { count } = await db
      .from('webhook_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent.id)
      .eq('is_active', true);

    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 active subscriptions per agent.' },
        { status: 429 },
      );
    }

    // Hash the secret (plain secret never stored)
    const { secretHash, secretPrefix } = await hashSecret(secret);

    const { data: sub, error: insertError } = await db
      .from('webhook_subscriptions')
      .insert({
        agent_id: agent.id,
        target_url,
        events,
        secret_hash: secretHash,
        secret_prefix: secretPrefix,
        is_active: true,
        label: label ?? null,
      })
      .select('id, events, target_url, is_active, created_at')
      .single();

    if (insertError || !sub) {
      return NextResponse.json(
        safeErrorBody(insertError, 'db', 'POST /api/a2a/subscriptions'),
        { status: 500 },
      );
    }

    const response: SubscriptionCreateResponse = {
      subscription_id: sub.id,
      events: sub.events,
      target_url: sub.target_url,
      is_active: sub.is_active,
      created_at: sub.created_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/subscriptions'),
      { status: 500 },
    );
  }
}

/**
 * GET /api/a2a/subscriptions — List the calling agent's subscriptions.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      { status: 503 },
    );
  }

  try {
    const { data: subs, error } = await db
      .from('webhook_subscriptions')
      .select('id, events, target_url, is_active, label, created_at')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        safeErrorBody(error, 'db', 'GET /api/a2a/subscriptions'),
        { status: 500 },
      );
    }

    const response: SubscriptionListResponse = {
      subscriptions: subs ?? [],
      count: subs?.length ?? 0,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'GET /api/a2a/subscriptions'),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/a2a/subscriptions — Deactivate a subscription.
 *
 * Expects ?id=<subscription-uuid> query parameter.
 * Only the owning agent can deactivate their own subscriptions.
 */
export async function DELETE(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get('id');
  if (!subscriptionId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: id' },
      { status: 400 },
    );
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(subscriptionId)) {
    return NextResponse.json(
      { error: 'Invalid subscription ID format.' },
      { status: 400 },
    );
  }

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      { status: 503 },
    );
  }

  try {
    // Deactivate (soft delete) — only if owned by this agent
    const { data: updated, error } = await db
      .from('webhook_subscriptions')
      .update({ is_active: false })
      .eq('id', subscriptionId)
      .eq('agent_id', agent.id)
      .select('id')
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: 'Subscription not found or not owned by this agent.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true, subscription_id: subscriptionId });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'DELETE /api/a2a/subscriptions'),
      { status: 500 },
    );
  }
}
