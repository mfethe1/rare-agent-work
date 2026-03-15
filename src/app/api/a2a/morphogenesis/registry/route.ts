/**
 * GET /api/a2a/morphogenesis/registry — Get the morphogenesis registry
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getMorphRegistry } from '@/lib/a2a/morphogenesis';
import { safeErrorBody } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const registry = getMorphRegistry();
    return NextResponse.json({ registry }, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/registry] GET error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'GET /api/a2a/morphogenesis/registry'), { status: 500 });
  }
}
