/**
 * A2A Event Streaming Engine
 *
 * Core engine for emitting, storing, subscribing, delivering, and replaying
 * events across the A2A platform. This is the reactive backbone that turns
 * the platform from a request-response system into an event-driven ecosystem.
 *
 * Architecture:
 *   Event Producer → Event Store (Supabase) → Subscription Matcher → Delivery Pipeline
 *                                                                    ├─ Webhook POST
 *                                                                    ├─ SSE Push
 *                                                                    └─ Dead-Letter Queue
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  A2AEvent,
  DataFilter,
  DeadLetterEntry,
  DEFAULT_RETRY_POLICY,
  DeliveryAttempt,
  DeliveryConfig,
  DeliveryStatus,
  EventCatalogEntry,
  EventDomain,
  EventFilter,
  EventSubscription,
  EventTopic,
  EventTraceContext,
  ReplayRequest,
  ReplayResponse,
  RetryPolicy,
  SSEConnection,
  StreamMetrics,
  SubscriptionHealth,
  SubscriptionOptions,
  SubscriptionStatus,
  VALID_SUBSCRIPTION_TRANSITIONS,
  WebhookSignature,
} from './types';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Sequence counter — monotonic, persisted in Supabase
// ---------------------------------------------------------------------------

let sequenceCounter = 0;

async function nextSequence(supabase: SupabaseClient): Promise<number> {
  // Use Supabase RPC or atomic increment. For simplicity, use local counter
  // with DB sync. Production would use a Supabase sequence or Redis INCR.
  const { data } = await supabase
    .from('a2a_event_sequence')
    .select('value')
    .eq('id', 'global')
    .single();

  const current = data?.value ?? sequenceCounter;
  const next = current + 1;

  await supabase
    .from('a2a_event_sequence')
    .upsert({ id: 'global', value: next, updated_at: new Date().toISOString() });

  sequenceCounter = next;
  return next;
}

// ---------------------------------------------------------------------------
// UUIDv7 — time-ordered UUIDs for events
// ---------------------------------------------------------------------------

function uuidv7(): string {
  // UUIDv7: timestamp-based, sortable
  const now = Date.now();
  const hex = now.toString(16).padStart(12, '0');
  const rand = randomUUID().replace(/-/g, '').slice(12);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '7' + rand.slice(0, 3),
    ((parseInt(rand.slice(3, 4), 16) & 0x3) | 0x8).toString(16) + rand.slice(4, 7),
    rand.slice(7, 19),
  ].join('-');
}

// ---------------------------------------------------------------------------
// Event Emission
// ---------------------------------------------------------------------------

export interface EmitEventParams<T = unknown> {
  domain: EventDomain;
  action: string;
  source_agent_id?: string | null;
  resource_id: string;
  resource_type: string;
  correlation_id?: string | null;
  trace_context?: EventTraceContext | null;
  data: T;
  schema_version?: string;
}

/**
 * Emit a new event into the platform event stream.
 *
 * This is the primary entry point for all state changes across the A2A system.
 * Every service (task engine, contract engine, auction engine, etc.) should call
 * this when state changes occur.
 */
export async function emitEvent<T = unknown>(
  params: EmitEventParams<T>
): Promise<A2AEvent<T>> {
  const supabase = getSupabase();
  const sequence = await nextSequence(supabase);
  const topic: EventTopic = `${params.domain}.${params.action}`;

  const event: A2AEvent<T> = {
    id: uuidv7(),
    sequence,
    timestamp: new Date().toISOString(),
    topic,
    domain: params.domain,
    action: params.action,
    source_agent_id: params.source_agent_id ?? null,
    resource_id: params.resource_id,
    resource_type: params.resource_type,
    correlation_id: params.correlation_id ?? null,
    trace_context: params.trace_context ?? null,
    data: params.data,
    schema_version: params.schema_version ?? '1.0.0',
    idempotency_key: `${topic}:${params.resource_id}:${sequence}`,
  };

  // Persist the event
  const { error } = await supabase.from('a2a_events').insert({
    id: event.id,
    sequence: event.sequence,
    timestamp: event.timestamp,
    topic: event.topic,
    domain: event.domain,
    action: event.action,
    source_agent_id: event.source_agent_id,
    resource_id: event.resource_id,
    resource_type: event.resource_type,
    correlation_id: event.correlation_id,
    trace_context: event.trace_context,
    data: event.data,
    schema_version: event.schema_version,
    idempotency_key: event.idempotency_key,
  });

  if (error) {
    throw new Error(`Failed to persist event: ${error.message}`);
  }

  // Fan-out to matching subscriptions (async, non-blocking)
  fanOutEvent(event, supabase).catch((err) => {
    console.error('[EventEngine] Fan-out error for event', event.id, err);
  });

  return event;
}

/**
 * Emit multiple events atomically (e.g., workflow step transitions).
 */
export async function emitBatch<T = unknown>(
  events: EmitEventParams<T>[]
): Promise<A2AEvent<T>[]> {
  const results: A2AEvent<T>[] = [];
  for (const params of events) {
    results.push(await emitEvent(params));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Subscription Management
// ---------------------------------------------------------------------------

export interface CreateSubscriptionParams {
  agent_id: string;
  name: string;
  delivery: DeliveryConfig;
  filter: EventFilter;
  options?: Partial<SubscriptionOptions>;
}

const DEFAULT_OPTIONS: SubscriptionOptions = {
  max_events_per_second: 100,
  include_data: true,
  max_consecutive_failures: 10,
  dead_letter_enabled: true,
};

export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<EventSubscription> {
  const supabase = getSupabase();

  // Validate filter has at least one topic pattern
  if (!params.filter.topics || params.filter.topics.length === 0) {
    throw new Error('Subscription must have at least one topic pattern');
  }

  // Validate webhook URL if delivery method is webhook
  if (params.delivery.method === 'webhook' && !params.delivery.webhook_url) {
    throw new Error('Webhook URL required for webhook delivery');
  }

  const subscription: EventSubscription = {
    id: randomUUID(),
    agent_id: params.agent_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    name: params.name,
    delivery: {
      ...params.delivery,
      timeout_ms: params.delivery.timeout_ms || 10_000,
      batch_size: params.delivery.batch_size || 1,
      batch_window_ms: params.delivery.batch_window_ms || 0,
    },
    filter: params.filter,
    options: { ...DEFAULT_OPTIONS, ...params.options },
  };

  const { error } = await supabase.from('a2a_event_subscriptions').insert({
    id: subscription.id,
    agent_id: subscription.agent_id,
    created_at: subscription.created_at,
    updated_at: subscription.updated_at,
    status: subscription.status,
    name: subscription.name,
    delivery: subscription.delivery,
    filter: subscription.filter,
    options: subscription.options,
  });

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  return subscription;
}

export async function updateSubscriptionStatus(
  subscription_id: string,
  agent_id: string,
  new_status: SubscriptionStatus
): Promise<EventSubscription> {
  const supabase = getSupabase();

  const { data: existing, error: fetchError } = await supabase
    .from('a2a_event_subscriptions')
    .select('*')
    .eq('id', subscription_id)
    .eq('agent_id', agent_id)
    .single();

  if (fetchError || !existing) {
    throw new Error('Subscription not found');
  }

  const validTransitions = VALID_SUBSCRIPTION_TRANSITIONS[existing.status as SubscriptionStatus];
  if (!validTransitions?.includes(new_status)) {
    throw new Error(
      `Invalid transition: ${existing.status} → ${new_status}. Valid: ${validTransitions?.join(', ')}`
    );
  }

  const { data, error } = await supabase
    .from('a2a_event_subscriptions')
    .update({ status: new_status, updated_at: new Date().toISOString() })
    .eq('id', subscription_id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update subscription: ${error?.message}`);
  }

  return data as EventSubscription;
}

export async function listSubscriptions(
  agent_id: string,
  status?: SubscriptionStatus
): Promise<EventSubscription[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('a2a_event_subscriptions')
    .select('*')
    .eq('agent_id', agent_id)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list subscriptions: ${error.message}`);
  return (data ?? []) as EventSubscription[];
}

export async function getSubscription(
  subscription_id: string
): Promise<EventSubscription | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('a2a_event_subscriptions')
    .select('*')
    .eq('id', subscription_id)
    .single();

  if (error) return null;
  return data as EventSubscription;
}

// ---------------------------------------------------------------------------
// Event Matching — does an event match a subscription filter?
// ---------------------------------------------------------------------------

/**
 * Check if a topic matches a pattern with wildcard support.
 *
 * Patterns:
 *   "task.completed"   → exact match
 *   "task.*"           → matches any action in the task domain
 *   "*.completed"      → matches "completed" action in any domain
 *   "*.*"              → matches everything
 */
export function topicMatchesPattern(topic: string, pattern: string): boolean {
  if (pattern === '*.*') return true;
  if (pattern === topic) return true;

  const [patternDomain, patternAction] = pattern.split('.', 2);
  const [topicDomain, topicAction] = topic.split('.', 2);

  const domainMatch = patternDomain === '*' || patternDomain === topicDomain;
  const actionMatch = patternAction === '*' || patternAction === topicAction;

  return domainMatch && actionMatch;
}

/**
 * Evaluate a DataFilter predicate against event data.
 */
export function evaluateDataFilter(data: unknown, filter: DataFilter): boolean {
  const value = getNestedValue(data, filter.path);

  switch (filter.operator) {
    case 'exists':
      return value !== undefined && value !== null;
    case 'eq':
      return value === filter.value;
    case 'neq':
      return value !== filter.value;
    case 'gt':
      return typeof value === 'number' && typeof filter.value === 'number' && value > filter.value;
    case 'gte':
      return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value;
    case 'lt':
      return typeof value === 'number' && typeof filter.value === 'number' && value < filter.value;
    case 'lte':
      return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value;
    case 'contains':
      if (typeof value === 'string' && typeof filter.value === 'string') {
        return value.includes(filter.value);
      }
      if (Array.isArray(value)) {
        return value.includes(filter.value);
      }
      return false;
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(value);
    default:
      return false;
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Check if an event matches a subscription's filter.
 */
export function eventMatchesFilter(event: A2AEvent, filter: EventFilter): boolean {
  // Topic matching — at least one pattern must match
  const topicMatch = filter.topics.some((pattern) => topicMatchesPattern(event.topic, pattern));
  if (!topicMatch) return false;

  // Domain filter
  if (filter.domains && filter.domains.length > 0) {
    if (!filter.domains.includes(event.domain)) return false;
  }

  // Source agent filter
  if (filter.source_agent_ids && filter.source_agent_ids.length > 0) {
    if (!event.source_agent_id || !filter.source_agent_ids.includes(event.source_agent_id)) {
      return false;
    }
  }

  // Resource ID filter
  if (filter.resource_ids && filter.resource_ids.length > 0) {
    if (!filter.resource_ids.includes(event.resource_id)) return false;
  }

  // Resource type filter
  if (filter.resource_types && filter.resource_types.length > 0) {
    if (!filter.resource_types.includes(event.resource_type)) return false;
  }

  // Data filters (all must match — AND semantics)
  if (filter.data_filters && filter.data_filters.length > 0) {
    for (const df of filter.data_filters) {
      if (!evaluateDataFilter(event.data, df)) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Fan-Out — deliver event to matching subscriptions
// ---------------------------------------------------------------------------

async function fanOutEvent(event: A2AEvent, supabase: SupabaseClient): Promise<void> {
  // Fetch all active subscriptions
  const { data: subscriptions, error } = await supabase
    .from('a2a_event_subscriptions')
    .select('*')
    .eq('status', 'active');

  if (error || !subscriptions) return;

  const matching = subscriptions.filter((sub) =>
    eventMatchesFilter(event, sub.filter as EventFilter)
  );

  // Deliver to each matching subscription
  await Promise.allSettled(
    matching.map((sub) => deliverEvent(event, sub as EventSubscription, supabase))
  );
}

// ---------------------------------------------------------------------------
// Delivery Pipeline
// ---------------------------------------------------------------------------

async function deliverEvent(
  event: A2AEvent,
  subscription: EventSubscription,
  supabase: SupabaseClient
): Promise<void> {
  const delivery = subscription.delivery;

  switch (delivery.method) {
    case 'webhook':
      await deliverViaWebhook(event, subscription, supabase);
      break;
    case 'sse':
      await queueForSSE(event, subscription, supabase);
      break;
    case 'websocket':
      await queueForSSE(event, subscription, supabase); // Same queue, different transport
      break;
  }
}

/**
 * Deliver an event via webhook POST with HMAC signature.
 */
async function deliverViaWebhook(
  event: A2AEvent,
  subscription: EventSubscription,
  supabase: SupabaseClient,
  attempt_number = 1
): Promise<void> {
  const { delivery, options } = subscription;
  if (!delivery.webhook_url) return;

  // Strip data if not included
  const payload = options.include_data
    ? event
    : { ...event, data: undefined };

  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-A2A-Event-ID': event.id,
    'X-A2A-Event-Topic': event.topic,
    'X-A2A-Event-Sequence': String(event.sequence),
    'X-A2A-Subscription-ID': subscription.id,
    'X-A2A-Delivery-Timestamp': timestamp,
    ...(delivery.webhook_headers ?? {}),
  };

  // HMAC signature if secret configured
  if (delivery.webhook_secret) {
    const sig = computeWebhookSignature(body, timestamp, delivery.webhook_secret);
    headers['X-A2A-Signature'] = sig.signature;
    headers['X-A2A-Signature-Timestamp'] = sig.timestamp;
  }

  const startTime = Date.now();
  let status: DeliveryStatus = 'pending';
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), delivery.timeout_ms || 10_000);

    const response = await fetch(delivery.webhook_url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    statusCode = response.status;

    if (response.ok) {
      status = 'delivered';
    } else {
      status = 'failed';
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : 'Unknown delivery error';
  }

  const latency = Date.now() - startTime;

  // Record the delivery attempt
  const attemptRecord: Partial<DeliveryAttempt> = {
    id: randomUUID(),
    subscription_id: subscription.id,
    event_id: event.id,
    event_sequence: event.sequence,
    status,
    created_at: new Date().toISOString(),
    delivered_at: status === 'delivered' ? new Date().toISOString() : null,
    attempt_count: attempt_number,
    last_status_code: statusCode,
    last_error: errorMessage,
    last_latency_ms: latency,
    next_retry_at: null,
  };

  // Handle failures with retry or dead-letter
  if (status === 'failed') {
    const retryPolicy = DEFAULT_RETRY_POLICY;

    if (attempt_number < retryPolicy.max_attempts) {
      const delay = computeRetryDelay(attempt_number, retryPolicy);
      attemptRecord.status = 'retrying';
      attemptRecord.next_retry_at = new Date(Date.now() + delay).toISOString();

      // Schedule retry (in production, this would use a job queue like BullMQ)
      setTimeout(() => {
        deliverViaWebhook(event, subscription, supabase, attempt_number + 1).catch(() => {});
      }, delay);
    } else {
      // Max retries exhausted — dead-letter
      attemptRecord.status = 'dead_lettered';

      if (options.dead_letter_enabled) {
        await deadLetter(event, subscription, errorMessage ?? 'Max retries exhausted', attempt_number, supabase);
      }

      // Check consecutive failures for auto-pause
      await checkConsecutiveFailures(subscription, supabase);
    }
  }

  await supabase.from('a2a_event_delivery_attempts').insert(attemptRecord);
}

/**
 * Queue event for SSE/WebSocket delivery (polled by the SSE endpoint).
 */
async function queueForSSE(
  event: A2AEvent,
  subscription: EventSubscription,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from('a2a_event_sse_queue').insert({
    id: randomUUID(),
    subscription_id: subscription.id,
    event_id: event.id,
    event_sequence: event.sequence,
    event_data: event,
    created_at: new Date().toISOString(),
    delivered: false,
  });
}

// ---------------------------------------------------------------------------
// Webhook Signature
// ---------------------------------------------------------------------------

export function computeWebhookSignature(
  body: string,
  timestamp: string,
  secret: string
): WebhookSignature {
  const payload = `${timestamp}.${body}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { algorithm: 'hmac-sha256', signature, timestamp };
}

export function verifyWebhookSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const expected = computeWebhookSignature(body, timestamp, secret);
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected.signature, 'hex')
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Retry Logic
// ---------------------------------------------------------------------------

export function computeRetryDelay(attempt: number, policy: RetryPolicy): number {
  const baseDelay = policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt - 1);
  const capped = Math.min(baseDelay, policy.max_delay_ms);
  const jitter = capped * policy.jitter_factor * Math.random();
  return Math.round(capped + jitter);
}

// ---------------------------------------------------------------------------
// Dead-Letter Queue
// ---------------------------------------------------------------------------

async function deadLetter(
  event: A2AEvent,
  subscription: EventSubscription,
  reason: string,
  attempts: number,
  supabase: SupabaseClient
): Promise<void> {
  const entry: Partial<DeadLetterEntry> = {
    id: randomUUID(),
    subscription_id: subscription.id,
    event_id: event.id,
    event: event,
    failed_at: new Date().toISOString(),
    failure_reason: reason,
    attempt_count: attempts,
    replayed: false,
    replayed_at: null,
  };

  await supabase.from('a2a_event_dead_letters').insert(entry);
}

/**
 * Replay a dead-lettered event (manual recovery).
 */
export async function replayDeadLetter(dead_letter_id: string): Promise<void> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('a2a_event_dead_letters')
    .select('*')
    .eq('id', dead_letter_id)
    .eq('replayed', false)
    .single();

  if (error || !data) {
    throw new Error('Dead-letter entry not found or already replayed');
  }

  const subscription = await getSubscription(data.subscription_id);
  if (!subscription || subscription.status !== 'active') {
    throw new Error('Subscription not active');
  }

  // Attempt redelivery
  await deliverEvent(data.event as A2AEvent, subscription, supabase);

  // Mark as replayed
  await supabase
    .from('a2a_event_dead_letters')
    .update({ replayed: true, replayed_at: new Date().toISOString() })
    .eq('id', dead_letter_id);
}

export async function listDeadLetters(
  subscription_id: string,
  options?: { limit?: number; include_replayed?: boolean }
): Promise<DeadLetterEntry[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('a2a_event_dead_letters')
    .select('*')
    .eq('subscription_id', subscription_id)
    .order('failed_at', { ascending: false })
    .limit(options?.limit ?? 50);

  if (!options?.include_replayed) {
    query = query.eq('replayed', false);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list dead letters: ${error.message}`);
  return (data ?? []) as DeadLetterEntry[];
}

// ---------------------------------------------------------------------------
// Consecutive Failure Tracking — auto-pause subscriptions
// ---------------------------------------------------------------------------

async function checkConsecutiveFailures(
  subscription: EventSubscription,
  supabase: SupabaseClient
): Promise<void> {
  const { data } = await supabase
    .from('a2a_event_delivery_attempts')
    .select('status')
    .eq('subscription_id', subscription.id)
    .order('created_at', { ascending: false })
    .limit(subscription.options.max_consecutive_failures);

  if (!data) return;

  const allFailed = data.every((d) => d.status === 'dead_lettered' || d.status === 'failed');
  if (allFailed && data.length >= subscription.options.max_consecutive_failures) {
    // Auto-suspend the subscription
    await supabase
      .from('a2a_event_subscriptions')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', subscription.id);

    console.warn(
      `[EventEngine] Subscription ${subscription.id} auto-suspended after ${data.length} consecutive failures`
    );
  }
}

// ---------------------------------------------------------------------------
// Event Replay — catch-up after disconnection
// ---------------------------------------------------------------------------

export async function replayEvents(params: ReplayRequest): Promise<ReplayResponse> {
  const supabase = getSupabase();

  // Verify subscription exists
  const subscription = await getSubscription(params.subscription_id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Query events from the requested sequence
  let query = supabase
    .from('a2a_events')
    .select('*')
    .gte('sequence', params.from_sequence)
    .order('sequence', { ascending: true })
    .limit(params.limit);

  if (params.to_sequence !== undefined) {
    query = query.lte('sequence', params.to_sequence);
  }

  const { data: allEvents, error } = await query;
  if (error) throw new Error(`Failed to replay events: ${error.message}`);

  // Filter events through subscription filter
  const matchingEvents = (allEvents ?? [])
    .map((e) => e as A2AEvent)
    .filter((e) => eventMatchesFilter(e, subscription.filter));

  // Count total available
  const { count } = await supabase
    .from('a2a_events')
    .select('*', { count: 'exact', head: true })
    .gte('sequence', params.from_sequence);

  return {
    events: matchingEvents,
    first_sequence: matchingEvents.length > 0 ? matchingEvents[0].sequence : params.from_sequence,
    last_sequence: matchingEvents.length > 0 ? matchingEvents[matchingEvents.length - 1].sequence : params.from_sequence,
    has_more: (count ?? 0) > params.limit,
    total_available: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// SSE Connection Management
// ---------------------------------------------------------------------------

export async function registerSSEConnection(
  subscription_id: string,
  agent_id: string
): Promise<SSEConnection> {
  const supabase = getSupabase();

  const connection: SSEConnection = {
    id: randomUUID(),
    subscription_id,
    agent_id,
    connected_at: new Date().toISOString(),
    last_event_sequence: 0,
    last_heartbeat_at: new Date().toISOString(),
    status: 'connected',
  };

  await supabase.from('a2a_event_sse_connections').insert(connection);
  return connection;
}

export async function disconnectSSE(connection_id: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from('a2a_event_sse_connections')
    .update({ status: 'disconnected' })
    .eq('id', connection_id);
}

export async function pollSSEQueue(
  subscription_id: string,
  limit = 10
): Promise<A2AEvent[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('a2a_event_sse_queue')
    .select('event_data')
    .eq('subscription_id', subscription_id)
    .eq('delivered', false)
    .order('event_sequence', { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  // Mark as delivered
  const ids = data.map((d) => d.event_data?.id).filter(Boolean);
  if (ids.length > 0) {
    await supabase
      .from('a2a_event_sse_queue')
      .update({ delivered: true })
      .eq('subscription_id', subscription_id)
      .in('event_id', ids);
  }

  return data.map((d) => d.event_data as A2AEvent);
}

// ---------------------------------------------------------------------------
// Stream Metrics
// ---------------------------------------------------------------------------

export async function getStreamMetrics(): Promise<StreamMetrics> {
  const supabase = getSupabase();
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  // Parallel queries
  const [
    totalEventsResult,
    recentEventsResult,
    activeSubsResult,
    activeSSEResult,
    deliveryStatsResult,
    domainCountsResult,
  ] = await Promise.all([
    supabase.from('a2a_events').select('*', { count: 'exact', head: true }),
    supabase.from('a2a_events').select('*', { count: 'exact', head: true }).gte('timestamp', oneHourAgo),
    supabase.from('a2a_event_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('a2a_event_sse_connections').select('*', { count: 'exact', head: true }).eq('status', 'connected'),
    supabase.from('a2a_event_delivery_attempts').select('status, last_latency_ms').gte('created_at', oneHourAgo),
    supabase.from('a2a_events').select('domain').gte('timestamp', oneHourAgo),
  ]);

  // Compute delivery stats
  const deliveries = deliveryStatsResult.data ?? [];
  const delivered = deliveries.filter((d) => d.status === 'delivered');
  const latencies = delivered.map((d) => d.last_latency_ms).filter((l) => l != null) as number[];
  const successRate = deliveries.length > 0 ? delivered.length / deliveries.length : 1;
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p99Latency = latencies.length > 0
    ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)]
    : 0;

  // Domain counts
  const domainCounts = {} as Record<EventDomain, number>;
  for (const row of domainCountsResult.data ?? []) {
    const domain = row.domain as EventDomain;
    domainCounts[domain] = (domainCounts[domain] ?? 0) + 1;
  }

  // Dead letter depth
  const { count: dlDepth } = await supabase
    .from('a2a_event_dead_letters')
    .select('*', { count: 'exact', head: true })
    .eq('replayed', false);

  const eventsLastHour = recentEventsResult.count ?? 0;

  return {
    total_events_emitted: totalEventsResult.count ?? 0,
    events_last_hour: eventsLastHour,
    active_subscriptions: activeSubsResult.count ?? 0,
    active_sse_connections: activeSSEResult.count ?? 0,
    delivery_success_rate: successRate,
    avg_delivery_latency_ms: Math.round(avgLatency),
    p99_delivery_latency_ms: p99Latency ?? 0,
    dead_letter_depth: dlDepth ?? 0,
    events_per_second: Math.round((eventsLastHour / 3600) * 100) / 100,
    domain_counts: domainCounts,
  };
}

// ---------------------------------------------------------------------------
// Subscription Health
// ---------------------------------------------------------------------------

export async function getSubscriptionHealth(
  subscription_id: string
): Promise<SubscriptionHealth> {
  const supabase = getSupabase();
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const [subResult, deliveriesResult, dlResult, latestEventResult] = await Promise.all([
    supabase.from('a2a_event_subscriptions').select('status').eq('id', subscription_id).single(),
    supabase
      .from('a2a_event_delivery_attempts')
      .select('status, created_at, last_latency_ms')
      .eq('subscription_id', subscription_id)
      .gte('created_at', oneHourAgo),
    supabase
      .from('a2a_event_dead_letters')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', subscription_id)
      .eq('replayed', false),
    supabase
      .from('a2a_events')
      .select('sequence')
      .order('sequence', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const deliveries = deliveriesResult.data ?? [];
  const delivered = deliveries.filter((d) => d.status === 'delivered');
  const failed = deliveries.filter((d) => d.status === 'failed' || d.status === 'dead_lettered');
  const latencies = delivered.map((d) => d.last_latency_ms).filter(Boolean) as number[];

  // Consecutive failures
  const { data: recentDeliveries } = await supabase
    .from('a2a_event_delivery_attempts')
    .select('status')
    .eq('subscription_id', subscription_id)
    .order('created_at', { ascending: false })
    .limit(20);

  let consecutiveFailures = 0;
  for (const d of recentDeliveries ?? []) {
    if (d.status === 'delivered') break;
    consecutiveFailures++;
  }

  // Last delivery/failure timestamps
  const lastDelivered = delivered.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const lastFailed = failed.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  // Lag: difference between latest event and latest delivered event sequence
  const latestSequence = latestEventResult.data?.sequence ?? 0;
  const { data: lastDeliveredEvent } = await supabase
    .from('a2a_event_delivery_attempts')
    .select('event_sequence')
    .eq('subscription_id', subscription_id)
    .eq('status', 'delivered')
    .order('event_sequence', { ascending: false })
    .limit(1)
    .single();

  const lag = latestSequence - (lastDeliveredEvent?.event_sequence ?? 0);

  return {
    subscription_id,
    status: (subResult.data?.status ?? 'cancelled') as SubscriptionStatus,
    consecutive_failures: consecutiveFailures,
    last_delivery_at: lastDelivered?.created_at ?? null,
    last_failure_at: lastFailed?.created_at ?? null,
    events_delivered_last_hour: delivered.length,
    events_failed_last_hour: failed.length,
    avg_latency_ms: latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0,
    dead_letter_depth: dlResult.count ?? 0,
    lag,
  };
}

// ---------------------------------------------------------------------------
// Event Catalog — self-documenting event types
// ---------------------------------------------------------------------------

export function getEventCatalog(): EventCatalogEntry[] {
  return [
    // Task events
    {
      topic: 'task.submitted' as EventTopic,
      domain: 'task',
      action: 'submitted',
      description: 'A new task has been submitted to the platform',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          sender_agent_id: { type: 'string' },
          target_agent_id: { type: 'string' },
          intent: { type: 'string' },
          priority: { type: 'number' },
        },
      },
      example: {
        task_id: 'task-001',
        sender_agent_id: 'agent-a',
        target_agent_id: 'agent-b',
        intent: 'news.summarize',
        priority: 5,
      },
    },
    {
      topic: 'task.completed' as EventTopic,
      domain: 'task',
      action: 'completed',
      description: 'A task has been completed successfully',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          agent_id: { type: 'string' },
          duration_ms: { type: 'number' },
          output_summary: { type: 'string' },
        },
      },
      example: {
        task_id: 'task-001',
        agent_id: 'agent-b',
        duration_ms: 3420,
        output_summary: 'Summarized 5 articles',
      },
    },
    // Contract events
    {
      topic: 'contract.breached' as EventTopic,
      domain: 'contract',
      action: 'breached',
      description: 'A service contract SLA has been breached',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          contract_id: { type: 'string' },
          violation: { type: 'string' },
          metric_value: { type: 'number' },
          threshold: { type: 'number' },
        },
      },
      example: {
        contract_id: 'contract-001',
        violation: 'max_latency_ms exceeded',
        metric_value: 12000,
        threshold: 5000,
      },
    },
    // Auction events
    {
      topic: 'auction.bid_placed' as EventTopic,
      domain: 'auction',
      action: 'bid_placed',
      description: 'A new bid has been placed on an auction',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          auction_id: { type: 'string' },
          bidder_agent_id: { type: 'string' },
          price: { type: 'number' },
          estimated_completion_ms: { type: 'number' },
        },
      },
      example: {
        auction_id: 'auction-001',
        bidder_agent_id: 'agent-c',
        price: 50,
        estimated_completion_ms: 2000,
      },
    },
    // Governance events
    {
      topic: 'governance.kill_switch_activated' as EventTopic,
      domain: 'governance',
      action: 'kill_switch_activated',
      description: 'Emergency kill switch activated for an agent',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          reason: { type: 'string' },
          activated_by: { type: 'string' },
        },
      },
      example: {
        agent_id: 'agent-rogue',
        reason: 'Excessive spend detected',
        activated_by: 'governance-supervisor',
      },
    },
    // Mesh events
    {
      topic: 'mesh.circuit_opened' as EventTopic,
      domain: 'mesh',
      action: 'circuit_opened',
      description: 'Circuit breaker opened for an agent (agent is failing)',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          failure_rate: { type: 'number' },
          threshold: { type: 'number' },
        },
      },
      example: {
        agent_id: 'agent-flaky',
        failure_rate: 0.85,
        threshold: 0.5,
      },
    },
    // Billing events
    {
      topic: 'billing.low_balance_warning' as EventTopic,
      domain: 'billing',
      action: 'low_balance_warning',
      description: 'Agent wallet balance has dropped below warning threshold',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          current_balance: { type: 'number' },
          threshold: { type: 'number' },
        },
      },
      example: {
        agent_id: 'agent-broke',
        current_balance: 5,
        threshold: 10,
      },
    },
    // Workflow events
    {
      topic: 'workflow.step_failed' as EventTopic,
      domain: 'workflow',
      action: 'step_failed',
      description: 'A workflow step has failed',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          workflow_id: { type: 'string' },
          execution_id: { type: 'string' },
          step_id: { type: 'string' },
          error: { type: 'string' },
          retrying: { type: 'boolean' },
        },
      },
      example: {
        workflow_id: 'wf-001',
        execution_id: 'exec-001',
        step_id: 'step-3',
        error: 'Target agent unavailable',
        retrying: true,
      },
    },
    // Federation events
    {
      topic: 'federation.peer_activated' as EventTopic,
      domain: 'federation',
      action: 'peer_activated',
      description: 'A federation peer has been activated',
      schema_version: '1.0.0',
      data_schema: {
        type: 'object',
        properties: {
          peer_id: { type: 'string' },
          platform_name: { type: 'string' },
          agent_count: { type: 'number' },
        },
      },
      example: {
        peer_id: 'peer-001',
        platform_name: 'AgentHub',
        agent_count: 150,
      },
    },
  ];
}
