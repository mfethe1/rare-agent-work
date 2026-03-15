import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { listInstalledSchema, listInstalled } from '@/lib/a2a/marketplace';

/**
 * GET /api/a2a/marketplace/installed — List packages installed by the authenticated agent.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const raw: Record<string, unknown> = {};
    const status = url.searchParams.get('status');
    if (status) raw.status = status;
    for (const key of ['limit', 'offset']) {
      const v = url.searchParams.get(key);
      if (v) raw[key] = Number(v);
    }

    const input = listInstalledSchema.parse(raw);
    const result = await listInstalled(agent.id, input.status, input.limit, input.offset);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[marketplace/installed]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
