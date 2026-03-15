import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getPackageDetail } from '@/lib/a2a/marketplace';

/**
 * GET /api/a2a/marketplace/packages/:id — Get package detail with versions & reviews.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const detail = await getPackageDetail(id);

    if (!detail) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (err) {
    console.error('[marketplace/detail]', err);
    return NextResponse.json(safeErrorBody(err), { status: 500 });
  }
}
