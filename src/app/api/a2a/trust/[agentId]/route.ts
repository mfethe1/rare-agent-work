/**
 * GET /api/a2a/trust/:agentId — Get agent trust profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { getProfile } from '@/lib/a2a/trust';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const profile = getProfile(agentId);

  if (!profile) {
    return NextResponse.json({ error: 'Trust profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}
