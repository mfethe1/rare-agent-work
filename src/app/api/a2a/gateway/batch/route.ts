import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  batchRequestSchema,
  executeBatch,
  BatchCycleError,
} from '@/lib/a2a/gateway';
import type { InternalDispatcher } from '@/lib/a2a/gateway';

/**
 * POST /api/a2a/gateway/batch — Execute multiple API calls in a single request.
 *
 * Agents send a batch of steps (each targeting an A2A endpoint), with optional
 * dependency declarations and template interpolation between steps. The gateway
 * resolves the dependency graph, executes steps in topological order (or in
 * parallel where independent), and returns all results in one response.
 *
 * This eliminates N round trips for multi-step operations like:
 *   register → discover agents → submit task → check wallet balance
 *
 * Template syntax: `{{stepId.data.field}}` in paths, bodies, and params.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('task.submit', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = batchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid batch request.',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  // Check for duplicate step IDs
  const ids = parsed.data.steps.map((s) => s.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    return NextResponse.json(
      { error: `Duplicate step IDs: ${[...new Set(duplicates)].join(', ')}` },
      { status: 400 },
    );
  }

  // Build internal dispatcher that calls routes via fetch against the same origin.
  // This keeps the gateway lightweight — it delegates to the actual route handlers
  // rather than reimplementing their logic.
  const origin = new URL(request.url).origin;
  const authHeader = request.headers.get('Authorization') ?? '';
  const agentIdHeader = request.headers.get('X-Agent-ID') ?? agent.id;

  const dispatch: InternalDispatcher = async (method, path, stepBody, params, _headers) => {
    const url = new URL(`/api/a2a${path}`, origin);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const fetchHeaders: Record<string, string> = {
      'Authorization': authHeader,
      'X-Agent-ID': agentIdHeader,
      'Accept': 'application/json',
      'X-Gateway-Batch': 'true',
    };

    if (stepBody !== undefined && stepBody !== null) {
      fetchHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method,
      headers: fetchHeaders,
      body: stepBody !== undefined && stepBody !== null ? JSON.stringify(stepBody) : undefined,
    });

    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  };

  try {
    const result = await executeBatch(
      parsed.data,
      dispatch,
      { Authorization: authHeader, 'X-Agent-ID': agentIdHeader },
    );

    return NextResponse.json(result, {
      status: result.status === 'failed' ? 207 : 200,
      headers: {
        'X-Correlation-ID': result.correlation_id,
        'X-Batch-Steps': String(parsed.data.steps.length),
        'X-Batch-Succeeded': String(result.succeeded),
        'X-Batch-Failed': String(result.failed),
      },
    });
  } catch (err) {
    if (err instanceof BatchCycleError) {
      return NextResponse.json(
        {
          error: 'Dependency cycle detected in batch steps.',
          cyclic_steps: err.cyclicSteps,
        },
        { status: 400 },
      );
    }

    console.error('[gateway/batch] Unexpected error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
