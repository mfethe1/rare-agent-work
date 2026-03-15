/**
 * A2A Webhook Event System — Types
 *
 * Defines the event taxonomy, subscription model, and delivery tracking
 * for push-based agent notifications. Agents subscribe to event patterns
 * and receive HMAC-signed HTTP callbacks when matching events fire.
 *
 * Event naming convention: <domain>.<action>
 *   - task.completed, task.failed, task.assigned
 *   - agent.registered, agent.deactivated
 *   - news.published, digest.published
 *   - capability.added
 */

// ──────────────────────────────────────────────
// Event Taxonomy
// ──────────────────────────────────────────────

/** All platform event types that agents can subscribe to. */
export type WebhookEventType =
  // Task lifecycle — emitted when tasks change state
  | 'task.completed'
  | 'task.failed'
  | 'task.assigned'      // A task was routed to this agent
  // Agent network — emitted on agent registry changes
  | 'agent.registered'
  | 'agent.deactivated'
  // Content — emitted when new content is available
  | 'news.published'
  | 'digest.published'
  // Capability changes
  | 'capability.added'
  // Context store — emitted when agents persist shared knowledge
  | 'context.stored';

/** Wildcard patterns agents can subscribe to (e.g., "task.*"). */
export type SubscriptionPattern = WebhookEventType | `${string}.*` | '*';

/** All known event type strings for validation. */
export const ALL_EVENT_TYPES: WebhookEventType[] = [
  'task.completed',
  'task.failed',
  'task.assigned',
  'agent.registered',
  'agent.deactivated',
  'news.published',
  'digest.published',
  'capability.added',
  'context.stored',
];

/** Event domain prefixes that support wildcard subscriptions. */
export const EVENT_DOMAINS = ['task', 'agent', 'news', 'digest', 'capability', 'context'] as const;

// ──────────────────────────────────────────────
// Webhook Subscription
// ──────────────────────────────────────────────

export interface WebhookSubscription {
  /** Platform-assigned subscription ID (UUID). */
  id: string;
  /** Agent that owns this subscription. */
  agent_id: string;
  /** URL to deliver events to (must be HTTPS in production). */
  target_url: string;
  /** Event patterns this subscription matches. */
  events: SubscriptionPattern[];
  /** HMAC-SHA256 secret for signature verification (hashed in DB). */
  secret_hash: string;
  /** First 8 chars of secret for identification. */
  secret_prefix: string;
  /** Whether this subscription is active. */
  is_active: boolean;
  /** Optional label for agent-side identification. */
  label?: string;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Webhook Delivery
// ──────────────────────────────────────────────

export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

export interface WebhookDelivery {
  /** Delivery attempt ID (UUID). */
  id: string;
  /** Which subscription this delivery is for. */
  subscription_id: string;
  /** The event type that triggered this delivery. */
  event_type: WebhookEventType;
  /** The full event payload sent to the agent. */
  payload: WebhookEventPayload;
  /** Current delivery status. */
  status: DeliveryStatus;
  /** HTTP status code from the agent's endpoint (null if not yet delivered). */
  response_status?: number;
  /** Number of delivery attempts so far. */
  attempts: number;
  /** Maximum retry attempts. */
  max_attempts: number;
  /** When to retry next (null if not retrying). */
  next_retry_at?: string;
  created_at: string;
  completed_at?: string;
}

// ──────────────────────────────────────────────
// Event Payload (what the agent receives)
// ──────────────────────────────────────────────

export interface WebhookEventPayload {
  /** Unique event ID for idempotency. */
  event_id: string;
  /** Event type. */
  event_type: WebhookEventType;
  /** ISO-8601 timestamp of when the event occurred. */
  timestamp: string;
  /** Platform version that emitted this event. */
  api_version: '2028-03-14';
  /** Event-specific data. */
  data: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

export interface SubscriptionCreateRequest {
  target_url: string;
  events: SubscriptionPattern[];
  /** Plain-text secret the agent will use to verify HMAC signatures. */
  secret: string;
  label?: string;
}

export interface SubscriptionCreateResponse {
  subscription_id: string;
  events: SubscriptionPattern[];
  target_url: string;
  is_active: boolean;
  created_at: string;
}

export interface SubscriptionListResponse {
  subscriptions: Array<{
    id: string;
    events: SubscriptionPattern[];
    target_url: string;
    is_active: boolean;
    label?: string;
    created_at: string;
  }>;
  count: number;
}
