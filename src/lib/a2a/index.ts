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
  taskFeedbackSchema,
  VALID_STATUS_TRANSITIONS,
  contextStoreSchema,
  contextQuerySchema,
} from './validation';
export type { ContextStoreInput, ContextQueryInput, TaskRouteInput, TaskFeedbackInput } from './validation';
export { executeIntent, isIntentSupported, listPlatformIntents, IntentNotFoundError } from './executor';
export {
  scoreCapabilityMatch,
  scoreRecency,
  scoreAgent,
  routeTask,
  fetchRoutingCandidates,
  fetchRoutingCandidatesWithReputation,
} from './router';
export type { TrustBlender } from './router';
export {
  submitTaskFeedback,
  getAgentReputation,
  getReputationScores,
  getReputationLeaderboard,
  blendTrustAndReputation,
  createReputationBlender,
} from './reputation';
export type { TaskFeedback, AgentReputation, SubmitFeedbackParams } from './reputation';
export {
  checkRateLimit,
  getAgentUsage,
  rateLimitHeaders,
  rateLimitBody,
  QUOTA_TIERS,
} from './rate-limiter';
export type {
  RateLimitAction,
  QuotaTier,
  RateLimitResult,
  AgentUsageSummary,
} from './rate-limiter';
export {
  createWorkflowDefinition,
  triggerWorkflow,
  advanceWorkflow,
  getWorkflowExecution,
  handleStepTaskCompletion,
  validateDAG,
  evaluateCondition,
  interpolateTemplate,
  computeProgress,
  getStepCategories,
  getWorkflowDefinition,
} from './workflow-engine';
export type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStatus,
  StepExecution,
  StepStatus,
  WorkflowStepDefinition,
  StepCondition,
  StepRetryPolicy,
  StepAgentTarget,
  CreateWorkflowRequest,
  TriggerWorkflowRequest,
  TriggerWorkflowResponse,
  WorkflowExecutionResponse,
} from './workflow-types';

// ── Channels (Agent-to-Agent Messaging) ──
export {
  channelCreateSchema,
  channelListSchema,
  channelAddMemberSchema,
  messageSendSchema,
  messageListSchema,
} from './channels';
export type {
  ChannelType,
  A2AChannel,
  MemberRole,
  ChannelMember,
  MessageType,
  VoteValue,
  ChannelMessage,
  ProposalTally,
  ChannelCreateRequest,
  ChannelCreateResponse,
  ChannelListResponse,
  ChannelAddMemberRequest,
  ChannelAddMemberResponse,
  MessageSendRequest,
  MessageSendResponse,
  MessageListResponse,
  ChannelCreateInput,
  ChannelListInput,
  ChannelAddMemberInput,
  MessageSendInput,
  MessageListInput,
} from './channels';
