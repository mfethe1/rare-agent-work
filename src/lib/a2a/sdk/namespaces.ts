/**
 * A2A Agent SDK — Namespaced API Methods
 *
 * Each namespace groups related operations into a fluent interface.
 * All methods delegate to the core client's request() method.
 */

import type { A2AResponse, A2ARequestOptions } from './client';
import type {
  AgentRegisterRequest,
  AgentRegisterResponse,
  RegisteredAgent,
  TaskSubmitRequest,
  TaskSubmitResponse,
  TaskUpdateRequest,
  TaskUpdateResponse,
  TaskStatusResponse,
  A2ATask,
  TaskRouteRequest,
  TaskRouteResponse,
  ContextStoreRequest,
  ContextStoreResponse,
  ContextQueryResponse,
} from '../types';
import type {
  ContractProposeRequest,
  ContractProposeResponse,
  ContractNegotiateRequest,
  ContractNegotiateResponse,
  ContractListResponse,
  ContractDetailResponse,
  ContractTerminateRequest,
} from '../contracts/types';
import type {
  EventSubscription,
  DeliveryMethod,
  EventDomain,
  DataFilter,
  ReplayResponse,
  StreamMetrics,
  SubscriptionHealth,
  DeadLetterEntry,
} from '../events/types';
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  NodeCreateRequest,
  NodeCreateResponse,
  NodeUpdateRequest,
  NodeUpdateResponse,
  NodeSearchResponse,
  EdgeCreateRequest,
  EdgeCreateResponse,
  EdgeListResponse,
  TraverseRequest,
  TraverseResponse,
  PathRequest,
  PathResponse,
  ContradictionsResponse,
  MergeRequest,
  MergeResponse,
  DecayResponse,
  TraversalStrategy,
  TraversalDirection,
} from '../knowledge/types';

/** The core request function signature shared by all namespaces. */
type Requester = <T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  options?: A2ARequestOptions,
) => Promise<A2AResponse<T>>;

// ──────────────────────────────────────────────
// Agents
// ──────────────────────────────────────────────

export interface AgentsNamespace {
  /** Register a new agent on the platform. */
  register(req: AgentRegisterRequest): Promise<A2AResponse<AgentRegisterResponse>>;
  /** Get agent details by ID. */
  get(agentId: string): Promise<A2AResponse<RegisteredAgent>>;
  /** List all registered agents (with optional search). */
  list(params?: { search?: string; capability?: string; trust_level?: string }): Promise<A2AResponse<{ agents: RegisteredAgent[]; count: number }>>;
  /** Send a heartbeat to indicate this agent is alive. */
  heartbeat(): Promise<A2AResponse<{ acknowledged: boolean }>>;
  /** Update the authenticated agent's public profile. */
  updateProfile(update: { name?: string; description?: string; callback_url?: string }): Promise<A2AResponse<{ updated_at: string }>>;
}

export function createAgentsNamespace(req: Requester, agentId: string): AgentsNamespace {
  return {
    register: (body) => req('POST', '/agents', body),
    get: (id) => req('GET', `/agents/${id}`),
    list: (params) => req('GET', '/agents', undefined, { params: params as Record<string, string> }),
    heartbeat: () => req('POST', '/agents/heartbeat', { agent_id: agentId }),
    updateProfile: (update) => req('PATCH', '/agents/profile', update),
  };
}

// ──────────────────────────────────────────────
// Tasks
// ──────────────────────────────────────────────

export interface TasksNamespace {
  /** Submit a task for execution. */
  submit(req: TaskSubmitRequest): Promise<A2AResponse<TaskSubmitResponse>>;
  /** Get current status of a task. */
  get(taskId: string): Promise<A2AResponse<TaskStatusResponse>>;
  /** Update task status (for assigned agents processing the task). */
  update(taskId: string, update: TaskUpdateRequest): Promise<A2AResponse<TaskUpdateResponse>>;
  /** Route a task to the best-matching agent by capability. */
  route(req: TaskRouteRequest): Promise<A2AResponse<TaskRouteResponse>>;
  /** Submit quality feedback for a completed task. */
  feedback(taskId: string, body: { rating: number; comment?: string }): Promise<A2AResponse<{ feedback_id: string }>>;
  /**
   * Poll a task until it reaches a terminal state (completed/failed/rejected).
   * Returns the final task. Throws if timeout is exceeded.
   */
  waitForCompletion(taskId: string, options?: { pollIntervalMs?: number; timeoutMs?: number }): Promise<A2ATask>;
}

export function createTasksNamespace(req: Requester, agentId: string): TasksNamespace {
  return {
    submit: (body) => req('POST', '/tasks', body),
    get: (taskId) => req('GET', `/tasks/${taskId}`),
    update: (taskId, body) => req('PATCH', `/tasks/${taskId}`, body),
    route: (body) => req('POST', '/tasks/route', body),
    feedback: (taskId, body) => req('POST', `/tasks/${taskId}/feedback`, body),

    async waitForCompletion(taskId, options) {
      const interval = options?.pollIntervalMs ?? 2000;
      const timeout = options?.timeoutMs ?? 120_000;
      const deadline = Date.now() + timeout;
      const terminalStates = new Set(['completed', 'failed', 'rejected']);

      while (Date.now() < deadline) {
        const { data } = await req<TaskStatusResponse>('GET', `/tasks/${taskId}`);
        if (terminalStates.has(data.task.status)) {
          return data.task;
        }
        await new Promise((r) => setTimeout(r, interval));
      }

      throw new Error(`Task ${taskId} did not complete within ${timeout}ms`);
    },
  };
}

// ──────────────────────────────────────────────
// Contracts
// ──────────────────────────────────────────────

export interface ContractsNamespace {
  /** Propose a new service contract to another agent. */
  propose(req: ContractProposeRequest): Promise<A2AResponse<ContractProposeResponse>>;
  /** Get full details of a contract including negotiations and violations. */
  get(contractId: string): Promise<A2AResponse<ContractDetailResponse>>;
  /** List all contracts for the authenticated agent. */
  list(params?: { status?: string }): Promise<A2AResponse<ContractListResponse>>;
  /** Submit a negotiation action (counter-propose, accept, reject). */
  negotiate(contractId: string, req: ContractNegotiateRequest): Promise<A2AResponse<ContractNegotiateResponse>>;
  /** Terminate a contract early. */
  terminate(contractId: string, reason: string): Promise<A2AResponse<{ terminated_at: string }>>;
}

export function createContractsNamespace(req: Requester, _agentId: string): ContractsNamespace {
  return {
    propose: (body) => req('POST', '/contracts', body),
    get: (contractId) => req('GET', `/contracts/${contractId}`),
    list: (params) => req('GET', '/contracts', undefined, { params: params as Record<string, string> }),
    negotiate: (contractId, body) => req('POST', `/contracts/${contractId}/negotiate`, body),
    terminate: (contractId, reason) => req('POST', `/contracts/${contractId}/terminate`, { reason } satisfies ContractTerminateRequest),
  };
}

// ──────────────────────────────────────────────
// Events
// ──────────────────────────────────────────────

export interface EventSubscribeOptions {
  /** Human-readable subscription name. */
  name: string;
  /** Event topics with wildcard support (e.g., "task.*", "*.completed"). */
  topics: string[];
  /** Delivery method (default: 'webhook'). */
  deliveryMethod?: DeliveryMethod;
  /** Webhook URL (required for webhook delivery). */
  webhookUrl?: string;
  /** Webhook secret for HMAC signature verification. */
  webhookSecret?: string;
  /** Filter by source agent IDs. */
  sourceAgentIds?: string[];
  /** Filter by domains. */
  domains?: EventDomain[];
  /** JSONPath-like data filters. */
  dataFilters?: DataFilter[];
  /** Enable dead-letter queue (default: true). */
  deadLetterEnabled?: boolean;
}

export interface EventsNamespace {
  /** Create an event subscription. */
  subscribe(options: EventSubscribeOptions): Promise<A2AResponse<EventSubscription>>;
  /** List active subscriptions. */
  list(): Promise<A2AResponse<{ subscriptions: EventSubscription[]; count: number }>>;
  /** Pause a subscription. */
  pause(subscriptionId: string): Promise<A2AResponse<{ status: string }>>;
  /** Resume a paused subscription. */
  resume(subscriptionId: string): Promise<A2AResponse<{ status: string }>>;
  /** Cancel a subscription permanently. */
  cancel(subscriptionId: string): Promise<A2AResponse<{ status: string }>>;
  /** Get subscription health metrics. */
  health(subscriptionId: string): Promise<A2AResponse<SubscriptionHealth>>;
  /** Replay events from a sequence number. */
  replay(subscriptionId: string, fromSequence: number, limit?: number): Promise<A2AResponse<ReplayResponse>>;
  /** Get dead-letter entries for a subscription. */
  deadLetters(subscriptionId: string): Promise<A2AResponse<{ entries: DeadLetterEntry[]; count: number }>>;
  /** Replay a dead-letter entry. */
  replayDeadLetter(entryId: string): Promise<A2AResponse<{ replayed: boolean }>>;
  /** Emit a custom event. */
  emit(topic: string, data: Record<string, unknown>, resourceId?: string): Promise<A2AResponse<{ event_id: string }>>;
  /** Get event stream metrics. */
  metrics(): Promise<A2AResponse<StreamMetrics>>;
}

export function createEventsNamespace(req: Requester, _agentId: string): EventsNamespace {
  return {
    subscribe: (options) =>
      req('POST', '/events/subscribe', {
        name: options.name,
        delivery: {
          method: options.deliveryMethod ?? 'webhook',
          webhook_url: options.webhookUrl,
          webhook_secret: options.webhookSecret,
          timeout_ms: 10_000,
          batch_size: 1,
          batch_window_ms: 0,
        },
        filter: {
          topics: options.topics,
          source_agent_ids: options.sourceAgentIds,
          domains: options.domains,
          data_filters: options.dataFilters,
        },
        options: {
          max_events_per_second: 100,
          include_data: true,
          max_consecutive_failures: 10,
          dead_letter_enabled: options.deadLetterEnabled ?? true,
        },
      }),
    list: () => req('GET', '/events/subscribe'),
    pause: (id) => req('PATCH', `/events/subscribe/${id}`, { status: 'paused' }),
    resume: (id) => req('PATCH', `/events/subscribe/${id}`, { status: 'active' }),
    cancel: (id) => req('PATCH', `/events/subscribe/${id}`, { status: 'cancelled' }),
    health: (id) => req('GET', `/events/subscribe/${id}/health`),
    replay: (id, fromSequence, limit = 100) =>
      req('POST', '/events/replay', {
        subscription_id: id,
        from_sequence: fromSequence,
        limit,
      }),
    deadLetters: (id) => req('GET', `/events/dead-letters`, undefined, { params: { subscription_id: id } }),
    replayDeadLetter: (entryId) => req('POST', `/events/dead-letters/${entryId}/replay`),
    emit: (topic, data, resourceId) =>
      req('POST', '/events/emit', {
        topic,
        data,
        resource_id: resourceId ?? 'custom',
        resource_type: 'custom',
      }),
    metrics: () => req('GET', '/events/metrics'),
  };
}

// ──────────────────────────────────────────────
// Knowledge Graph
// ──────────────────────────────────────────────

export interface KnowledgeNamespace {
  // Nodes
  /** Create a knowledge node. */
  createNode(req: NodeCreateRequest): Promise<A2AResponse<NodeCreateResponse>>;
  /** Update a knowledge node. */
  updateNode(nodeId: string, req: NodeUpdateRequest): Promise<A2AResponse<NodeUpdateResponse>>;
  /** Search nodes by namespace, type, tags, or text. */
  searchNodes(params?: {
    namespace?: string;
    node_type?: KnowledgeNodeType;
    tag?: string;
    search?: string;
    min_confidence?: number;
  }): Promise<A2AResponse<NodeSearchResponse>>;

  // Edges
  /** Create a relationship between two nodes. */
  createEdge(req: EdgeCreateRequest): Promise<A2AResponse<EdgeCreateResponse>>;
  /** List edges for a node. */
  listEdges(params?: {
    node_id?: string;
    relationship?: KnowledgeEdgeType;
  }): Promise<A2AResponse<EdgeListResponse>>;

  // Traversal
  /** Traverse the graph from a starting node. */
  traverse(req: TraverseRequest): Promise<A2AResponse<TraverseResponse>>;
  /** Find a path between two nodes. */
  findPath(req: PathRequest): Promise<A2AResponse<PathResponse>>;

  // Analysis
  /** Get detected contradictions in the knowledge graph. */
  contradictions(namespace?: string): Promise<A2AResponse<ContradictionsResponse>>;
  /** Merge two duplicate nodes. */
  merge(req: MergeRequest): Promise<A2AResponse<MergeResponse>>;

  // Maintenance
  /** Trigger confidence decay on stale knowledge. */
  decay(): Promise<A2AResponse<DecayResponse>>;
  /** Reinforce a node (bump confidence and access count). */
  reinforce(nodeId: string): Promise<A2AResponse<{ node_id: string; confidence: number }>>;
}

export function createKnowledgeNamespace(req: Requester, _agentId: string): KnowledgeNamespace {
  return {
    createNode: (body) => req('POST', '/knowledge/nodes', body),
    updateNode: (nodeId, body) => req('PATCH', `/knowledge/nodes/${nodeId}`, body),
    searchNodes: (params) => req('GET', '/knowledge/nodes', undefined, { params: params as Record<string, string> }),
    createEdge: (body) => req('POST', '/knowledge/edges', body),
    listEdges: (params) => req('GET', '/knowledge/edges', undefined, { params: params as Record<string, string> }),
    traverse: (body) => req('POST', '/knowledge/traverse', body),
    findPath: (body) => req('POST', '/knowledge/path', body),
    contradictions: (namespace) => req('GET', '/knowledge/contradictions', undefined, { params: { namespace } }),
    merge: (body) => req('POST', '/knowledge/merge', body),
    decay: () => req('POST', '/knowledge/decay'),
    reinforce: (nodeId) => req('POST', `/knowledge/reinforce`, { node_id: nodeId }),
  };
}

// ──────────────────────────────────────────────
// Context Store
// ──────────────────────────────────────────────

export interface ContextNamespace {
  /** Store a context entry. */
  store(req: ContextStoreRequest): Promise<A2AResponse<ContextStoreResponse>>;
  /** Query context entries. */
  query(params?: {
    namespace?: string;
    key?: string;
    correlation_id?: string;
    task_id?: string;
  }): Promise<A2AResponse<ContextQueryResponse>>;
}

export function createContextNamespace(req: Requester, _agentId: string): ContextNamespace {
  return {
    store: (body) => req('POST', '/context', body),
    query: (params) => req('GET', '/context', undefined, { params: params as Record<string, string> }),
  };
}

// ──────────────────────────────────────────────
// Billing
// ──────────────────────────────────────────────

export interface BillingNamespace {
  /** Get current wallet balance and account info. */
  wallet(): Promise<A2AResponse<{ agent_id: string; balance: number; currency: string; frozen: boolean }>>;
  /** Deposit funds into the agent's wallet. */
  deposit(amount: number, reference?: string): Promise<A2AResponse<{ transaction_id: string; new_balance: number }>>;
  /** Get transaction history. */
  transactions(params?: { limit?: number; offset?: number }): Promise<A2AResponse<{ transactions: unknown[]; count: number }>>;
  /** Get a cost estimate for a task. */
  estimate(intent: string, input: Record<string, unknown>): Promise<A2AResponse<{ estimated_cost: number; currency: string }>>;
}

export function createBillingNamespace(req: Requester, _agentId: string): BillingNamespace {
  return {
    wallet: () => req('GET', '/billing/wallet'),
    deposit: (amount, reference) => req('POST', '/billing/deposit', { amount, reference }),
    transactions: (params) =>
      req('GET', '/billing/transactions', undefined, {
        params: params as Record<string, string | number>,
      }),
    estimate: (intent, input) => req('POST', '/billing/estimate', { intent, input }),
  };
}
