export type {
  RegisteredAgent,
  AgentCapability,
  AgentTrustLevel,
  A2ATask,
  TaskIntent,
  TaskStatus,
  TaskPriority,
  TaskError,
  AgentRegisterRequest,
  AgentRegisterResponse,
  TaskSubmitRequest,
  TaskSubmitResponse,
  TaskUpdateRequest,
  TaskUpdateResponse,
  TaskStatusResponse,
  CapabilitiesResponse,
  PlatformIntent,
  AgentContext,
  ContextStoreRequest,
  ContextStoreResponse,
  ContextQueryResponse,
  RoutingPolicy,
  AgentScore,
  RoutingCandidate,
  RoutingResult,
  TaskRouteRequest,
  TaskRouteResponse,
} from './types';

export { authenticateAgent, generateAgentApiKey, getServiceDb } from './auth';
export {
  agentRegisterSchema,
  taskSubmitSchema,
  taskUpdateSchema,
  taskRouteSchema,
  VALID_STATUS_TRANSITIONS,
  contextStoreSchema,
  contextQuerySchema,
} from './validation';
export type { ContextStoreInput, ContextQueryInput, TaskRouteInput } from './validation';
export { executeIntent, isIntentSupported, listPlatformIntents, IntentNotFoundError } from './executor';
export {
  scoreCapabilityMatch,
  scoreRecency,
  scoreAgent,
  routeTask,
  fetchRoutingCandidates,
} from './router';
