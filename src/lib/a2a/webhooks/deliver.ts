/**
 * Webhook Delivery Engine
 *
 * Handles HMAC-SHA256 signing, event dispatch, retry scheduling, and
 * delivery tracking. Designed for fire-and-forget from hot paths (e.g.,
 * task completion) — the actual HTTP delivery runs asynchronously.
 *
 * Security model:
 * - Each subscription has a unique secret (agent-provided, hashed in DB).
 * - Every delivery is signed with HMAC-SHA256 using the agent's secret.
 * - Agents verify via the X-Webhook-Signature header.
 * - Events include an idempotency key (event_id) for deduplication.
 *
 * Retry policy:
 * - Up to 5 attempts with exponential backoff: 30s, 2m, 10m, 1h, 6h.
 * - Failed deliveries are logged; agents can query delivery history.
 */

import { getServiceDb } from '../auth';
import type {
  WebhookEventType,
  WebhookEventPayload,
  WebhookSubscription,
  SubscriptionPattern,
} from './types';

/** Retry delays in milliseconds: 30s, 2m, 10m, 1h, 6h. */
const RETRY_DELAYS_MS = [
  30_000,
  120_000,
  600_000,
  3_600_000,
  21_600_000,
];

const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1; // 6 total (1 initial + 5 retries)

// ──────────────────────────────────────────────
// HMAC Signing
// ──────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 signature for a webhook payload.
 * The agent verifies this against X-Webhook-Signature header.
 */
export async function signPayload(
  payload: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

/**
 * Verify an HMAC-SHA256 signature (for agents to use in their handlers).
 * Exported as a utility so agents consuming this as an SDK can verify.
 */
export async function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  // Constant-time comparison
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signature);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// ──────────────────────────────────────────────
// Event Pattern Matching
// ──────────────────────────────────────────────

/** Check if an event type matches a subscription pattern. */
export function matchesPattern(
  eventType: WebhookEventType,
  pattern: SubscriptionPattern,
): boolean {
  if (pattern === '*') return true;
  if (pattern === eventType) return true;
  if (pattern.endsWith('.*')) {
    const domain = pattern.slice(0, -2);
    return eventType.startsWith(`${domain}.`);
  }
  return false;
}

/** Check if any pattern in a subscription matches the event. */
export function subscriptionMatchesEvent(
  events: SubscriptionPattern[],
  eventType: WebhookEventType,
): boolean {
  return events.some((pattern) => matchesPattern(eventType, pattern));
}

// ──────────────────────────────────────────────
// Event Emission (fire-and-forget)
// ──────────────────────────────────────────────

/**
 * Emit a platform event. Finds all matching subscriptions and schedules
 * webhook deliveries. This is designed to be called from hot paths
 * (e.g., task completion) without blocking the response.
 *
 * @param eventType - The event that occurred
 * @param data - Event-specific payload data
 * @param sourceAgentId - Optional: only notify this specific agent (for task.assigned)
 */
export async function emitEvent(
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  sourceAgentId?: string,
): Promise<void> {
  // Fire-and-forget: don't block the caller
  deliverEvent(eventType, data, sourceAgentId).catch((err) => {
    console.error(`[Webhook] Failed to emit ${eventType}:`, err);
  });
}

async function deliverEvent(
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  targetAgentId?: string,
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  // Find matching active subscriptions
  let query = db
    .from('webhook_subscriptions')
    .select('id, agent_id, target_url, events, secret_hash')
    .eq('is_active', true);

  if (targetAgentId) {
    query = query.eq('agent_id', targetAgentId);
  }

  const { data: subscriptions, error } = await query;
  if (error || !subscriptions?.length) return;

  // Build the event payload
  const eventPayload: WebhookEventPayload = {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    timestamp: new Date().toISOString(),
    api_version: '2028-03-14',
    data,
  };

  const payloadJson = JSON.stringify(eventPayload);

  // Filter to subscriptions whose event patterns match
  const matching = subscriptions.filter((sub) =>
    subscriptionMatchesEvent(sub.events as SubscriptionPattern[], eventType),
  );

  // Create delivery records and attempt initial delivery
  for (const sub of matching) {
    try {
      // Insert delivery record
      const { data: delivery } = await db
        .from('webhook_deliveries')
        .insert({
          subscription_id: sub.id,
          event_type: eventType,
          payload: eventPayload,
          status: 'pending',
          attempts: 0,
          max_attempts: MAX_ATTEMPTS,
        })
        .select('id')
        .single();

      if (!delivery) continue;

      // Attempt delivery
      await attemptDelivery(db, delivery.id, sub.target_url, payloadJson, sub.secret_hash);
    } catch (err) {
      console.error(`[Webhook] Delivery error for subscription ${sub.id}:`, err);
    }
  }
}

// ──────────────────────────────────────────────
// HTTP Delivery with Retry
// ──────────────────────────────────────────────

async function attemptDelivery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  deliveryId: string,
  targetUrl: string,
  payloadJson: string,
  secretHash: string,
): Promise<void> {
  // We sign with the hash as the HMAC key. The agent was told the plain
  // secret at subscription time and must hash it the same way to verify.
  // Actually — the agent keeps the plain secret and we need the plain secret
  // for HMAC. But we only store the hash. Solution: we use the hash as the
  // shared HMAC key. The agent receives instructions to use sha256(secret)
  // as the HMAC key for verification. This avoids storing plain secrets.
  const signature = await signPayload(payloadJson, secretHash);

  // Update attempt count
  const { data: current } = await db
    .from('webhook_deliveries')
    .select('attempts')
    .eq('id', deliveryId)
    .single();

  const attempt = (current?.attempts ?? 0) + 1;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payloadJson ? JSON.parse(payloadJson).event_type : '',
        'X-Webhook-Delivery-Id': deliveryId,
        'User-Agent': 'RareAgentWork-Webhooks/1.0',
      },
      body: payloadJson,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      // Success
      await db
        .from('webhook_deliveries')
        .update({
          status: 'delivered',
          response_status: response.status,
          attempts: attempt,
          completed_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);
    } else {
      // Non-2xx response — schedule retry
      await scheduleRetry(db, deliveryId, attempt, response.status);
    }
  } catch (err) {
    // Network error or timeout — schedule retry
    await scheduleRetry(db, deliveryId, attempt, null);
    console.error(`[Webhook] Delivery attempt ${attempt} failed for ${deliveryId}:`, err);
  }
}

async function scheduleRetry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  deliveryId: string,
  attempt: number,
  responseStatus: number | null,
): Promise<void> {
  if (attempt >= MAX_ATTEMPTS) {
    // Exhausted retries
    await db
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        response_status: responseStatus,
        attempts: attempt,
        completed_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);
    return;
  }

  const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const nextRetry = new Date(Date.now() + delay).toISOString();

  await db
    .from('webhook_deliveries')
    .update({
      status: 'retrying',
      response_status: responseStatus,
      attempts: attempt,
      next_retry_at: nextRetry,
    })
    .eq('id', deliveryId);
}

// ──────────────────────────────────────────────
// Subscription Secret Hashing
// ──────────────────────────────────────────────

/** Hash a subscription secret with SHA-256 (same approach as API keys). */
export async function hashSecret(secret: string): Promise<{ secretHash: string; secretPrefix: string }> {
  const encoded = new TextEncoder().encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const secretHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { secretHash, secretPrefix: secret.slice(0, 8) };
}
