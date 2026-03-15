/**
 * A2A Agent SDK — Client Tests
 *
 * Tests the core SDK client: authentication headers, retry logic,
 * rate-limit handling, timeout behavior, and namespace wiring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2AClient, A2AError } from '@/lib/a2a/sdk/client';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers ?? {}),
    json: () => Promise.resolve(body),
  });
}

function createClient(fetchFn: ReturnType<typeof vi.fn>, overrides?: Partial<Parameters<typeof A2AClient['prototype']['request']>>) {
  return new A2AClient({
    baseUrl: 'https://test.rareagent.work',
    apiKey: 'a2a_test_key_123',
    agentId: 'agent_test_abc',
    fetchFn: fetchFn as unknown as typeof fetch,
    maxRetries: 2,
    retryBaseDelayMs: 10, // Fast retries for tests
    timeoutMs: 5000,
  });
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('A2AClient', () => {
  describe('authentication', () => {
    it('sends correct auth headers on every request', async () => {
      const fetchFn = mockFetch(200, { agents: [], count: 0 });
      const client = createClient(fetchFn);

      await client.agents.list();

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, options] = fetchFn.mock.calls[0];
      expect(url).toBe('https://test.rareagent.work/api/a2a/agents');
      expect(options.headers['Authorization']).toBe('Bearer a2a_test_key_123');
      expect(options.headers['X-Agent-ID']).toBe('agent_test_abc');
      expect(options.headers['Accept']).toBe('application/json');
    });

    it('sets Content-Type for POST requests with body', async () => {
      const fetchFn = mockFetch(200, { task_id: 't1', status: 'submitted', created_at: '', status_url: '' });
      const client = createClient(fetchFn);

      await client.tasks.submit({
        intent: 'news.query',
        input: { topic: 'AI' },
      });

      const [, options] = fetchFn.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({
        intent: 'news.query',
        input: { topic: 'AI' },
      });
    });
  });

  describe('retry logic', () => {
    it('retries on 500 errors up to maxRetries', async () => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: () => Promise.resolve({ error: 'Internal error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          headers: new Headers(),
          json: () => Promise.resolve({ error: 'Bad gateway' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ task: { id: 't1', status: 'completed' } }),
        });

      const client = createClient(fetchFn);
      const result = await client.tasks.get('t1');

      expect(fetchFn).toHaveBeenCalledTimes(3);
      expect(result.data.task.status).toBe('completed');
    });

    it('throws after exhausting retries on persistent 500', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: 'Server error', code: 'internal_error' }),
      });

      const client = createClient(fetchFn);

      await expect(client.tasks.get('t1')).rejects.toThrow(A2AError);
      expect(fetchFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('does not retry on 4xx client errors', async () => {
      const fetchFn = mockFetch(404, { error: 'Not found', code: 'not_found' });
      const client = createClient(fetchFn);

      await expect(client.tasks.get('nonexistent')).rejects.toThrow(A2AError);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limiting', () => {
    it('parses rate-limit headers from response', async () => {
      const fetchFn = mockFetch(200, { agents: [], count: 0 }, {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '42',
        'X-RateLimit-Reset': '2028-01-01T00:01:00Z',
        'X-RateLimit-Daily-Limit': '1000',
        'X-RateLimit-Daily-Remaining': '900',
      });
      const client = createClient(fetchFn);

      const result = await client.agents.list();

      expect(result.rateLimit).toEqual({
        limit: 60,
        remaining: 42,
        resetsAt: '2028-01-01T00:01:00Z',
        dailyLimit: 1000,
        dailyRemaining: 900,
        retryAfterSeconds: null,
      });
    });

    it('retries on 429 with Retry-After', async () => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': '2028-01-01T00:01:00Z',
            'Retry-After': '1',
          }),
          json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ task: { id: 't1', status: 'completed' } }),
        });

      const onRateLimit = vi.fn();
      const client = new A2AClient({
        baseUrl: 'https://test.rareagent.work',
        apiKey: 'key',
        agentId: 'agent',
        fetchFn: fetchFn as unknown as typeof fetch,
        maxRetries: 2,
        retryBaseDelayMs: 10,
        onRateLimit,
      });

      const result = await client.tasks.get('t1');

      expect(onRateLimit).toHaveBeenCalledWith('/tasks/t1', 1);
      expect(result.data.task.status).toBe('completed');
    });
  });

  describe('error handling', () => {
    it('throws A2AError with structured details on 4xx', async () => {
      const fetchFn = mockFetch(422, {
        error: 'Validation failed',
        code: 'validation_error',
        details: { field: 'intent', issue: 'required' },
      });
      const client = createClient(fetchFn);

      try {
        await client.tasks.submit({ intent: '', input: {} });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(A2AError);
        const a2aErr = err as A2AError;
        expect(a2aErr.status).toBe(422);
        expect(a2aErr.code).toBe('validation_error');
        expect(a2aErr.message).toBe('Validation failed');
      }
    });
  });

  describe('query parameters', () => {
    it('appends query params to URL', async () => {
      const fetchFn = mockFetch(200, { agents: [], count: 0 });
      const client = createClient(fetchFn);

      await client.agents.list({ search: 'weather', capability: 'forecast' });

      const [url] = fetchFn.mock.calls[0];
      expect(url).toContain('search=weather');
      expect(url).toContain('capability=forecast');
    });

    it('omits undefined params', async () => {
      const fetchFn = mockFetch(200, { agents: [], count: 0 });
      const client = createClient(fetchFn);

      await client.agents.list({ search: 'test', capability: undefined });

      const [url] = fetchFn.mock.calls[0];
      expect(url).toContain('search=test');
      expect(url).not.toContain('capability');
    });
  });

  describe('observability hooks', () => {
    it('calls onRequest and onResponse callbacks', async () => {
      const onRequest = vi.fn();
      const onResponse = vi.fn();
      const fetchFn = mockFetch(200, { acknowledged: true });

      const client = new A2AClient({
        baseUrl: 'https://test.rareagent.work',
        apiKey: 'key',
        agentId: 'agent',
        fetchFn: fetchFn as unknown as typeof fetch,
        onRequest,
        onResponse,
      });

      await client.agents.heartbeat();

      expect(onRequest).toHaveBeenCalledWith('POST', '/agents/heartbeat');
      expect(onResponse).toHaveBeenCalledWith('POST', '/agents/heartbeat', 200, expect.any(Number));
    });
  });

  describe('namespaces', () => {
    it('exposes all expected namespace objects', () => {
      const client = createClient(mockFetch(200, {}));

      expect(client.agents).toBeDefined();
      expect(client.tasks).toBeDefined();
      expect(client.contracts).toBeDefined();
      expect(client.events).toBeDefined();
      expect(client.knowledge).toBeDefined();
      expect(client.context).toBeDefined();
      expect(client.billing).toBeDefined();
    });
  });
});

describe('Tasks.waitForCompletion', () => {
  it('polls until task reaches terminal state', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(() => {
      callCount++;
      const status = callCount >= 3 ? 'completed' : 'in_progress';
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            task: { id: 't1', status, result: status === 'completed' ? { answer: 42 } : undefined },
          }),
      });
    });

    const client = createClient(fetchFn);
    const task = await client.tasks.waitForCompletion('t1', { pollIntervalMs: 10 });

    expect(task.status).toBe('completed');
    expect(task.result).toEqual({ answer: 42 });
    expect(callCount).toBe(3);
  });

  it('throws on timeout', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ task: { id: 't1', status: 'in_progress' } }),
    });

    const client = createClient(fetchFn);

    await expect(
      client.tasks.waitForCompletion('t1', { pollIntervalMs: 10, timeoutMs: 50 }),
    ).rejects.toThrow('did not complete within');
  });
});
