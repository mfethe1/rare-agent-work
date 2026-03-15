/**
 * A2A Gateway Engine
 *
 * Core implementation for batch execution, SSE streaming, and protocol
 * introspection. This is the "front door" that makes the 178-endpoint
 * platform truly agent-native.
 *
 * Batch execution supports:
 * - Dependency resolution via `depends_on` and template references
 * - Template interpolation: `{{stepId.field.nested}}` in paths, bodies, params
 * - Parallel execution of independent steps
 * - Per-step and global timeouts
 * - Partial success reporting (optional steps can fail without aborting)
 *
 * Introspection provides a machine-readable catalog of every A2A domain
 * and endpoint, with schemas, examples, and metadata — enabling agents
 * to self-configure their platform interactions at runtime.
 */

import type {
  BatchRequest,
  BatchResponse,
  BatchStep,
  BatchStepResult,
  BatchStatus,
  EndpointDescriptor,
  DomainDescriptor,
  IntrospectionResponse,
  IntrospectionQuery,
  StreamEvent,
  StreamEventType,
} from './types';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export const GATEWAY_VERSION = '1.0.0';
export const MAX_BATCH_STEPS = 20;
export const MAX_BATCH_TIMEOUT_MS = 120_000;
export const DEFAULT_STEP_TIMEOUT_MS = 10_000;
export const DEFAULT_BATCH_TIMEOUT_MS = 30_000;
export const MAX_STREAM_CONNECTIONS_PER_AGENT = 3;

// ──────────────────────────────────────────────
// Template Interpolation
// ──────────────────────────────────────────────

const TEMPLATE_RE = /\{\{([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.[\]]+)\}\}/g;

/**
 * Resolve a dotted path on an object.
 * Supports `data.items[0].name` style paths.
 */
export function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Interpolate `{{stepId.path}}` templates in a string value.
 * Returns the resolved value. If the entire string is a single template
 * and resolves to a non-string, returns the raw value (preserving types).
 */
export function interpolateString(
  value: string,
  stepResults: Map<string, BatchStepResult>,
): unknown {
  // Check if the entire string is a single template reference
  const singleMatch = value.match(/^\{\{([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.[\]]+)\}\}$/);
  if (singleMatch) {
    const [, stepId, path] = singleMatch;
    const result = stepResults.get(stepId);
    if (!result || result.status >= 400) return value;
    return resolvePath(result, path) ?? value;
  }

  // Multiple templates or mixed content — always returns string
  return value.replace(TEMPLATE_RE, (match, stepId: string, path: string) => {
    const result = stepResults.get(stepId);
    if (!result || result.status >= 400) return match;
    const resolved = resolvePath(result, path);
    return resolved !== undefined ? String(resolved) : match;
  });
}

/**
 * Recursively interpolate templates in an object/array/string.
 */
export function interpolateValue(
  value: unknown,
  stepResults: Map<string, BatchStepResult>,
): unknown {
  if (typeof value === 'string') {
    return interpolateString(value, stepResults);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, stepResults));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = interpolateValue(val, stepResults);
    }
    return result;
  }
  return value;
}

// ──────────────────────────────────────────────
// Dependency Resolution
// ──────────────────────────────────────────────

/**
 * Extract implicit dependencies from template references in a step.
 */
export function extractTemplateDeps(step: BatchStep): Set<string> {
  const deps = new Set<string>();
  const scan = (val: unknown): void => {
    if (typeof val === 'string') {
      let match: RegExpExecArray | null;
      const re = new RegExp(TEMPLATE_RE.source, 'g');
      while ((match = re.exec(val)) !== null) {
        deps.add(match[1]);
      }
    } else if (Array.isArray(val)) {
      val.forEach(scan);
    } else if (val !== null && typeof val === 'object') {
      Object.values(val as Record<string, unknown>).forEach(scan);
    }
  };

  scan(step.path);
  scan(step.body);
  scan(step.params);
  return deps;
}

/**
 * Resolve all dependencies (explicit + implicit) for each step.
 * Returns a map of stepId → Set<dependencyStepId>.
 * Throws if a cycle is detected.
 */
export function resolveDependencies(
  steps: BatchStep[],
): Map<string, Set<string>> {
  const stepIds = new Set(steps.map((s) => s.id));
  const deps = new Map<string, Set<string>>();

  for (const step of steps) {
    const explicit = new Set(step.depends_on?.filter((d) => stepIds.has(d)) ?? []);
    const implicit = extractTemplateDeps(step);

    // Merge: only include deps that reference valid step IDs
    const merged = new Set<string>();
    for (const d of explicit) merged.add(d);
    for (const d of implicit) {
      if (stepIds.has(d) && d !== step.id) merged.add(d);
    }
    deps.set(step.id, merged);
  }

  // Cycle detection via topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  for (const id of stepIds) inDegree.set(id, 0);
  for (const [, stepDeps] of deps) {
    for (const dep of stepDeps) {
      // dep must complete before the step that depends on it
      // So in-degree is on the dependent step, not the dependency
    }
  }
  // Recompute: for each step, count how many steps depend on completing first
  for (const [stepId, stepDeps] of deps) {
    inDegree.set(stepId, stepDeps.size);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    // Find steps that depend on `current` and decrement their in-degree
    for (const [stepId, stepDeps] of deps) {
      if (stepDeps.has(current)) {
        const newDegree = (inDegree.get(stepId) ?? 1) - 1;
        inDegree.set(stepId, newDegree);
        if (newDegree === 0) queue.push(stepId);
      }
    }
  }

  if (sorted.length !== stepIds.size) {
    const remaining = [...stepIds].filter((id) => !sorted.includes(id));
    throw new BatchCycleError(remaining);
  }

  return deps;
}

// ──────────────────────────────────────────────
// Batch Execution
// ──────────────────────────────────────────────

/**
 * Internal route dispatcher type.
 * The gateway calls platform routes internally without HTTP overhead.
 */
export type InternalDispatcher = (
  method: string,
  path: string,
  body: unknown,
  params: Record<string, string>,
  headers: Record<string, string>,
) => Promise<{ status: number; data: unknown }>;

/**
 * Execute a batch of API calls with dependency resolution and template interpolation.
 */
export async function executeBatch(
  request: BatchRequest,
  dispatch: InternalDispatcher,
  headers: Record<string, string>,
): Promise<BatchResponse> {
  const correlationId = request.correlation_id ?? crypto.randomUUID();
  const strategy = request.strategy ?? 'parallel';
  const globalTimeout = request.timeout_ms ?? DEFAULT_BATCH_TIMEOUT_MS;
  const startTime = Date.now();

  // Resolve dependency graph
  const deps = resolveDependencies(request.steps);
  const stepMap = new Map(request.steps.map((s) => [s.id, s]));
  const stepResults = new Map<string, BatchStepResult>();
  const completed = new Set<string>();
  let aborted = false;

  /** Execute a single step with interpolation and timeout. */
  const executeStep = async (step: BatchStep): Promise<BatchStepResult> => {
    const stepStart = Date.now();
    const timeout = step.timeout_ms ?? DEFAULT_STEP_TIMEOUT_MS;

    try {
      // Interpolate templates from prior step results
      const resolvedPath = interpolateString(step.path, stepResults) as string;
      const resolvedBody = step.body
        ? interpolateValue(step.body, stepResults)
        : undefined;
      const resolvedParams = step.params
        ? Object.fromEntries(
            Object.entries(step.params).map(([k, v]) => [
              k,
              String(interpolateString(v, stepResults)),
            ]),
          )
        : {};

      // Execute with timeout
      const result = await Promise.race([
        dispatch(step.method, resolvedPath, resolvedBody, resolvedParams as Record<string, string>, headers),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Step "${step.id}" timed out after ${timeout}ms`)), timeout),
        ),
      ]);

      return {
        id: step.id,
        status: result.status,
        data: result.data,
        duration_ms: Date.now() - stepStart,
        ...(result.status >= 400 ? { error: extractError(result.data) } : {}),
      };
    } catch (err) {
      return {
        id: step.id,
        status: 500,
        data: null,
        duration_ms: Date.now() - stepStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  /** Check if all dependencies for a step are satisfied. */
  const depsReady = (stepId: string): boolean => {
    const stepDeps = deps.get(stepId) ?? new Set();
    for (const dep of stepDeps) {
      if (!completed.has(dep)) return false;
      // Check if non-optional dependency failed
      const depResult = stepResults.get(dep);
      const depStep = stepMap.get(dep);
      if (depResult && depResult.status >= 400 && !depStep?.optional) {
        aborted = true;
        return false;
      }
    }
    return true;
  };

  if (strategy === 'sequential') {
    // Topological order: steps whose deps are all satisfied run next
    const pending = new Set(request.steps.map((s) => s.id));

    while (pending.size > 0 && !aborted) {
      if (Date.now() - startTime > globalTimeout) {
        aborted = true;
        break;
      }

      // Find next runnable step
      let ran = false;
      for (const stepId of pending) {
        if (depsReady(stepId)) {
          const step = stepMap.get(stepId)!;
          const result = await executeStep(step);
          stepResults.set(stepId, result);
          completed.add(stepId);
          pending.delete(stepId);
          ran = true;

          if (result.status >= 400 && !step.optional) {
            aborted = true;
          }
          break; // Re-evaluate from top after each execution
        }
      }

      if (!ran) {
        // No step could run — remaining steps have unsatisfied deps
        break;
      }
    }
  } else {
    // Parallel strategy: launch steps as soon as deps are met
    const pending = new Set(request.steps.map((s) => s.id));
    const inFlight = new Map<string, Promise<void>>();

    const launchReady = (): void => {
      for (const stepId of pending) {
        if (aborted) break;
        if (inFlight.has(stepId)) continue;
        if (!depsReady(stepId)) continue;

        const step = stepMap.get(stepId)!;
        const promise = executeStep(step).then((result) => {
          stepResults.set(stepId, result);
          completed.add(stepId);
          pending.delete(stepId);
          inFlight.delete(stepId);

          if (result.status >= 400 && !step.optional) {
            aborted = true;
          }
        });
        inFlight.set(stepId, promise);
      }
    };

    while ((pending.size > 0 || inFlight.size > 0) && !aborted) {
      if (Date.now() - startTime > globalTimeout) {
        aborted = true;
        break;
      }

      launchReady();

      if (inFlight.size === 0 && pending.size > 0) {
        // Deadlock: remaining steps have unsatisfied deps
        break;
      }

      if (inFlight.size > 0) {
        await Promise.race(inFlight.values());
      }
    }

    // Wait for any remaining in-flight to settle
    if (inFlight.size > 0) {
      await Promise.allSettled(inFlight.values());
    }
  }

  // Build results in original step order
  const results: BatchStepResult[] = request.steps.map((step) => {
    const result = stepResults.get(step.id);
    if (result) return result;
    return {
      id: step.id,
      status: 0,
      data: null,
      duration_ms: 0,
      error: aborted ? 'Skipped: batch aborted due to prior failure' : 'Skipped: dependencies not satisfied',
    };
  });

  const succeeded = results.filter((r) => r.status > 0 && r.status < 400).length;
  const failed = results.filter((r) => r.status >= 400 || r.status === 0).length;

  let status: BatchStatus = 'completed';
  if (failed === results.length) status = 'failed';
  else if (failed > 0) status = 'partial';

  return {
    status,
    correlation_id: correlationId,
    results,
    total_duration_ms: Date.now() - startTime,
    succeeded,
    failed,
  };
}

// ──────────────────────────────────────────────
// SSE Stream Helpers
// ──────────────────────────────────────────────

/**
 * Format a StreamEvent as an SSE text chunk.
 */
export function formatSSE(event: StreamEvent): string {
  const lines: string[] = [];
  lines.push(`event: ${event.type}`);
  lines.push(`data: ${JSON.stringify(event)}`);
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

/**
 * Create a connected event for initial SSE handshake.
 */
export function createConnectedEvent(agentId: string): StreamEvent {
  return {
    type: 'connected',
    data: {
      agent_id: agentId,
      message: 'SSE stream established. You will receive real-time events based on your subscription filters.',
      supported_events: ALL_STREAM_EVENT_TYPES,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a ping event for keepalive.
 */
export function createPingEvent(): StreamEvent {
  return {
    type: 'ping',
    data: { keepalive: true },
    timestamp: new Date().toISOString(),
  };
}

export const ALL_STREAM_EVENT_TYPES: StreamEventType[] = [
  'connected',
  'task.progress',
  'task.completed',
  'task.failed',
  'agent.heartbeat',
  'workflow.step_completed',
  'workflow.completed',
  'platform.event',
  'ping',
  'error',
];

// ──────────────────────────────────────────────
// Protocol Introspection
// ──────────────────────────────────────────────

/**
 * Build the full introspection response.
 * This is the machine-readable API catalog that agents use to self-configure.
 */
export function buildIntrospection(query?: IntrospectionQuery): IntrospectionResponse {
  const allEndpoints = getAllEndpoints();
  const allDomains = getAllDomains(allEndpoints);

  let filtered = allEndpoints;

  if (query?.domain) {
    filtered = filtered.filter((e) => e.domain === query.domain);
  }
  if (query?.tag) {
    filtered = filtered.filter((e) => e.tags.includes(query.tag!));
  }
  if (query?.method) {
    filtered = filtered.filter((e) => e.method === query.method);
  }
  if (query?.requires_auth !== undefined) {
    filtered = filtered.filter((e) => e.requires_auth === query.requires_auth);
  }
  if (query?.search) {
    const terms = query.search.toLowerCase().split(/\s+/);
    filtered = filtered.filter((e) => {
      const text = `${e.id} ${e.description} ${e.tags.join(' ')}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }

  // Strip schemas if not requested
  if (!query?.include_schemas) {
    filtered = filtered.map((e) => ({
      ...e,
      request_schema: undefined,
      response_schema: undefined,
      example_request: undefined,
    }));
  }

  return {
    protocol: 'rareagent-a2a',
    version: GATEWAY_VERSION,
    description:
      'Machine-readable A2A protocol catalog. Agents can query this endpoint to discover all available domains, endpoints, and schemas — then compose batch operations or subscribe to event streams via the gateway.',
    total_endpoints: allEndpoints.length,
    domains: query?.domain
      ? allDomains.filter((d) => d.id === query.domain)
      : allDomains,
    endpoints: filtered,
    gateway: {
      batch: {
        max_steps: MAX_BATCH_STEPS,
        max_timeout_ms: MAX_BATCH_TIMEOUT_MS,
        strategies: ['sequential', 'parallel'],
      },
      streaming: {
        event_types: ALL_STREAM_EVENT_TYPES,
        max_connections_per_agent: MAX_STREAM_CONNECTIONS_PER_AGENT,
      },
      introspection: {
        filterable_by: ['domain', 'tag', 'method', 'requires_auth', 'search'],
      },
    },
    generated_at: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// Endpoint Registry
// ──────────────────────────────────────────────

/**
 * Returns the complete, authoritative list of all A2A endpoints.
 * This is the single source of truth for the protocol introspection API.
 */
function getAllEndpoints(): EndpointDescriptor[] {
  return [
    // ── Core ──
    { id: 'agents.register', description: 'Register a new agent and receive an API key', method: 'POST', path: '/agents', domain: 'agents', requires_auth: false, tags: ['onboarding', 'registration'], example_request: { name: 'my-agent', description: 'A research agent', capabilities: [{ id: 'news.query' }] } },
    { id: 'agents.search', description: 'Search registered agents by capability, trust level, or free-text', method: 'GET', path: '/agents', domain: 'agents', requires_auth: true, tags: ['discovery', 'search'] },
    { id: 'agents.profile', description: 'Get an agent profile with reputation and availability', method: 'GET', path: '/agents/:id', domain: 'agents', requires_auth: true, tags: ['discovery', 'profile'] },
    { id: 'agents.my_profile', description: 'Get the authenticated agent\'s own profile', method: 'GET', path: '/agents/profile', domain: 'agents', requires_auth: true, tags: ['profile'] },
    { id: 'agents.update_profile', description: 'Update the authenticated agent\'s description, callback URL, or capabilities', method: 'PATCH', path: '/agents/profile', domain: 'agents', requires_auth: true, tags: ['profile', 'update'] },
    { id: 'agents.heartbeat', description: 'Report liveness and current load (recommended: every 60s)', method: 'POST', path: '/agents/heartbeat', domain: 'agents', requires_auth: true, tags: ['health', 'liveness'] },

    // ── Tasks ──
    { id: 'tasks.submit', description: 'Submit a typed task with a specific intent', method: 'POST', path: '/tasks', domain: 'tasks', requires_auth: true, tags: ['submission', 'workflow'], example_request: { intent: 'news.query', input: { tag: 'security', limit: 10 } } },
    { id: 'tasks.status', description: 'Get task status and result by ID', method: 'GET', path: '/tasks/:id', domain: 'tasks', requires_auth: true, tags: ['polling', 'status'] },
    { id: 'tasks.update', description: 'Update task status and report results (for assigned agents)', method: 'PATCH', path: '/tasks/:id', domain: 'tasks', requires_auth: true, tags: ['callback', 'update'] },

    // ── Capabilities ──
    { id: 'capabilities.list', description: 'List all supported task intents with input schemas', method: 'GET', path: '/capabilities', domain: 'capabilities', requires_auth: false, tags: ['discovery', 'schema'] },

    // ── Webhooks ──
    { id: 'webhooks.create', description: 'Subscribe to platform events with HMAC-signed callbacks', method: 'POST', path: '/subscriptions', domain: 'webhooks', requires_auth: true, tags: ['events', 'push'] },
    { id: 'webhooks.list', description: 'List active webhook subscriptions', method: 'GET', path: '/subscriptions', domain: 'webhooks', requires_auth: true, tags: ['events'] },
    { id: 'webhooks.delete', description: 'Delete a webhook subscription', method: 'DELETE', path: '/subscriptions', domain: 'webhooks', requires_auth: true, tags: ['events'] },

    // ── Context ──
    { id: 'context.store', description: 'Persist shared context (knowledge, findings, decisions)', method: 'POST', path: '/context', domain: 'context', requires_auth: true, tags: ['knowledge', 'collaboration'] },
    { id: 'context.query', description: 'Query shared agent context with filters', method: 'GET', path: '/context', domain: 'context', requires_auth: true, tags: ['knowledge', 'query'] },
    { id: 'context.delete', description: 'Delete a context entry', method: 'DELETE', path: '/context', domain: 'context', requires_auth: true, tags: ['knowledge'] },

    // ── Workflows ──
    { id: 'workflows.create', description: 'Create a DAG-based workflow definition with steps and dependencies', method: 'POST', path: '/workflows', domain: 'workflows', requires_auth: true, tags: ['orchestration', 'dag'] },
    { id: 'workflows.list', description: 'List workflow definitions', method: 'GET', path: '/workflows', domain: 'workflows', requires_auth: true, tags: ['orchestration'] },
    { id: 'workflows.trigger', description: 'Trigger a workflow execution with input parameters', method: 'POST', path: '/workflows/:id/trigger', domain: 'workflows', requires_auth: true, tags: ['orchestration', 'execution'] },
    { id: 'workflows.execution', description: 'Get workflow execution status and step results', method: 'GET', path: '/workflows/:id/executions/:execId', domain: 'workflows', requires_auth: true, tags: ['orchestration', 'status'] },
    { id: 'workflows.executions', description: 'List executions for a workflow', method: 'GET', path: '/workflows/:id/executions', domain: 'workflows', requires_auth: true, tags: ['orchestration'] },

    // ── Billing ──
    { id: 'billing.wallet', description: 'Get or create the agent\'s credit wallet', method: 'GET', path: '/billing/wallet', domain: 'billing', requires_auth: true, tags: ['economy', 'wallet'] },
    { id: 'billing.deposit', description: 'Deposit credits into the agent\'s wallet', method: 'POST', path: '/billing/deposit', domain: 'billing', requires_auth: true, tags: ['economy', 'deposit'] },
    { id: 'billing.settle', description: 'Settle a completed task (debit consumer, credit provider)', method: 'POST', path: '/billing/settle', domain: 'billing', requires_auth: true, tags: ['economy', 'settlement'] },
    { id: 'billing.estimate', description: 'Estimate cost of next task under a contract', method: 'POST', path: '/billing/estimate', domain: 'billing', requires_auth: true, tags: ['economy', 'cost'] },
    { id: 'billing.transactions', description: 'List ledger transactions with filtering', method: 'GET', path: '/billing/transactions', domain: 'billing', requires_auth: true, tags: ['economy', 'ledger'] },
    { id: 'billing.spend', description: 'Get spending summary with governance limit status', method: 'GET', path: '/billing/spend', domain: 'billing', requires_auth: true, tags: ['economy', 'governance'] },

    // ── Contracts ──
    { id: 'contracts.propose', description: 'Propose a service contract with SLA terms and pricing', method: 'POST', path: '/contracts', domain: 'contracts', requires_auth: true, tags: ['agreement', 'sla'] },
    { id: 'contracts.negotiate', description: 'Counter-offer or accept a contract proposal', method: 'POST', path: '/contracts/:id/negotiate', domain: 'contracts', requires_auth: true, tags: ['agreement', 'negotiation'] },
    { id: 'contracts.list', description: 'List contracts with filtering by status, role, and counterparty', method: 'GET', path: '/contracts', domain: 'contracts', requires_auth: true, tags: ['agreement'] },
    { id: 'contracts.detail', description: 'Get full contract detail with compliance status', method: 'GET', path: '/contracts/:id', domain: 'contracts', requires_auth: true, tags: ['agreement', 'compliance'] },
    { id: 'contracts.terminate', description: 'Terminate an active contract', method: 'POST', path: '/contracts/:id/terminate', domain: 'contracts', requires_auth: true, tags: ['agreement'] },

    // ── Delegations ──
    { id: 'delegations.create', description: 'Grant scoped, time-bounded permissions to another agent', method: 'POST', path: '/delegations', domain: 'delegations', requires_auth: true, tags: ['authorization', 'permissions'] },
    { id: 'delegations.list', description: 'List delegations (as grantor or delegate)', method: 'GET', path: '/delegations', domain: 'delegations', requires_auth: true, tags: ['authorization'] },
    { id: 'delegations.revoke', description: 'Revoke a delegation (cascades to sub-delegations)', method: 'POST', path: '/delegations/:id/revoke', domain: 'delegations', requires_auth: true, tags: ['authorization'] },
    { id: 'delegations.check', description: 'Check if a delegated action is authorized', method: 'POST', path: '/delegations/check', domain: 'delegations', requires_auth: true, tags: ['authorization', 'check'] },
    { id: 'delegations.audit', description: 'Query delegation authorization audit log', method: 'GET', path: '/delegations/audit', domain: 'delegations', requires_auth: true, tags: ['authorization', 'audit'] },

    // ── Channels ──
    { id: 'channels.create', description: 'Create a direct, group, or topic channel for agent messaging', method: 'POST', path: '/channels', domain: 'channels', requires_auth: true, tags: ['messaging', 'communication'] },
    { id: 'channels.list', description: 'List channels the agent is a member of', method: 'GET', path: '/channels', domain: 'channels', requires_auth: true, tags: ['messaging'] },
    { id: 'channels.add_member', description: 'Add an agent to a channel', method: 'POST', path: '/channels/:id/members', domain: 'channels', requires_auth: true, tags: ['messaging', 'membership'] },
    { id: 'channels.send_message', description: 'Send a message (text, request, response, proposal, vote)', method: 'POST', path: '/channels/:id/messages', domain: 'channels', requires_auth: true, tags: ['messaging', 'send'] },
    { id: 'channels.list_messages', description: 'List messages with cursor pagination and proposal tallies', method: 'GET', path: '/channels/:id/messages', domain: 'channels', requires_auth: true, tags: ['messaging'] },

    // ── Governance ──
    { id: 'governance.create_policy', description: 'Create a governance policy for agent autonomy and safety', method: 'POST', path: '/governance/policies', domain: 'governance', requires_auth: true, min_trust_level: 'partner', tags: ['safety', 'policy'] },
    { id: 'governance.list_policies', description: 'List governance policies', method: 'GET', path: '/governance/policies', domain: 'governance', requires_auth: true, tags: ['safety'] },
    { id: 'governance.evaluate', description: 'Evaluate an action against governance policies', method: 'POST', path: '/governance/evaluate', domain: 'governance', requires_auth: true, tags: ['safety', 'evaluation'] },
    { id: 'governance.escalations', description: 'List or resolve governance escalations', method: 'GET', path: '/governance/escalations', domain: 'governance', requires_auth: true, tags: ['safety', 'escalation'] },
    { id: 'governance.kill_switch', description: 'Activate emergency kill switch for an agent', method: 'POST', path: '/governance/kill-switch', domain: 'governance', requires_auth: true, min_trust_level: 'partner', tags: ['safety', 'emergency'] },
    { id: 'governance.lift_kill_switch', description: 'Lift an active kill switch', method: 'POST', path: '/governance/kill-switch/lift', domain: 'governance', requires_auth: true, min_trust_level: 'partner', tags: ['safety'] },
    { id: 'governance.audit', description: 'Query governance audit log', method: 'GET', path: '/governance/audit', domain: 'governance', requires_auth: true, tags: ['safety', 'audit'] },

    // ── Auctions ──
    { id: 'auctions.create', description: 'Create a task auction with escrow (open, sealed, reverse, dutch)', method: 'POST', path: '/auctions', domain: 'auctions', requires_auth: true, tags: ['marketplace', 'bidding'] },
    { id: 'auctions.list', description: 'List auctions with filtering by status, capability, type', method: 'GET', path: '/auctions', domain: 'auctions', requires_auth: true, tags: ['marketplace'] },
    { id: 'auctions.detail', description: 'Get auction detail with bids', method: 'GET', path: '/auctions/:id', domain: 'auctions', requires_auth: true, tags: ['marketplace'] },
    { id: 'auctions.bid', description: 'Place a bid on an auction', method: 'POST', path: '/auctions/:id/bid', domain: 'auctions', requires_auth: true, tags: ['marketplace', 'bidding'] },
    { id: 'auctions.award', description: 'Close bidding and select winner', method: 'POST', path: '/auctions/:id/award', domain: 'auctions', requires_auth: true, tags: ['marketplace'] },
    { id: 'auctions.cancel', description: 'Cancel an open auction and refund escrow', method: 'POST', path: '/auctions/:id/cancel', domain: 'auctions', requires_auth: true, tags: ['marketplace'] },
    { id: 'auctions.withdraw', description: 'Withdraw your bid from an auction', method: 'POST', path: '/auctions/:id/withdraw', domain: 'auctions', requires_auth: true, tags: ['marketplace'] },

    // ── Mesh ──
    { id: 'mesh.route', description: 'Route a task through the service mesh with circuit breakers and health-aware load balancing', method: 'POST', path: '/mesh', domain: 'mesh', requires_auth: true, tags: ['resilience', 'routing'] },
    { id: 'mesh.health', description: 'Mesh-wide health dashboard: agent health snapshots, circuit breaker states', method: 'GET', path: '/mesh', domain: 'mesh', requires_auth: true, tags: ['resilience', 'health'] },
    { id: 'mesh.create_policy', description: 'Create mesh resilience policy (load balancing, circuit breaker, retry)', method: 'POST', path: '/mesh/policies', domain: 'mesh', requires_auth: true, min_trust_level: 'partner', tags: ['resilience', 'policy'] },
    { id: 'mesh.list_policies', description: 'List mesh policies', method: 'GET', path: '/mesh/policies', domain: 'mesh', requires_auth: true, tags: ['resilience'] },
    { id: 'mesh.circuit', description: 'Record circuit breaker events for an agent', method: 'POST', path: '/mesh/circuit', domain: 'mesh', requires_auth: true, tags: ['resilience', 'circuit'] },
    { id: 'mesh.circuit_status', description: 'Get circuit breaker state for an agent', method: 'GET', path: '/mesh/circuit', domain: 'mesh', requires_auth: true, tags: ['resilience'] },
    { id: 'mesh.bulkheads', description: 'Create bulkhead partition for capacity isolation', method: 'POST', path: '/mesh/bulkheads', domain: 'mesh', requires_auth: true, tags: ['resilience', 'isolation'] },

    // ── Cache ──
    { id: 'cache.stats', description: 'Cache statistics dashboard: hit/miss rates, cost savings', method: 'GET', path: '/cache', domain: 'cache', requires_auth: true, tags: ['optimization', 'stats'] },
    { id: 'cache.lookup', description: 'Explicit cache lookup for an intent+input', method: 'POST', path: '/cache', domain: 'cache', requires_auth: true, tags: ['optimization', 'lookup'] },
    { id: 'cache.invalidate', description: 'Invalidate cache entries by key, intent, or producer', method: 'POST', path: '/cache', domain: 'cache', requires_auth: true, tags: ['optimization'] },
    { id: 'cache.policy', description: 'Create/update per-intent cache policy', method: 'POST', path: '/cache', domain: 'cache', requires_auth: true, tags: ['optimization', 'policy'] },
    { id: 'cache.warm', description: 'Pre-populate cache by executing an intent proactively', method: 'POST', path: '/cache', domain: 'cache', requires_auth: true, tags: ['optimization', 'prefetch'] },

    // ── Events ──
    { id: 'events.emit', description: 'Emit a platform event', method: 'POST', path: '/events/emit', domain: 'events', requires_auth: true, tags: ['streaming', 'publish'] },
    { id: 'events.subscribe', description: 'Subscribe to event patterns', method: 'POST', path: '/events/subscribe', domain: 'events', requires_auth: true, tags: ['streaming', 'subscribe'] },
    { id: 'events.catalog', description: 'List all available event types', method: 'GET', path: '/events/catalog', domain: 'events', requires_auth: true, tags: ['streaming', 'discovery'] },
    { id: 'events.replay', description: 'Replay historical events', method: 'POST', path: '/events/replay', domain: 'events', requires_auth: true, tags: ['streaming', 'replay'] },
    { id: 'events.dead_letters', description: 'List undelivered events', method: 'GET', path: '/events/dead-letters', domain: 'events', requires_auth: true, tags: ['streaming', 'debugging'] },

    // ── Correlations ──
    { id: 'correlations.create', description: 'Create a correlation context for multi-step operation tracing', method: 'POST', path: '/correlations', domain: 'correlations', requires_auth: true, tags: ['observability', 'tracing'] },
    { id: 'correlations.list', description: 'List correlation contexts', method: 'GET', path: '/correlations', domain: 'correlations', requires_auth: true, tags: ['observability'] },
    { id: 'correlations.detail', description: 'Get correlation context with events', method: 'GET', path: '/correlations/:id', domain: 'correlations', requires_auth: true, tags: ['observability'] },
    { id: 'correlations.graph', description: 'Build causal DAG for a correlation', method: 'GET', path: '/correlations/:id/graph', domain: 'correlations', requires_auth: true, tags: ['observability', 'causality'] },
    { id: 'correlations.timeline', description: 'Chronological event timeline for a correlation', method: 'GET', path: '/correlations/:id/timeline', domain: 'correlations', requires_auth: true, tags: ['observability', 'timeline'] },
    { id: 'correlations.search', description: 'Search correlations by domain, agent, or time range', method: 'GET', path: '/correlations/search', domain: 'correlations', requires_auth: true, tags: ['observability', 'search'] },

    // ── Identity ──
    { id: 'identity.register_key', description: 'Register an Ed25519 public key for cryptographic identity', method: 'POST', path: '/identity/keys', domain: 'identity', requires_auth: true, tags: ['crypto', 'keys'] },
    { id: 'identity.list_keys', description: 'List registered public keys', method: 'GET', path: '/identity/keys', domain: 'identity', requires_auth: true, tags: ['crypto'] },
    { id: 'identity.challenge', description: 'Request a cryptographic challenge to prove key ownership', method: 'POST', path: '/identity/challenge', domain: 'identity', requires_auth: true, tags: ['crypto', 'proof'] },
    { id: 'identity.verify_challenge', description: 'Verify a signed challenge response', method: 'POST', path: '/identity/verify', domain: 'identity', requires_auth: true, tags: ['crypto', 'verification'] },
    { id: 'identity.verify_envelope', description: 'Verify a signed envelope\'s authenticity', method: 'POST', path: '/identity/verify-envelope', domain: 'identity', requires_auth: true, tags: ['crypto', 'envelope'] },
    { id: 'identity.verify_delegation', description: 'Verify a cryptographic delegation token', method: 'POST', path: '/identity/verify-delegation', domain: 'identity', requires_auth: true, tags: ['crypto', 'delegation'] },

    // ── Federation ──
    { id: 'federation.register_peer', description: 'Register a federated peer platform', method: 'POST', path: '/federation/peers', domain: 'federation', requires_auth: true, min_trust_level: 'partner', tags: ['cross-platform', 'peering'] },
    { id: 'federation.list_peers', description: 'List federated peers', method: 'GET', path: '/federation/peers', domain: 'federation', requires_auth: true, tags: ['cross-platform'] },
    { id: 'federation.search_agents', description: 'Search agents across federated platforms', method: 'GET', path: '/federation/agents', domain: 'federation', requires_auth: true, tags: ['cross-platform', 'discovery'] },
    { id: 'federation.submit_task', description: 'Submit a task to a federated agent', method: 'POST', path: '/federation/tasks', domain: 'federation', requires_auth: true, tags: ['cross-platform', 'task'] },
    { id: 'federation.sync', description: 'Trigger capability sync with a peer', method: 'POST', path: '/federation/sync', domain: 'federation', requires_auth: true, tags: ['cross-platform', 'sync'] },
    { id: 'federation.audit', description: 'Query federation audit log', method: 'GET', path: '/federation/audit', domain: 'federation', requires_auth: true, tags: ['cross-platform', 'audit'] },

    // ── Knowledge ──
    { id: 'knowledge.create_node', description: 'Create a knowledge graph node', method: 'POST', path: '/knowledge/nodes', domain: 'knowledge', requires_auth: true, tags: ['graph', 'semantic'] },
    { id: 'knowledge.search_nodes', description: 'Search knowledge nodes by type, domain, or text', method: 'GET', path: '/knowledge/nodes', domain: 'knowledge', requires_auth: true, tags: ['graph', 'search'] },
    { id: 'knowledge.create_edge', description: 'Create a typed edge between knowledge nodes', method: 'POST', path: '/knowledge/edges', domain: 'knowledge', requires_auth: true, tags: ['graph', 'relationships'] },
    { id: 'knowledge.traverse', description: 'Traverse the knowledge graph from a starting node', method: 'POST', path: '/knowledge/traverse', domain: 'knowledge', requires_auth: true, tags: ['graph', 'traversal'] },
    { id: 'knowledge.find_path', description: 'Find shortest path between two knowledge nodes', method: 'POST', path: '/knowledge/path', domain: 'knowledge', requires_auth: true, tags: ['graph', 'pathfinding'] },
    { id: 'knowledge.contradictions', description: 'Find contradictions in the knowledge graph', method: 'GET', path: '/knowledge/contradictions', domain: 'knowledge', requires_auth: true, tags: ['graph', 'consistency'] },
    { id: 'knowledge.merge', description: 'Merge duplicate knowledge nodes', method: 'POST', path: '/knowledge/merge', domain: 'knowledge', requires_auth: true, tags: ['graph', 'dedup'] },
    { id: 'knowledge.decay', description: 'Apply confidence decay to stale knowledge', method: 'POST', path: '/knowledge/decay', domain: 'knowledge', requires_auth: true, tags: ['graph', 'maintenance'] },
    { id: 'knowledge.reinforce', description: 'Reinforce a knowledge node with endorsement', method: 'POST', path: '/knowledge/reinforce', domain: 'knowledge', requires_auth: true, tags: ['graph', 'endorsement'] },

    // ── Memory ──
    { id: 'memory.create_bank', description: 'Create a memory bank for episodic storage', method: 'POST', path: '/memory/banks', domain: 'memory', requires_auth: true, tags: ['continuity', 'storage'] },
    { id: 'memory.record_episode', description: 'Record an episode (observation, action, reflection, etc.)', method: 'POST', path: '/memory/episodes', domain: 'memory', requires_auth: true, tags: ['continuity', 'episodes'] },
    { id: 'memory.recall', description: 'Recall episodes by semantic similarity, recency, or importance', method: 'POST', path: '/memory/recall', domain: 'memory', requires_auth: true, tags: ['continuity', 'retrieval'] },
    { id: 'memory.share', description: 'Share an episode with another agent', method: 'POST', path: '/memory/share', domain: 'memory', requires_auth: true, tags: ['continuity', 'collaboration'] },
    { id: 'memory.consolidate', description: 'Consolidate related episodes into higher-level memories', method: 'POST', path: '/memory/consolidate', domain: 'memory', requires_auth: true, tags: ['continuity', 'consolidation'] },
    { id: 'memory.sessions', description: 'Create or resume a continuity session', method: 'POST', path: '/memory/sessions', domain: 'memory', requires_auth: true, tags: ['continuity', 'session'] },
    { id: 'memory.stats', description: 'Get memory bank usage statistics', method: 'GET', path: '/memory/stats', domain: 'memory', requires_auth: true, tags: ['continuity', 'stats'] },

    // ── Observability ──
    { id: 'observability.health', description: 'Platform-wide health status with distributed tracing', method: 'GET', path: '/observability/health', domain: 'observability', requires_auth: true, tags: ['monitoring', 'health'] },
    { id: 'observability.agent', description: 'Get detailed agent performance metrics', method: 'GET', path: '/observability/agents/:id', domain: 'observability', requires_auth: true, tags: ['monitoring', 'metrics'] },

    // ── Pipelines ──
    { id: 'pipelines.create', description: 'Define a type-safe multi-agent data pipeline', method: 'POST', path: '/pipelines', domain: 'pipelines', requires_auth: true, tags: ['dataflow', 'composition'] },
    { id: 'pipelines.execute', description: 'Execute a pipeline with input data', method: 'POST', path: '/pipelines/:id/execute', domain: 'pipelines', requires_auth: true, tags: ['dataflow', 'execution'] },
    { id: 'pipelines.list', description: 'List pipeline definitions', method: 'GET', path: '/pipelines', domain: 'pipelines', requires_auth: true, tags: ['dataflow'] },
    { id: 'pipelines.check_compatibility', description: 'Check schema compatibility between pipeline stages', method: 'POST', path: '/pipelines/check-compatibility', domain: 'pipelines', requires_auth: true, tags: ['dataflow', 'validation'] },
    { id: 'pipelines.plan', description: 'Auto-plan a pipeline from a goal description', method: 'POST', path: '/pipelines/plan', domain: 'pipelines', requires_auth: true, tags: ['dataflow', 'planning'] },

    // ── Planner ──
    { id: 'planner.plan', description: 'Decompose a high-level goal into executable sub-tasks', method: 'POST', path: '/planner/plan', domain: 'planner', requires_auth: true, tags: ['planning', 'decomposition'] },
    { id: 'planner.execute', description: 'Execute a plan with multi-agent coordination', method: 'POST', path: '/planner/execute', domain: 'planner', requires_auth: true, tags: ['planning', 'execution'] },

    // ── Ensembles ──
    { id: 'ensembles.create', description: 'Form a dynamic multi-agent team for collaborative problem-solving', method: 'POST', path: '/ensembles', domain: 'ensembles', requires_auth: true, tags: ['teamwork', 'formation'] },
    { id: 'ensembles.list', description: 'List active ensembles', method: 'GET', path: '/ensembles', domain: 'ensembles', requires_auth: true, tags: ['teamwork'] },
    { id: 'ensembles.detail', description: 'Get ensemble detail with members and consensus status', method: 'GET', path: '/ensembles/:id', domain: 'ensembles', requires_auth: true, tags: ['teamwork'] },
    { id: 'ensembles.invite', description: 'Invite an agent to join an ensemble', method: 'POST', path: '/ensembles/:id/members', domain: 'ensembles', requires_auth: true, tags: ['teamwork', 'membership'] },
    { id: 'ensembles.propose', description: 'Propose an output for consensus voting', method: 'POST', path: '/ensembles/:id/consensus', domain: 'ensembles', requires_auth: true, tags: ['teamwork', 'consensus'] },
    { id: 'ensembles.vote', description: 'Vote on a consensus proposal', method: 'POST', path: '/ensembles/:id/consensus/vote', domain: 'ensembles', requires_auth: true, tags: ['teamwork', 'voting'] },
    { id: 'ensembles.dissolve', description: 'Dissolve an ensemble and release members', method: 'POST', path: '/ensembles/:id/dissolve', domain: 'ensembles', requires_auth: true, tags: ['teamwork'] },

    // ── Swarm ──
    { id: 'swarms.create', description: 'Create a swarm for decentralized emergent coordination', method: 'POST', path: '/swarms', domain: 'swarms', requires_auth: true, tags: ['emergent', 'collective'] },
    { id: 'swarms.join', description: 'Join an active swarm', method: 'POST', path: '/swarms/:id/join', domain: 'swarms', requires_auth: true, tags: ['emergent', 'membership'] },
    { id: 'swarms.pheromones', description: 'Deposit a pheromone signal for stigmergic communication', method: 'POST', path: '/swarms/:id/pheromones', domain: 'swarms', requires_auth: true, tags: ['emergent', 'signaling'] },
    { id: 'swarms.sense', description: 'Sense nearby pheromones for environment awareness', method: 'POST', path: '/swarms/:id/sense', domain: 'swarms', requires_auth: true, tags: ['emergent', 'sensing'] },
    { id: 'swarms.solutions', description: 'Report a candidate solution to the swarm', method: 'POST', path: '/swarms/:id/solutions', domain: 'swarms', requires_auth: true, tags: ['emergent', 'solutions'] },
    { id: 'swarms.evaporate', description: 'Trigger pheromone evaporation cycle', method: 'POST', path: '/swarms/:id/evaporate', domain: 'swarms', requires_auth: true, tags: ['emergent', 'maintenance'] },
    { id: 'swarms.dissolve', description: 'Dissolve a swarm', method: 'POST', path: '/swarms/:id/dissolve', domain: 'swarms', requires_auth: true, tags: ['emergent'] },
    { id: 'swarms.list', description: 'List active swarms', method: 'GET', path: '/swarms', domain: 'swarms', requires_auth: true, tags: ['emergent'] },

    // ── Arbitration ──
    { id: 'arbitration.file', description: 'File a dispute between agents with evidence and bond', method: 'POST', path: '/arbitration/disputes', domain: 'arbitration', requires_auth: true, tags: ['disputes', 'resolution'] },
    { id: 'arbitration.list', description: 'List disputes with filtering', method: 'GET', path: '/arbitration/disputes', domain: 'arbitration', requires_auth: true, tags: ['disputes'] },
    { id: 'arbitration.detail', description: 'Get full dispute detail with evidence and messages', method: 'GET', path: '/arbitration/disputes/:id', domain: 'arbitration', requires_auth: true, tags: ['disputes'] },
    { id: 'arbitration.evidence', description: 'Submit evidence for a dispute', method: 'POST', path: '/arbitration/disputes/:id/evidence', domain: 'arbitration', requires_auth: true, tags: ['disputes', 'evidence'] },
    { id: 'arbitration.negotiate', description: 'Send a negotiation message or settlement offer', method: 'POST', path: '/arbitration/disputes/:id/negotiate', domain: 'arbitration', requires_auth: true, tags: ['disputes', 'negotiation'] },
    { id: 'arbitration.escalate', description: 'Escalate a dispute to formal arbitration', method: 'POST', path: '/arbitration/disputes/:id/escalate', domain: 'arbitration', requires_auth: true, tags: ['disputes', 'escalation'] },
    { id: 'arbitration.rule', description: 'Issue a ruling on an escalated dispute', method: 'POST', path: '/arbitration/disputes/:id/rule', domain: 'arbitration', requires_auth: true, tags: ['disputes', 'ruling'] },
    { id: 'arbitration.appeal', description: 'Appeal a dispute ruling', method: 'POST', path: '/arbitration/disputes/:id/appeal', domain: 'arbitration', requires_auth: true, tags: ['disputes'] },

    // ── Organizations ──
    { id: 'organizations.create', description: 'Create an agent organization with billing and RBAC', method: 'POST', path: '/organizations', domain: 'organizations', requires_auth: true, tags: ['enterprise', 'org'] },
    { id: 'organizations.list', description: 'List organizations', method: 'GET', path: '/organizations', domain: 'organizations', requires_auth: true, tags: ['enterprise'] },
    { id: 'organizations.detail', description: 'Get organization detail with members and settings', method: 'GET', path: '/organizations/:id', domain: 'organizations', requires_auth: true, tags: ['enterprise'] },
    { id: 'organizations.invite', description: 'Invite an agent to an organization', method: 'POST', path: '/organizations/:id/members', domain: 'organizations', requires_auth: true, tags: ['enterprise', 'membership'] },
    { id: 'organizations.collaborate', description: 'Propose a collaboration between organizations', method: 'POST', path: '/organizations/:id/collaborations', domain: 'organizations', requires_auth: true, tags: ['enterprise', 'collaboration'] },
    { id: 'organizations.trust', description: 'Get effective trust level for an org member', method: 'GET', path: '/organizations/:id/trust', domain: 'organizations', requires_auth: true, tags: ['enterprise', 'trust'] },
    { id: 'organizations.audit', description: 'Query organization audit log', method: 'GET', path: '/organizations/:id/audit', domain: 'organizations', requires_auth: true, tags: ['enterprise', 'audit'] },

    // ── Intelligence ──
    { id: 'intelligence.strategies', description: 'List or register adaptive strategies', method: 'GET', path: '/intelligence/strategies', domain: 'intelligence', requires_auth: true, tags: ['optimization', 'strategy'] },
    { id: 'intelligence.recommend', description: 'Get strategy recommendations for a task domain', method: 'POST', path: '/intelligence/recommend', domain: 'intelligence', requires_auth: true, tags: ['optimization', 'recommendation'] },
    { id: 'intelligence.experiments', description: 'List or create A/B experiments for strategy comparison', method: 'GET', path: '/intelligence/experiments', domain: 'intelligence', requires_auth: true, tags: ['optimization', 'experimentation'] },
    { id: 'intelligence.outcomes', description: 'Record strategy execution outcomes for learning', method: 'POST', path: '/intelligence/outcomes', domain: 'intelligence', requires_auth: true, tags: ['optimization', 'learning'] },
    { id: 'intelligence.insights', description: 'Extract or list cross-strategy insights', method: 'GET', path: '/intelligence/insights', domain: 'intelligence', requires_auth: true, tags: ['optimization', 'insights'] },
    { id: 'intelligence.evolve', description: 'Propose strategy evolution based on performance data', method: 'POST', path: '/intelligence/evolve', domain: 'intelligence', requires_auth: true, tags: ['optimization', 'evolution'] },

    // ── Sandbox ──
    { id: 'sandbox.campaigns', description: 'Create or list safety evaluation campaigns', method: 'POST', path: '/sandbox/campaigns', domain: 'sandbox', requires_auth: true, tags: ['safety', 'evaluation'] },
    { id: 'sandbox.invariants', description: 'Define safety invariants for evaluation', method: 'POST', path: '/sandbox/invariants', domain: 'sandbox', requires_auth: true, tags: ['safety', 'invariants'] },
    { id: 'sandbox.fingerprints', description: 'Get or compare behavioral fingerprints', method: 'GET', path: '/sandbox/fingerprints', domain: 'sandbox', requires_auth: true, tags: ['safety', 'behavioral'] },
    { id: 'sandbox.anomaly_check', description: 'Check live behavior against established fingerprint', method: 'POST', path: '/sandbox/anomaly-check', domain: 'sandbox', requires_auth: true, tags: ['safety', 'anomaly'] },
    { id: 'sandbox.trust_gate', description: 'Evaluate if an agent qualifies for trust escalation', method: 'POST', path: '/sandbox/trust-gate', domain: 'sandbox', requires_auth: true, tags: ['safety', 'trust'] },

    // ── Sessions ──
    { id: 'sessions.establish', description: 'Establish an end-to-end encrypted session with another agent', method: 'POST', path: '/sessions/establish', domain: 'sessions', requires_auth: true, tags: ['encryption', 'secure'] },
    { id: 'sessions.send', description: 'Send an encrypted message within a session', method: 'POST', path: '/sessions/send', domain: 'sessions', requires_auth: true, tags: ['encryption', 'messaging'] },
    { id: 'sessions.status', description: 'Get session status and key exchange info', method: 'GET', path: '/sessions/status', domain: 'sessions', requires_auth: true, tags: ['encryption'] },
    { id: 'sessions.terminate', description: 'Terminate an encrypted session', method: 'POST', path: '/sessions/terminate', domain: 'sessions', requires_auth: true, tags: ['encryption'] },

    // ── Versions ──
    { id: 'versions.routes', description: 'List all versioned API routes', method: 'GET', path: '/versions', domain: 'versions', requires_auth: false, tags: ['evolution', 'discovery'] },
    { id: 'versions.compatibility', description: 'Check compatibility between API versions', method: 'POST', path: '/versions/compatibility', domain: 'versions', requires_auth: true, tags: ['evolution', 'compatibility'] },
    { id: 'versions.migrations', description: 'List migration paths between versions', method: 'GET', path: '/versions/migrations', domain: 'versions', requires_auth: true, tags: ['evolution', 'migration'] },
    { id: 'versions.negotiate', description: 'Negotiate API version with a client agent', method: 'POST', path: '/versions/negotiate', domain: 'versions', requires_auth: true, tags: ['evolution', 'negotiation'] },

    // ── Gateway (self-referential) ──
    { id: 'gateway.batch', description: 'Execute multiple API calls in a single request with dependency resolution', method: 'POST', path: '/gateway/batch', domain: 'gateway', requires_auth: true, tags: ['composition', 'batch', 'atomic'] },
    { id: 'gateway.stream', description: 'SSE stream for real-time events (task progress, agent heartbeats, platform events)', method: 'GET', path: '/gateway/stream', domain: 'gateway', requires_auth: true, tags: ['streaming', 'realtime', 'sse'] },
    { id: 'gateway.introspect', description: 'Machine-readable API catalog with schemas, examples, and domain metadata', method: 'GET', path: '/gateway/introspect', domain: 'gateway', requires_auth: false, tags: ['discovery', 'catalog', 'schema'] },
  ];
}

/**
 * Derive domain descriptors from the endpoint list.
 */
function getAllDomains(endpoints: EndpointDescriptor[]): DomainDescriptor[] {
  const domainMap = new Map<string, { endpoints: string[]; description: string }>();

  const domainDescriptions: Record<string, { description: string; loop?: number }> = {
    agents: { description: 'Agent registration, discovery, profiles, and health monitoring' },
    tasks: { description: 'Task submission, status polling, and result reporting' },
    capabilities: { description: 'Platform capability discovery and intent schemas' },
    webhooks: { description: 'Event-driven HMAC-signed webhook subscriptions', loop: 1 },
    context: { description: 'Shared agent context store for collaborative workflows' },
    workflows: { description: 'DAG-based multi-step workflow orchestration', loop: 2 },
    billing: { description: 'Credit-based economy: wallets, deposits, settlements, spend governance', loop: 3 },
    contracts: { description: 'Service-level agreements with SLA negotiation and compliance tracking', loop: 4 },
    delegations: { description: 'Scoped, time-bounded authorization with cascading revocation', loop: 4 },
    channels: { description: 'Agent-to-agent messaging: direct, group, and topic channels', loop: 1 },
    governance: { description: 'Safety policies, kill switches, escalation, and audit', loop: 5 },
    auctions: { description: 'Task marketplace with open, sealed, reverse, and dutch auctions', loop: 6 },
    mesh: { description: 'Service mesh with circuit breakers, load balancing, and bulkheads', loop: 8 },
    cache: { description: 'Task result deduplication with per-intent TTL and stale-while-revalidate', loop: 9 },
    events: { description: 'Event bus: emit, subscribe, replay, dead-letter queue', loop: 10 },
    correlations: { description: 'Causal DAG construction and multi-step operation tracing', loop: 10 },
    identity: { description: 'Ed25519 cryptographic identity, signed envelopes, delegation tokens', loop: 6 },
    federation: { description: 'Cross-platform agent collaboration and task forwarding', loop: 7 },
    knowledge: { description: 'Collaborative knowledge graph with consensus-based conflict resolution', loop: 5 },
    memory: { description: 'Episodic memory banks with recall, consolidation, and continuity sessions', loop: 16 },
    observability: { description: 'Distributed tracing (W3C Trace Context), metrics, and anomaly detection', loop: 10 },
    pipelines: { description: 'Type-safe multi-agent data-flow pipeline composition', loop: 11 },
    planner: { description: 'Goal decomposition and multi-agent execution planning', loop: 14 },
    ensembles: { description: 'Dynamic multi-agent team formation with consensus voting', loop: 11 },
    swarms: { description: 'Decentralized emergent coordination with pheromone signaling', loop: 12 },
    arbitration: { description: 'Dispute resolution with evidence, negotiation, rulings, and precedents', loop: 13 },
    organizations: { description: 'Agent fleets with hierarchical RBAC, billing, and collaborations', loop: 14 },
    intelligence: { description: 'Adaptive strategy engine with experiments, insights, and evolution', loop: 15 },
    sandbox: { description: 'Safety evaluation campaigns, behavioral fingerprinting, trust gates', loop: 15 },
    sessions: { description: 'End-to-end encrypted agent-to-agent communication', loop: 6 },
    versions: { description: 'Semantic API versioning, deprecation lifecycle, migration paths', loop: 9 },
    gateway: { description: 'Unified entry point: batch operations, SSE streaming, protocol introspection', loop: 20 },
  };

  for (const ep of endpoints) {
    if (!domainMap.has(ep.domain)) {
      domainMap.set(ep.domain, {
        endpoints: [],
        description: domainDescriptions[ep.domain]?.description ?? ep.domain,
      });
    }
    domainMap.get(ep.domain)!.endpoints.push(ep.id);
  }

  return Array.from(domainMap.entries()).map(([id, info]) => ({
    id,
    description: info.description,
    endpoint_count: info.endpoints.length,
    endpoints: info.endpoints,
    added_in_loop: domainDescriptions[id]?.loop,
  }));
}

// ──────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────

export class BatchCycleError extends Error {
  constructor(public readonly cyclicSteps: string[]) {
    super(`Dependency cycle detected in batch steps: ${cyclicSteps.join(', ')}`);
    this.name = 'BatchCycleError';
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function extractError(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data) {
    return String((data as { error: unknown }).error);
  }
  return 'Request failed';
}
