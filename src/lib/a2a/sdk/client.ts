/**
 * A2A Agent SDK — Core Client
 *
 * Provides the typed HTTP client with automatic retry, rate-limit
 * awareness, and namespaced access to every A2A subsystem.
 */

import {
  createAgentsNamespace,
  createTasksNamespace,
  createContractsNamespace,
  createEventsNamespace,
  createKnowledgeNamespace,
  createContextNamespace,
  createBillingNamespace,
  createGatewayNamespace,
  type AgentsNamespace,
  type TasksNamespace,
  type ContractsNamespace,
  type EventsNamespace,
  type KnowledgeNamespace,
  type ContextNamespace,
  type BillingNamespace,
  type GatewayNamespace,
} from './namespaces';

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

export interface A2AClientConfig {
  /** Base URL of the rareagent.work platform (no trailing slash). */
  baseUrl: string;

  /** API key obtained during agent registration. */
  apiKey: string;

  /** The authenticated agent's ID. */
  agentId: string;

  /** Maximum number of retries on transient failures (default: 3). */
  maxRetries?: number;

  /** Base delay in ms for exponential backoff (default: 500). */
  retryBaseDelayMs?: number;

  /** Request timeout in ms (default: 30000). */
  timeoutMs?: number;

  /** Custom fetch implementation (for testing or polyfills). */
  fetchFn?: typeof fetch;

  /** Optional callback invoked on every request for observability. */
  onRequest?: (method: string, path: string) => void;

  /** Optional callback invoked on every response. */
  onResponse?: (method: string, path: string, status: number, durationMs: number) => void;

  /** Optional callback invoked on rate-limit events. */
  onRateLimit?: (path: string, retryAfterSeconds: number) => void;
}

// ──────────────────────────────────────────────
// Request / Response types
// ──────────────────────────────────────────────

export interface A2ARequestOptions {
  /** Additional headers to merge. */
  headers?: Record<string, string>;
  /** Override timeout for this request. */
  timeoutMs?: number;
  /** Skip automatic retry for this request. */
  noRetry?: boolean;
  /** Query parameters. */
  params?: Record<string, string | number | boolean | undefined>;
}

export interface A2AResponse<T> {
  /** Parsed response body. */
  data: T;
  /** HTTP status code. */
  status: number;
  /** Rate-limit metadata from response headers (if present). */
  rateLimit: RateLimitInfo | null;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetsAt: string;
  dailyLimit: number;
  dailyRemaining: number;
  retryAfterSeconds: number | null;
}

// ──────────────────────────────────────────────
// SDK Error
// ──────────────────────────────────────────────

export class A2AError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly body: unknown,
    public readonly rateLimit: RateLimitInfo | null,
  ) {
    super(message);
    this.name = 'A2AError';
  }
}

// ──────────────────────────────────────────────
// Client
// ──────────────────────────────────────────────

export class A2AClient {
  private readonly config: Required<Pick<A2AClientConfig, 'baseUrl' | 'apiKey' | 'agentId' | 'maxRetries' | 'retryBaseDelayMs' | 'timeoutMs'>> & A2AClientConfig;

  /** Agent management: register, update profile, heartbeat. */
  public readonly agents: AgentsNamespace;
  /** Task submission, routing, polling, and updates. */
  public readonly tasks: TasksNamespace;
  /** Service contracts: propose, negotiate, monitor. */
  public readonly contracts: ContractsNamespace;
  /** Event subscriptions and streaming. */
  public readonly events: EventsNamespace;
  /** Knowledge graph: nodes, edges, traversal. */
  public readonly knowledge: KnowledgeNamespace;
  /** Shared context store. */
  public readonly context: ContextNamespace;
  /** Billing: wallet, deposits, spend tracking. */
  public readonly billing: BillingNamespace;
  /** Gateway: batch operations, SSE streaming, protocol introspection. */
  public readonly gateway: GatewayNamespace;

  constructor(config: A2AClientConfig) {
    this.config = {
      maxRetries: 3,
      retryBaseDelayMs: 500,
      timeoutMs: 30_000,
      ...config,
    };

    // Initialize namespaces with bound request methods
    const requester = this.request.bind(this);
    this.agents = createAgentsNamespace(requester, this.config.agentId);
    this.tasks = createTasksNamespace(requester, this.config.agentId);
    this.contracts = createContractsNamespace(requester, this.config.agentId);
    this.events = createEventsNamespace(requester, this.config.agentId);
    this.knowledge = createKnowledgeNamespace(requester, this.config.agentId);
    this.context = createContextNamespace(requester, this.config.agentId);
    this.billing = createBillingNamespace(requester, this.config.agentId);
    this.gateway = createGatewayNamespace(requester, this.config.agentId, this.config.baseUrl);
  }

  /**
   * Core HTTP request method with retry, timeout, and rate-limit handling.
   * All namespace methods delegate to this.
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    options?: A2ARequestOptions,
  ): Promise<A2AResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    const maxAttempts = options?.noRetry ? 1 : this.config.maxRetries + 1;
    const timeout = options?.timeoutMs ?? this.config.timeoutMs;
    const fetchFn = this.config.fetchFn ?? globalThis.fetch;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const delay = this.backoffDelay(attempt);
        await sleep(delay);
      }

      const startMs = Date.now();
      this.config.onRequest?.(method, path);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Agent-ID': this.config.agentId,
          'Accept': 'application/json',
          ...options?.headers,
        };

        if (body !== undefined) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetchFn(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);
        const durationMs = Date.now() - startMs;
        this.config.onResponse?.(method, path, response.status, durationMs);

        const rateLimit = parseRateLimitHeaders(response.headers);

        // Rate limited — respect Retry-After
        if (response.status === 429) {
          const retryAfter = rateLimit?.retryAfterSeconds ?? 5;
          this.config.onRateLimit?.(path, retryAfter);
          if (attempt < maxAttempts - 1) {
            await sleep(retryAfter * 1000);
            continue;
          }
        }

        // Transient server error — retry
        if (response.status >= 500 && attempt < maxAttempts - 1) {
          lastError = new A2AError(
            `Server error: ${response.status}`,
            response.status,
            null,
            null,
            rateLimit,
          );
          continue;
        }

        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          throw new A2AError(
            responseBody?.error ?? `HTTP ${response.status}`,
            response.status,
            responseBody?.code ?? null,
            responseBody,
            rateLimit,
          );
        }

        return {
          data: responseBody as T,
          status: response.status,
          rateLimit,
        };
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof A2AError) throw err;

        // AbortController timeout
        if (err instanceof DOMException && err.name === 'AbortError') {
          lastError = new A2AError(
            `Request timeout after ${timeout}ms`,
            0,
            'timeout',
            null,
            null,
          );
          if (attempt < maxAttempts - 1) continue;
        }

        // Network error — retryable
        if (isNetworkError(err) && attempt < maxAttempts - 1) {
          lastError = err;
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const base = `${this.config.baseUrl}/api/a2a${path}`;
    if (!params) return base;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    return qs ? `${base}?${qs}` : base;
  }

  private backoffDelay(attempt: number): number {
    const base = this.config.retryBaseDelayMs;
    const delay = base * Math.pow(2, attempt - 1);
    // Add jitter: 75%-125% of computed delay
    const jitter = 0.75 + Math.random() * 0.5;
    return Math.min(delay * jitter, 30_000);
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limit = headers.get('X-RateLimit-Limit');
  if (!limit) return null;

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(headers.get('X-RateLimit-Remaining') ?? '0', 10),
    resetsAt: headers.get('X-RateLimit-Reset') ?? '',
    dailyLimit: parseInt(headers.get('X-RateLimit-Daily-Limit') ?? '0', 10),
    dailyRemaining: parseInt(headers.get('X-RateLimit-Daily-Remaining') ?? '0', 10),
    retryAfterSeconds: headers.has('Retry-After')
      ? parseInt(headers.get('Retry-After')!, 10)
      : null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch network errors
  if (err instanceof Error && err.message.includes('ECONNREFUSED')) return true;
  return false;
}
