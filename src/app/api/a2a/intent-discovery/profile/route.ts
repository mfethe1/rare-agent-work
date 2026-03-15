import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { intentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import { getProfileSchema } from '@/lib/a2a/intent-discovery/validation';

export async function GET(req: NextRequest) {
  try {
    authenticateAgent(req);
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = getProfileSchema.parse(params);

    let profile = intentDiscoveryEngine.getSemanticProfile(parsed.agentId);
    if (!profile) {
      profile = intentDiscoveryEngine.buildSemanticProfile(parsed.agentId);
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error('GET /api/a2a/intent-discovery/profile error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
