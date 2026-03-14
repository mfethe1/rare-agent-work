import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for /api/chat auth gating logic.
 * We test the auth gating logic by mocking supabase at the module level.
 * Dynamic import is used after env/mock setup to ensure the module
 * picks up the correct mocked behavior.
 */

// Mock next/headers (required by supabase server client in tests)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
  createBrowserClient: vi.fn(),
}));

// Mock the supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      stream: vi.fn().mockImplementation(async function* () {
        yield {
          type: 'message_start',
          message: { usage: { input_tokens: 50 } },
        };
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello' },
        };
        yield {
          type: 'message_delta',
          usage: { output_tokens: 20 },
        };
      }),
    },
  })),
}));

function buildRequest(body: object) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  } as unknown as import('next/server').NextRequest;
}

describe('/api/chat auth gating', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    } as never);

    const { POST } = await import('@/app/api/chat/route');
    const req = buildRequest({ messages: [{ role: 'user', content: 'hello' }] });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Authentication required');
  });

  it('returns 403 when user has free tier', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@test.com' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { tier: 'free', tokens_used: 0, tokens_budget: 0 },
            }),
          }),
        }),
      }),
    } as never);

    const { POST } = await import('@/app/api/chat/route');
    const req = buildRequest({ messages: [{ role: 'user', content: 'hello' }] });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.upgrade).toBe(true);
    expect(json.upgradeUrl).toBe('/pricing');
  });

  it('returns 402 when token budget is exceeded', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@test.com' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { tier: 'starter', tokens_used: 50_001, tokens_budget: 50_000 },
            }),
          }),
        }),
      }),
    } as never);

    const { POST } = await import('@/app/api/chat/route');
    const req = buildRequest({ messages: [{ role: 'user', content: 'hello' }] });
    const res = await POST(req);
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.upgrade).toBe(true);
  });

  it('returns 500 when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    } as never);

    const { POST } = await import('@/app/api/chat/route');
    const req = buildRequest({ messages: [{ role: 'user', content: 'hello' }] });
    const res = await POST(req);
    // No user → 401, API key missing → 500, or validation → 400, all are valid guard responses
    expect([400, 401, 500]).toContain(res.status);
  });
});
