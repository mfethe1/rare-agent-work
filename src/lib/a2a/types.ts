/**
 * A2A (Agent-to-Agent) Task Protocol Types
 *
 * Implements a structured task lifecycle for agents collaborating
 * through the rareagent.work platform. Agents register with capabilities,
 * submit typed task requests, and poll for results.
 *
 * Task lifecycle: submitted → accepted → in_progress → completed | failed | rejected
 */

// ──────────────────────────────────────────────
// Agent Registry
// ──────────────────────────────────────────────

/** Capability that an agent advertises to the platform. */
export interface AgentCapability {
  /** Machine-readable capability ID (e.g., "news.query", "report.summarize"). */
  id: string;
  /** Human-readable description of what this capability does. */
  description: string;
  /** Accepted input MIME types. */
  input_modes: string[];
  /** Produced output MIME types. */
  output_modes: string[];
}

/** Agent registration record stored in the platform. */
export interface RegisteredAgent {
  /** Platform-assigned agent ID. */
  id: string;
  /** Agent's self-declared name. */
  name: string;
  /** What this agent does. */
  description: string;
  /** URL the platform can reach the agent at (for future push). */
  callback_url?: string;
  /** Capabilities this agent offers. */
  capabilities: AgentCapability[];
  /** Platform trust level assigned to this agent. */
  trust_level: AgentTrustLevel;
  /** Whether this agent is currently active. */
  is_active: boolean;
  created_at: string;
  last_seen_at: string;
}

export type AgentTrustLevel = 'untrusted' | 'verified' | 'partner';

// ──────────────────────────────────────────────
// Task Protocol
// ──────────────────────────────────────────────

/**
 * Built-in task intents the platform can fulfill.
 * Extensible — agents can also use custom intents prefixed with "x-".
 */
export type TaskIntent =
  | 'news.query'        // Query curated news feed
  | 'news.summarize'    // Summarize recent news by topic
  | 'report.catalog'    // List available reports
  | 'report.preview'    // Get report preview/metadata
  | 'models.query'      // Query model rankings
  | 'ask'               // Natural language question (NLWeb)
  | 'digest.latest'     // Get latest weekly digest
  | 'agent.discover'    // Discover registered agents by capability
  | string;             // Custom intents (convention: "x-vendor.action")

export type TaskStatus =
  | 'submitted'     // Task received, not yet processed
  | 'accepted'      // Platform accepted and will process
  | 'in_progress'   // Currently being processed
  | 'completed'     // Done — result available
  | 'failed'        // Processing failed — error available
  | 'rejected';     // Platform refused the task (auth, quota, etc.)

export type TaskPriority = 'low' | 'normal' | 'high';

/** A task submitted by one agent to the platform (or to another agent via the platform). */
export interface A2ATask {
  /** Platform-assigned task ID (UUID). */
  id: string;
  /** ID of the agent that submitted this task. */
  sender_agent_id: string;
  /** Optional: ID of a specific target agent. Omit for platform routing. */
  target_agent_id?: string;
  /** What the sender wants done. */
  intent: TaskIntent;
  /** Task priority. */
  priority: TaskPriority;
  /** Current lifecycle status. */
  status: TaskStatus;
  /** Structured input payload (intent-specific). */
  input: Record<string, unknown>;
  /** Result payload when status is 'completed'. */
  result?: Record<string, unknown>;
  /** Error details when status is 'failed' or 'rejected'. */
  error?: TaskError;
  /** Correlation ID for multi-step workflows. */
  correlation_id?: string;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
  completed_at?: string;
  /** TTL in seconds — task expires if not completed within this window. */
  ttl_seconds: number;
}

export interface TaskError {
  code: string;
  message: string;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/agents — register a new agent. */
export interface AgentRegisterRequest {
  name: string;
  description: string;
  callback_url?: string;
  capabilities: AgentCapability[];
}

/** Response from agent registration. */
export interface AgentRegisterResponse {
  agent_id: string;
  api_key: string;
  trust_level: AgentTrustLevel;
  created_at: string;
}

/** POST /api/a2a/tasks — submit a task. */
export interface TaskSubmitRequest {
  intent: TaskIntent;
  input: Record<string, unknown>;
  target_agent_id?: string;
  priority?: TaskPriority;
  correlation_id?: string;
  ttl_seconds?: number;
}

/** Response from task submission. */
export interface TaskSubmitResponse {
  task_id: string;
  status: TaskStatus;
  created_at: string;
  /** Hint: poll this URL for status. */
  status_url: string;
}

/** PATCH /api/a2a/tasks/:id — update task status (for assigned agents). */
export interface TaskUpdateRequest {
  status: 'in_progress' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: TaskError;
}

/** Response from task update. */
export interface TaskUpdateResponse {
  task_id: string;
  status: TaskStatus;
  updated_at: string;
  completed_at?: string;
}

/** GET /api/a2a/tasks/:id — task status response. */
export interface TaskStatusResponse {
  task: A2ATask;
}

/** GET /api/a2a/capabilities — platform capability listing. */
export interface CapabilitiesResponse {
  platform: string;
  version: string;
  intents: PlatformIntent[];
  registered_agents: number;
}

export interface PlatformIntent {
  intent: string;
  description: string;
  input_schema?: Record<string, unknown>;
  requires_auth: boolean;
}

// ──────────────────────────────────────────────
// Shared Agent Context Store
// ──────────────────────────────────────────────

/** A shared context entry that agents can persist, update, and query. */
export interface AgentContext {
  /** Platform-assigned context ID (UUID). */
  id: string;
  /** ID of the agent that created this context. */
  agent_id: string;
  /** Logical namespace for partitioning (e.g., "research", "decisions"). */
  namespace: string;
  /** Machine-readable key within the namespace. */
  key: string;
  /** Structured context payload. */
  value: Record<string, unknown>;
  /** Optional: correlation ID linking to a task workflow. */
  correlation_id?: string;
  /** Optional: specific task ID this context relates to. */
  task_id?: string;
  /** Content type hint for consuming agents. */
  content_type: string;
  /** TTL in seconds — context auto-expires. */
  ttl_seconds: number;
  /** When this context expires. */
  expires_at: string;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
}

/** POST /api/a2a/context — store a context entry. */
export interface ContextStoreRequest {
  namespace?: string;
  key: string;
  value: Record<string, unknown>;
  correlation_id?: string;
  task_id?: string;
  content_type?: string;
  ttl_seconds?: number;
}

/** Response from context store/update. */
export interface ContextStoreResponse {
  context_id: string;
  namespace: string;
  key: string;
  agent_id: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/** GET /api/a2a/context — query context entries. */
export interface ContextQueryResponse {
  contexts: AgentContext[];
  count: number;
}
