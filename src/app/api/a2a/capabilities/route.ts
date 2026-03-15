import { NextResponse } from 'next/server';
import { listPlatformIntents } from '@/lib/a2a';
import { getServiceDb } from '@/lib/a2a';

/**
 * GET /api/a2a/capabilities — Discover platform capabilities.
 *
 * Public endpoint (no auth required). Lists all supported task intents
 * and their input schemas so agents can self-configure.
 */
export async function GET() {
  const intents = listPlatformIntents();

  // Count active registered agents (best-effort)
  let registeredAgents = 0;
  const db = getServiceDb();
  if (db) {
    const { count } = await db
      .from('agent_registry')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    registeredAgents = count ?? 0;
  }

  return NextResponse.json({
    platform: 'rareagent.work',
    version: '1.0.0',
    intents,
    registered_agents: registeredAgents,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
