import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const runtime = 'nodejs';

/**
 * GET /api/version
 * 
 * Detailed version endpoint for production verification.
 * Returns deployment SHA, commit timestamp, and pricing offer map.
 */
export async function GET() {
  // Get deployment SHA from environment (Railway or Vercel) or local git
  let commitSha = 
    process.env.RAILWAY_GIT_COMMIT_SHA || 
    process.env.VERCEL_GIT_COMMIT_SHA || 
    null;
  
  let commitTimestamp: string | null = null;
  
  // If no env var, try to get from local git
  if (!commitSha) {
    try {
      commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      commitSha = 'unknown';
    }
  }
  
  // Get commit timestamp
  if (commitSha && commitSha !== 'unknown') {
    try {
      // Try to get timestamp from git
      commitTimestamp = execSync(`git show -s --format=%cI ${commitSha}`, { 
        encoding: 'utf8' 
      }).trim();
    } catch {
      // If git command fails, use current time as fallback
      commitTimestamp = null;
    }
  }
  
  // Pricing offer map - matches the tier structure in cost-gate.ts and stripe checkout
  const offerMap = {
    free: {
      label: 'Free Access',
      price: '$0',
      tier: 'free',
      features: [
        'Model leaderboard access',
        'Curated news feed',
        'Report previews',
        'AI chat (10 requests/day, $2/week)',
      ],
    },
    newsletter: {
      label: 'Newsletter',
      price: '$10/mo',
      tier: 'newsletter',
      features: [
        'Weekly premium newsletter',
        'Hot-news alerts',
        'AI context on news desk',
        'No paywall on news pages',
        'AI chat (40 requests/day, $6/week)',
      ],
    },
    starter: {
      label: 'Starter',
      price: '$29/mo',
      tier: 'starter',
      features: [
        'Everything in Newsletter',
        'Full access to all research reports',
        'Rolling updates',
        'AI implementation guide (100 requests/day, $15/week)',
        'Access to new research on publish',
      ],
    },
    pro: {
      label: 'Operator Access',
      price: '$49/mo',
      tier: 'pro',
      features: [
        'Everything in Starter',
        '5x higher AI token budget (500 requests/day, $60/week)',
        'Priority access to new research',
        'Best support path for urgent implementation work',
      ],
    },
    reports: {
      label: 'One-Time Reports',
      options: [
        {
          slug: 'agent-setup-60',
          title: 'Agent Setup in 60 Minutes',
          price: '$29',
          planKey: 'report_60',
        },
        {
          slug: 'single-to-multi-agent',
          title: 'From Single Agent to Multi-Agent',
          price: '$79',
          planKey: 'report_multi',
        },
        {
          slug: 'empirical-agent-architecture',
          title: 'Agent Architecture Empirical Research',
          price: '$299',
          planKey: 'report_empirical',
        },
        {
          slug: 'mcp-security',
          title: 'MCP Security: Protecting Agents from Tool Poisoning',
          price: '$149',
          planKey: 'report_mcp',
        },
        {
          slug: 'agent-incident-postmortems',
          title: 'Production Agent Incidents: Real Post-Mortems',
          price: '$149',
          planKey: 'report_incidents',
        },
      ],
    },
  };
  
  return NextResponse.json(
    {
      version: '1.0.0',
      deployment: {
        commit: commitSha,
        timestamp: commitTimestamp,
        platform: process.env.RAILWAY_GIT_COMMIT_SHA ? 'railway' : 
                  process.env.VERCEL_GIT_COMMIT_SHA ? 'vercel' : 'local',
      },
      offers: offerMap,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
      },
    }
  );
}

