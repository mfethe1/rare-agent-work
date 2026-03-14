import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for /api/health and /api/version endpoints.
 * These endpoints provide deployment metadata for production verification.
 */

describe('/api/health', () => {
  it('returns valid JSON with status, timestamp, and deployment info', async () => {
    // Dynamic import to ensure env vars are set
    const { GET } = await import('@/app/api/health/route');
    
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('deployment');
    expect(data.deployment).toHaveProperty('commit');
    expect(data.deployment).toHaveProperty('platform');
  });

  it('sets no-cache headers', async () => {
    const { GET } = await import('@/app/api/health/route');
    
    const response = await GET();
    const cacheControl = response.headers.get('Cache-Control');
    
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('must-revalidate');
  });

  it('detects Railway deployment from env var', async () => {
    const originalEnv = process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.RAILWAY_GIT_COMMIT_SHA = 'abc123railway';
    
    // Re-import to pick up new env
    vi.resetModules();
    const { GET } = await import('@/app/api/health/route');
    
    const response = await GET();
    const data = await response.json();
    
    expect(data.deployment.commit).toBe('abc123railway');
    expect(data.deployment.platform).toBe('railway');
    
    // Restore
    process.env.RAILWAY_GIT_COMMIT_SHA = originalEnv;
  });

  it('detects Vercel deployment from env var', async () => {
    const originalEnv = process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.VERCEL_GIT_COMMIT_SHA = 'xyz789vercel';
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    
    // Re-import to pick up new env
    vi.resetModules();
    const { GET } = await import('@/app/api/health/route');
    
    const response = await GET();
    const data = await response.json();
    
    expect(data.deployment.commit).toBe('xyz789vercel');
    expect(data.deployment.platform).toBe('vercel');
    
    // Restore
    process.env.VERCEL_GIT_COMMIT_SHA = originalEnv;
  });
});

describe('/api/version', () => {
  it('returns valid JSON with version, deployment, and offers', async () => {
    const { GET } = await import('@/app/api/version/route');
    
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('deployment');
    expect(data).toHaveProperty('offers');
    expect(data).toHaveProperty('generatedAt');
  });

  it('includes all pricing tiers in offers', async () => {
    const { GET } = await import('@/app/api/version/route');
    
    const response = await GET();
    const data = await response.json();
    
    expect(data.offers).toHaveProperty('free');
    expect(data.offers).toHaveProperty('starter');
    expect(data.offers).toHaveProperty('pro');
    expect(data.offers).toHaveProperty('reports');
    
    // Verify structure
    expect(data.offers.free).toHaveProperty('label');
    expect(data.offers.free).toHaveProperty('price');
    expect(data.offers.free).toHaveProperty('tier');
    expect(data.offers.free).toHaveProperty('features');
    expect(Array.isArray(data.offers.free.features)).toBe(true);
  });

  it('includes report options with correct pricing', async () => {
    const { GET } = await import('@/app/api/version/route');
    
    const response = await GET();
    const data = await response.json();
    
    expect(data.offers.reports).toHaveProperty('options');
    expect(Array.isArray(data.offers.reports.options)).toBe(true);
    expect(data.offers.reports.options.length).toBe(4);
    
    // Verify first report
    const report60 = data.offers.reports.options.find((r: any) => r.planKey === 'report_60');
    expect(report60).toBeDefined();
    expect(report60.price).toBe('$29');
    expect(report60.slug).toBe('agent-setup-60');
  });

  it('sets cache headers for 5 minutes', async () => {
    const { GET } = await import('@/app/api/version/route');
    
    const response = await GET();
    const cacheControl = response.headers.get('Cache-Control');
    
    expect(cacheControl).toContain('public');
    expect(cacheControl).toContain('s-maxage=300');
    expect(cacheControl).toContain('stale-while-revalidate=600');
  });
});

