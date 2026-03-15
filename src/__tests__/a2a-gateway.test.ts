/**
 * A2A Gateway — Unit Tests
 *
 * Tests the gateway engine: template interpolation, dependency resolution,
 * batch execution, SSE formatting, and protocol introspection.
 */

import {
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
  GATEWAY_VERSION,
  MAX_BATCH_STEPS,
  ALL_STREAM_EVENT_TYPES,
  batchRequestSchema,
  batchStepSchema,
  streamSubscriptionSchema,
  introspectionQuerySchema,
} from '@/lib/a2a/gateway';

// ──────────────────────────────────────────────
// resolvePath
// ──────────────────────────────────────────────

describe('resolvePath', () => {
  it('resolves simple dotted paths', () => {
    expect(resolvePath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('resolves array index paths', () => {
    expect(resolvePath({ items: [{ name: 'first' }, { name: 'second' }] }, 'items[1].name')).toBe('second');
  });

  it('returns undefined for missing paths', () => {
    expect(resolvePath({ a: 1 }, 'b.c')).toBeUndefined();
  });

  it('handles null/undefined intermediate values', () => {
    expect(resolvePath({ a: null }, 'a.b')).toBeUndefined();
  });

  it('resolves top-level values', () => {
    expect(resolvePath({ status: 200 }, 'status')).toBe(200);
  });
});

// ──────────────────────────────────────────────
// interpolateString
// ──────────────────────────────────────────────

describe('interpolateString', () => {
  const results = new Map([
    ['register', { id: 'register', status: 200, data: { agent_id: 'ag-123', name: 'test' }, duration_ms: 50 }],
    ['submit', { id: 'submit', status: 201, data: { task_id: 'tk-456' }, duration_ms: 100 }],
  ]);

  it('interpolates a single template reference preserving type', () => {
    expect(interpolateString('{{register.data.agent_id}}', results)).toBe('ag-123');
  });

  it('interpolates mixed content as string', () => {
    expect(interpolateString('/tasks/{{submit.data.task_id}}/status', results)).toBe('/tasks/tk-456/status');
  });

  it('leaves unresolvable templates intact', () => {
    expect(interpolateString('{{unknown.data.x}}', results)).toBe('{{unknown.data.x}}');
  });

  it('leaves templates from failed steps intact', () => {
    const failedResults = new Map([
      ['fail', { id: 'fail', status: 500, data: null, duration_ms: 10, error: 'boom' }],
    ]);
    expect(interpolateString('{{fail.data.x}}', failedResults)).toBe('{{fail.data.x}}');
  });
});

// ──────────────────────────────────────────────
// interpolateValue
// ──────────────────────────────────────────────

describe('interpolateValue', () => {
  const results = new Map([
    ['s1', { id: 's1', status: 200, data: { id: 'abc', count: 5 }, duration_ms: 10 }],
  ]);

  it('recursively interpolates objects', () => {
    const input = { agent_id: '{{s1.data.id}}', limit: 10 };
    expect(interpolateValue(input, results)).toEqual({ agent_id: 'abc', limit: 10 });
  });

  it('recursively interpolates arrays', () => {
    const input = ['{{s1.data.id}}', 'static'];
    expect(interpolateValue(input, results)).toEqual(['abc', 'static']);
  });

  it('passes through non-string primitives', () => {
    expect(interpolateValue(42, results)).toBe(42);
    expect(interpolateValue(true, results)).toBe(true);
    expect(interpolateValue(null, results)).toBe(null);
  });
});

// ──────────────────────────────────────────────
// extractTemplateDeps
// ──────────────────────────────────────────────

describe('extractTemplateDeps', () => {
  it('extracts dependencies from path', () => {
    const deps = extractTemplateDeps({
      id: 'step2',
      method: 'GET',
      path: '/tasks/{{step1.data.task_id}}',
    });
    expect(deps).toEqual(new Set(['step1']));
  });

  it('extracts dependencies from body', () => {
    const deps = extractTemplateDeps({
      id: 'step3',
      method: 'POST',
      path: '/tasks',
      body: { agent_id: '{{register.data.id}}', ref: '{{submit.data.task_id}}' },
    });
    expect(deps).toEqual(new Set(['register', 'submit']));
  });

  it('extracts dependencies from params', () => {
    const deps = extractTemplateDeps({
      id: 'step4',
      method: 'GET',
      path: '/agents',
      params: { filter: '{{step1.data.capability}}' },
    });
    expect(deps).toEqual(new Set(['step1']));
  });

  it('returns empty set when no templates', () => {
    const deps = extractTemplateDeps({
      id: 'step1',
      method: 'GET',
      path: '/agents',
    });
    expect(deps.size).toBe(0);
  });
});

// ──────────────────────────────────────────────
// resolveDependencies
// ──────────────────────────────────────────────

describe('resolveDependencies', () => {
  it('resolves explicit dependencies', () => {
    const deps = resolveDependencies([
      { id: 'a', method: 'GET', path: '/x' },
      { id: 'b', method: 'GET', path: '/y', depends_on: ['a'] },
    ]);
    expect(deps.get('a').size).toBe(0);
    expect(deps.get('b').has('a')).toBe(true);
  });

  it('merges implicit and explicit dependencies', () => {
    const deps = resolveDependencies([
      { id: 'a', method: 'POST', path: '/register' },
      { id: 'b', method: 'POST', path: '/tasks', body: { agent: '{{a.data.id}}' }, depends_on: ['a'] },
    ]);
    expect(deps.get('b').has('a')).toBe(true);
  });

  it('detects cycles', () => {
    expect(() =>
      resolveDependencies([
        { id: 'a', method: 'GET', path: '/x', depends_on: ['b'] },
        { id: 'b', method: 'GET', path: '/y', depends_on: ['a'] },
      ]),
    ).toThrow(BatchCycleError);
  });

  it('ignores dependencies on non-existent steps', () => {
    const deps = resolveDependencies([
      { id: 'a', method: 'GET', path: '/x', depends_on: ['nonexistent'] },
    ]);
    expect(deps.get('a').size).toBe(0);
  });
});

// ──────────────────────────────────────────────
// executeBatch
// ──────────────────────────────────────────────

describe('executeBatch', () => {
  const mockDispatch = vi.fn();
  const headers = { Authorization: 'Bearer test', 'X-Agent-ID': 'ag-1' };

  beforeEach(() => {
    mockDispatch.mockReset();
  });

  it('executes independent steps', async () => {
    mockDispatch
      .mockResolvedValueOnce({ status: 200, data: { result: 'a' } })
      .mockResolvedValueOnce({ status: 200, data: { result: 'b' } });

    const result = await executeBatch(
      {
        steps: [
          { id: 's1', method: 'GET', path: '/a' },
          { id: 's2', method: 'GET', path: '/b' },
        ],
      },
      mockDispatch,
      headers,
    );

    expect(result.status).toBe('completed');
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(2);
  });

  it('interpolates templates between dependent steps', async () => {
    mockDispatch
      .mockResolvedValueOnce({ status: 200, data: { agent_id: 'ag-new' } })
      .mockResolvedValueOnce({ status: 200, data: { task_id: 'tk-1' } });

    const result = await executeBatch(
      {
        steps: [
          { id: 'register', method: 'POST', path: '/agents', body: { name: 'test' } },
          { id: 'submit', method: 'POST', path: '/tasks', body: { agent: '{{register.data.agent_id}}' }, depends_on: ['register'] },
        ],
        strategy: 'sequential',
      },
      mockDispatch,
      headers,
    );

    expect(result.status).toBe('completed');
    // Verify the second call received interpolated body
    const secondCallBody = mockDispatch.mock.calls[1][2];
    expect(secondCallBody).toEqual({ agent: 'ag-new' });
  });

  it('aborts on non-optional step failure', async () => {
    mockDispatch
      .mockResolvedValueOnce({ status: 500, data: { error: 'Internal error' } });

    const result = await executeBatch(
      {
        steps: [
          { id: 's1', method: 'POST', path: '/fail' },
          { id: 's2', method: 'GET', path: '/skip', depends_on: ['s1'] },
        ],
        strategy: 'sequential',
      },
      mockDispatch,
      headers,
    );

    expect(result.status).toBe('failed');
    expect(result.succeeded).toBe(0);
    expect(result.results[1].error).toContain('aborted');
  });

  it('continues past optional step failure', async () => {
    mockDispatch
      .mockResolvedValueOnce({ status: 500, data: { error: 'fail' } })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const result = await executeBatch(
      {
        steps: [
          { id: 's1', method: 'POST', path: '/fail', optional: true },
          { id: 's2', method: 'GET', path: '/ok' },
        ],
        strategy: 'sequential',
      },
      mockDispatch,
      headers,
    );

    expect(result.status).toBe('partial');
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('generates a correlation ID when not provided', async () => {
    mockDispatch.mockResolvedValue({ status: 200, data: {} });

    const result = await executeBatch(
      { steps: [{ id: 's1', method: 'GET', path: '/x' }] },
      mockDispatch,
      headers,
    );

    expect(result.correlation_id).toBeTruthy();
    expect(typeof result.correlation_id).toBe('string');
  });

  it('uses provided correlation ID', async () => {
    mockDispatch.mockResolvedValue({ status: 200, data: {} });

    const result = await executeBatch(
      { steps: [{ id: 's1', method: 'GET', path: '/x' }], correlation_id: 'my-corr-id' },
      mockDispatch,
      headers,
    );

    expect(result.correlation_id).toBe('my-corr-id');
  });

  it('handles step timeouts', async () => {
    mockDispatch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ status: 200, data: {} }), 5000)),
    );

    const result = await executeBatch(
      {
        steps: [{ id: 's1', method: 'GET', path: '/slow', timeout_ms: 100 }],
        strategy: 'sequential',
      },
      mockDispatch,
      headers,
    );

    expect(result.status).toBe('failed');
    expect(result.results[0].error).toContain('timed out');
  }, 10000);
});

// ──────────────────────────────────────────────
// SSE Formatting
// ──────────────────────────────────────────────

describe('SSE formatting', () => {
  it('formats a StreamEvent as SSE text', () => {
    const event = {
      type: 'task.completed',
      data: { task_id: 'tk-1', result: 'done' },
      timestamp: '2028-01-15T10:00:00Z',
    };
    const sse = formatSSE(event);
    expect(sse).toContain('event: task.completed');
    expect(sse).toContain('"task_id":"tk-1"');
    expect(sse).toMatch(/\n\n$/);
  });

  it('creates a connected event with agent ID', () => {
    const event = createConnectedEvent('ag-123');
    expect(event.type).toBe('connected');
    expect(event.data.agent_id).toBe('ag-123');
    expect(event.data.supported_events).toEqual(ALL_STREAM_EVENT_TYPES);
  });

  it('creates a ping event', () => {
    const event = createPingEvent();
    expect(event.type).toBe('ping');
    expect(event.data.keepalive).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Protocol Introspection
// ──────────────────────────────────────────────

describe('buildIntrospection', () => {
  it('returns full introspection with no filters', () => {
    const result = buildIntrospection();
    expect(result.protocol).toBe('rareagent-a2a');
    expect(result.version).toBe(GATEWAY_VERSION);
    expect(result.total_endpoints).toBeGreaterThan(100);
    expect(result.domains.length).toBeGreaterThan(20);
    expect(result.gateway.batch.max_steps).toBe(MAX_BATCH_STEPS);
    expect(result.gateway.streaming.event_types).toEqual(ALL_STREAM_EVENT_TYPES);
  });

  it('filters by domain', () => {
    const result = buildIntrospection({ domain: 'billing' });
    expect(result.endpoints.every((e) => e.domain === 'billing')).toBe(true);
    expect(result.endpoints.length).toBeGreaterThan(0);
    expect(result.domains.length).toBe(1);
    expect(result.domains[0].id).toBe('billing');
  });

  it('filters by tag', () => {
    const result = buildIntrospection({ tag: 'safety' });
    expect(result.endpoints.every((e) => e.tags.includes('safety'))).toBe(true);
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it('filters by method', () => {
    const result = buildIntrospection({ method: 'DELETE' });
    expect(result.endpoints.every((e) => e.method === 'DELETE')).toBe(true);
  });

  it('filters by auth requirement', () => {
    const result = buildIntrospection({ requires_auth: false });
    expect(result.endpoints.every((e) => e.requires_auth === false)).toBe(true);
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it('supports free-text search', () => {
    const result = buildIntrospection({ search: 'circuit breaker' });
    expect(result.endpoints.length).toBeGreaterThan(0);
    expect(result.endpoints.some((e) => e.description.toLowerCase().includes('circuit'))).toBe(true);
  });

  it('includes the gateway domain itself', () => {
    const result = buildIntrospection({ domain: 'gateway' });
    expect(result.endpoints.map((e) => e.id)).toEqual(
      expect.arrayContaining(['gateway.batch', 'gateway.stream', 'gateway.introspect']),
    );
  });

  it('strips schemas when include_schemas is not set', () => {
    const result = buildIntrospection();
    const withSchemas = result.endpoints.filter((e) => e.request_schema || e.response_schema);
    expect(withSchemas.length).toBe(0);
  });

  it('includes schemas when include_schemas is true', () => {
    const result = buildIntrospection({ include_schemas: true });
    const withExamples = result.endpoints.filter((e) => e.example_request);
    expect(withExamples.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

describe('validation schemas', () => {
  describe('batchStepSchema', () => {
    it('accepts valid step', () => {
      const result = batchStepSchema.safeParse({
        id: 'step-1',
        method: 'POST',
        path: '/tasks',
        body: { intent: 'news.query' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty step ID', () => {
      const result = batchStepSchema.safeParse({
        id: '',
        method: 'GET',
        path: '/tasks',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid method', () => {
      const result = batchStepSchema.safeParse({
        id: 'step1',
        method: 'INVALID',
        path: '/tasks',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('batchRequestSchema', () => {
    it('accepts valid batch', () => {
      const result = batchRequestSchema.safeParse({
        steps: [{ id: 's1', method: 'GET', path: '/agents' }],
        strategy: 'parallel',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty steps array', () => {
      const result = batchRequestSchema.safeParse({ steps: [] });
      expect(result.success).toBe(false);
    });

    it('rejects too many steps', () => {
      const steps = Array.from({ length: 25 }, (_, i) => ({
        id: 's' + i,
        method: 'GET',
        path: '/x',
      }));
      const result = batchRequestSchema.safeParse({ steps });
      expect(result.success).toBe(false);
    });
  });

  describe('streamSubscriptionSchema', () => {
    it('accepts valid subscription', () => {
      const result = streamSubscriptionSchema.safeParse({
        events: ['task.completed', 'task.failed'],
        task_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid event type', () => {
      const result = streamSubscriptionSchema.safeParse({
        events: ['invalid.event'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('introspectionQuerySchema', () => {
    it('accepts valid query', () => {
      const result = introspectionQuerySchema.safeParse({
        domain: 'billing',
        tag: 'economy',
        method: 'POST',
        search: 'wallet',
      });
      expect(result.success).toBe(true);
    });

    it('coerces string booleans', () => {
      const result = introspectionQuerySchema.safeParse({
        requires_auth: 'true',
        include_schemas: 'false',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requires_auth).toBe(true);
        expect(result.data.include_schemas).toBe(false);
      }
    });
  });
});
