import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { resolveDepsSchema, resolveDependencies } from '@/lib/a2a/marketplace';

/**
 * POST /api/a2a/marketplace/resolve — Resolve dependency tree for a package.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = resolveDepsSchema.parse(body);

    const resolution = await resolveDependencies(
      input.package_name,
      input.version,
      agent.id,
    );

    return NextResponse.json({ resolution });
  } catch (err) {
    console.error('[marketplace/resolve]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
