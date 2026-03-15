import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getCampaign } from '@/lib/a2a/sandbox/engine';

/**
 * GET /api/a2a/sandbox/campaigns/:id — Get campaign details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    console.error('GET /api/a2a/sandbox/campaigns/:id error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
