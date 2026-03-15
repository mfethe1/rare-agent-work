/**
 * A2A Event Streaming & Webhook System
 *
 * Real-time event backbone for the agent ecosystem. Turns the A2A platform
 * from a request-response system into a fully reactive, event-driven
 * architecture where agents subscribe to streams and react in real-time.
 *
 * Subsystems:
 *   - Event emission & persistence (immutable, ordered event store)
 *   - Subscription management (topic-based with wildcard filters)
 *   - Webhook delivery with HMAC-SHA256 signatures & exponential backoff
 *   - SSE/WebSocket push for persistent connections
 *   - Dead-letter queue for failed deliveries
 *   - Event replay for catch-up after disconnection
 *   - Stream metrics & subscription health monitoring
 *   - Self-documenting event catalog
 */

// Types
export type {
  A2AEvent,
  AuctionEventAction,
  AgentEventAction,
  BillingEventAction,
  ChannelEventAction,
  ContractEventAction,
  DataFilter,
  DeadLetterEntry,
  DeliveryAttempt,
  DeliveryConfig,
  DeliveryMethod,
  DeliveryStatus,
  DelegationEventAction,
  EventAction,
  EventCatalogEntry,
  EventDomain,
  EventFilter,
  EventSubscription,
  EventTopic,
  EventTraceContext,
  FederationEventAction,
  GovernanceEventAction,
  IdentityEventAction,
  KnowledgeEventAction,
  MeshEventAction,
  ObservabilityEventAction,
  ReplayRequest,
  ReplayResponse,
  RetryPolicy,
  SSEConnection,
  StreamMetrics,
  SubscriptionHealth,
  SubscriptionOptions,
  SubscriptionStatus,
  TaskEventAction,
  WebhookSignature,
  WorkflowEventAction,
} from './types';

export { DEFAULT_RETRY_POLICY, VALID_SUBSCRIPTION_TRANSITIONS } from './types';

// Engine
export {
  emitEvent,
  emitBatch,
  createSubscription,
  updateSubscriptionStatus,
  listSubscriptions,
  getSubscription,
  topicMatchesPattern,
  evaluateDataFilter,
  eventMatchesFilter,
  computeWebhookSignature,
  verifyWebhookSignature,
  computeRetryDelay,
  replayDeadLetter,
  listDeadLetters,
  replayEvents,
  registerSSEConnection,
  disconnectSSE,
  pollSSEQueue,
  getStreamMetrics,
  getSubscriptionHealth,
  getEventCatalog,
} from './engine';

export type {
  EmitEventParams,
  CreateSubscriptionParams,
} from './engine';

// Validation
export {
  validateEmitEventParams,
  validateCreateSubscription,
  validateStatusTransition,
  validateReplayRequest,
  validateDeadLetterId,
} from './validation';

export type { ValidationResult } from './validation';
