/**
 * GET /api/a2a/protocol-bridge/adapters/:id — Get adapter by ID
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '@/lib/a2a/protocol-bridge';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const adapter = getAdapter(id);

  if (!adapter) {
    return NextResponse.json(
      { error: 'Adapter not found', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  return NextResponse.json({ adapter });
}
