import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getKernelStatus, getKernelMetrics } from '@/lib/a2a/runtime-kernel/engine';

/** GET /api/a2a/kernel/status — Get kernel status and metrics */
export async function GET(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const includeMetrics = url.searchParams.get('metrics') === 'true';

    const status = getKernelStatus();

    if (includeMetrics) {
      const metrics = getKernelMetrics();
      return NextResponse.json({ ...status, ...metrics });
    }

    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
