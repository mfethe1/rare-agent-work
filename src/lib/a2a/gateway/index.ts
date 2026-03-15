/**
 * A2A Gateway — Public API
 *
 * The unified entry point that makes the 178-endpoint platform agent-native.
 */

export type {
  BatchMethod,
  BatchStep,
  BatchRequest,
  BatchStepResult,
  BatchStatus,
  BatchResponse,
  StreamEventType,
  StreamEvent,
  StreamSubscription,
  EndpointDescriptor,
  DomainDescriptor,
  IntrospectionResponse,
  IntrospectionQuery,
} from './types';

export {
  GATEWAY_VERSION,
  MAX_BATCH_STEPS,
  MAX_BATCH_TIMEOUT_MS,
  DEFAULT_STEP_TIMEOUT_MS,
  DEFAULT_BATCH_TIMEOUT_MS,
  MAX_STREAM_CONNECTIONS_PER_AGENT,
  ALL_STREAM_EVENT_TYPES,
  resolvePath,
  interpolateString,
  interpolateValue,
  extractTemplateDeps,
  resolveDependencies,
  executeBatch,
  formatSSE,
  createConnectedEvent,
  createPingEvent,
  buildIntrospection,
  BatchCycleError,
} from './engine';
export type { InternalDispatcher } from './engine';

export {
  batchStepSchema,
  batchRequestSchema,
  streamSubscriptionSchema,
  streamEventTypes,
  introspectionQuerySchema,
} from './validation';
export type {
  BatchStepInput,
  BatchRequestInput,
  StreamSubscriptionInput,
  IntrospectionQueryInput,
} from './validation';
