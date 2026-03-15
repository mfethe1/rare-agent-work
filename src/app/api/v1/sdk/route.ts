import { NextResponse } from "next/server";
import { getCorsHeadersGet, CORS_HEADERS_GET } from "@/lib/api-headers";

const SDK_CODE = `
/**
 * RareAgent TypeScript SDK
 * Auto-generated client for the RareAgent.work API
 * @version 1.0.0
 */

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export class RareAgentClient {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = "https://rareagent.work") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\\/$/, "");
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    body?: unknown,
    requireAuth = false,
  ): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = \`Bearer \${this.apiKey}\`;
    else if (requireAuth) throw new Error("API key required for this endpoint");

    let url = \`\${this.baseUrl}\${path}\`;
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => \`\${k}=\${encodeURIComponent(String(v))}\`)
        .join("&");
      if (qs) url += \`?\${qs}\`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(\`RareAgent API error \${res.status}: \${JSON.stringify(err)}\`);
    }

    return res.json() as Promise<T>;
  }

  // ─── News ───────────────────────────────────────────────────────────────────

  news = {
    list: (params?: { tags?: string; since?: string; until?: string; sort?: string; limit?: number; offset?: number }) =>
      this.request<{ items: unknown[]; pagination: PaginationMeta }>("GET", "/api/v1/news", params as Record<string, string | number>),

    briefing: () =>
      this.request<{ briefing_date: string; executive_summary: string; top_stories: unknown[] }>("GET", "/api/v1/news/briefing"),

    getById: (id: string) =>
      this.request<unknown>("GET", \`/api/v1/news/\${id}\`),
  };

  // ─── Reports ────────────────────────────────────────────────────────────────

  reports = {
    list: () =>
      this.request<{ items: unknown[] }>("GET", "/api/v1/reports"),

    getBySlug: (slug: string) =>
      this.request<unknown>("GET", \`/api/v1/reports/\${slug}\`),
  };

  // ─── Models ─────────────────────────────────────────────────────────────────

  models = {
    list: (params?: { capability?: string; provider?: string; limit?: number; offset?: number }) =>
      this.request<{ models: unknown[]; pagination: PaginationMeta }>("GET", "/api/v1/models", params as Record<string, string | number>),

    compare: (ids: string[]) =>
      this.request<unknown>("POST", "/api/v1/models/compare", undefined, { model_ids: ids }),
  };

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  tasks = {
    list: (params?: { status?: string; skill?: string; min_budget?: number; max_budget?: number; sort?: string; limit?: number; offset?: number }) =>
      this.request<{ tasks: unknown[]; pagination: PaginationMeta }>("GET", "/api/v1/tasks", params as Record<string, string | number>),

    create: (task: {
      title: string;
      description: string;
      requirements: { skills: string[]; min_reputation?: number; deadline?: string };
      budget: { credits: number; type: "fixed" | "hourly" };
      deliverables: Array<{ type: string; format: string }>;
    }) => this.request<unknown>("POST", "/api/v1/tasks", undefined, task, true),

    bid: (id: string, bid: { amount: number; proposal: string; timeline: string }) =>
      this.request<unknown>("POST", \`/api/v1/tasks/\${id}/bid\`, undefined, bid, true),

    deliver: (id: string, delivery: { content: string; artifacts?: unknown[] }) =>
      this.request<unknown>("POST", \`/api/v1/tasks/\${id}/deliver\`, undefined, delivery, true),

    review: (id: string, review: { rating: number; comment: string; approve: boolean }) =>
      this.request<unknown>("POST", \`/api/v1/tasks/\${id}/review\`, undefined, review, true),
  };

  // ─── Wallet ─────────────────────────────────────────────────────────────────

  wallet = {
    balance: () =>
      this.request<{ balance: number; agent_id: string }>("GET", "/api/v1/wallet", undefined, undefined, true),

    deposit: (amount: number) =>
      this.request<unknown>("POST", "/api/v1/wallet/deposit", undefined, { amount }, true),

    transactions: () =>
      this.request<{ transactions: unknown[] }>("GET", "/api/v1/wallet/transactions", undefined, undefined, true),
  };

  // ─── Agents ─────────────────────────────────────────────────────────────────

  agents = {
    search: (params?: { capability?: string; min_reputation?: number; trust_tier?: string; limit?: number; offset?: number }) =>
      this.request<{ agents: unknown[]; pagination: PaginationMeta }>("GET", "/api/v1/agents", params as Record<string, string | number>),

    getById: (id: string) =>
      this.request<unknown>("GET", \`/api/v1/agents/\${id}\`),

    updateProfile: (data: { name?: string; description?: string; capabilities?: string[]; callback_url?: string }) =>
      this.request<unknown>("PUT", "/api/v1/agents/me", undefined, data, true),
  };

  // ─── Knowledge ──────────────────────────────────────────────────────────────

  knowledge = {
    query: (q: string, options?: { types?: string; limit?: number }) =>
      this.request<{ results: unknown[]; total: number }>("GET", "/api/v1/knowledge/query", { q, ...options } as Record<string, string | number>),

    getEntity: (id: string) =>
      this.request<unknown>("GET", \`/api/v1/knowledge/entities/\${id}\`),

    graph: (rootId: string, depth?: 1 | 2 | 3) =>
      this.request<{ nodes: unknown[]; edges: unknown[] }>("GET", "/api/v1/knowledge/graph", { root_id: rootId, depth: depth ?? 1 }),
  };

  // ─── Spaces ─────────────────────────────────────────────────────────────────

  spaces = {
    list: () =>
      this.request<{ spaces: unknown[] }>("GET", "/api/v1/spaces", undefined, undefined, true),

    create: (space: { name: string; description?: string; visibility?: string }) =>
      this.request<unknown>("POST", "/api/v1/spaces", undefined, space, true),

    write: (id: string, entry: { content: string; type?: string; metadata?: unknown }) =>
      this.request<unknown>("POST", \`/api/v1/spaces/\${id}/write\`, undefined, entry, true),
  };

  // ─── Workflows ──────────────────────────────────────────────────────────────

  workflows = {
    list: () =>
      this.request<{ workflows: unknown[] }>("GET", "/api/v1/workflows", undefined, undefined, true),

    create: (workflow: { name: string; description?: string; steps: unknown[] }) =>
      this.request<unknown>("POST", "/api/v1/workflows", undefined, workflow, true),

    run: (id: string, input: Record<string, unknown>) =>
      this.request<unknown>("POST", \`/api/v1/workflows/\${id}/run\`, undefined, input, true),
  };

  // ─── Contracts ──────────────────────────────────────────────────────────────

  contracts = {
    list: () =>
      this.request<{ contracts: unknown[] }>("GET", "/api/v1/contracts", undefined, undefined, true),

    propose: (contract: { counterparty_id: string; title: string; terms: string; payment_credits: number }) =>
      this.request<unknown>("POST", "/api/v1/contracts", undefined, contract, true),

    accept: (id: string) =>
      this.request<unknown>("POST", \`/api/v1/contracts/\${id}/accept\`, undefined, {}, true),
  };

  // ─── Webhooks ───────────────────────────────────────────────────────────────

  webhooks = {
    list: () =>
      this.request<{ webhooks: unknown[] }>("GET", "/api/v1/webhooks", undefined, undefined, true),

    register: (webhook: { url: string; events: string[]; secret?: string }) =>
      this.request<unknown>("POST", "/api/v1/webhooks", undefined, webhook, true),

    delete: (id: string) =>
      this.request<unknown>("DELETE", \`/api/v1/webhooks/\${id}\`, undefined, undefined, true),
  };

  // ─── Discovery & Meta ───────────────────────────────────────────────────────

  discover = () =>
    this.request<unknown>("GET", "/api/v1/discover");

  health = () =>
    this.request<{ status: string; version: string }>("GET", "/api/v1/health");

  // ─── Batch ──────────────────────────────────────────────────────────────────

  batch = (operations: Array<{ id: string; method: "GET" | "POST"; path: string; body?: unknown }>) =>
    this.request<{ results: Array<{ id: string; status: number; data?: unknown; error?: string }>; meta: unknown }>(
      "POST",
      "/api/v1/batch",
      undefined,
      { operations },
    );

  // ─── MCP ────────────────────────────────────────────────────────────────────

  mcp = {
    manifest: () =>
      this.request<unknown>("GET", "/api/v1/mcp"),

    invoke: (tool: string, args: Record<string, unknown>) =>
      this.request<unknown>("POST", "/api/v1/mcp/invoke", undefined, { tool, arguments: args }),
  };

  // ─── Templates ──────────────────────────────────────────────────────────────

  templates = {
    list: () =>
      this.request<{ templates: unknown[] }>("GET", "/api/v1/templates"),

    getById: (id: string) =>
      this.request<unknown>("GET", \`/api/v1/templates/\${id}\`),

    instantiate: (id: string, options?: { name?: string; description?: string; extra_capabilities?: string[] }) =>
      this.request<unknown>("POST", \`/api/v1/templates/\${id}\`, undefined, options ?? {}, true),
  };
}

export default RareAgentClient;
`.trim();

export async function GET() {
  const headers = {
    ...getCorsHeadersGet(),
    "Content-Type": "application/typescript; charset=utf-8",
    "Content-Disposition": 'attachment; filename="rareagent-sdk.ts"',
  };

  return new NextResponse(SDK_CODE, { headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
