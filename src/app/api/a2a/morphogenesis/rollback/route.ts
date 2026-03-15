/**
 * POST /api/a2a/morphogenesis/rollback — Rollback a completed morph operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { rollbackMorph, rollbackMorphSchema } from '@/lib/a2a/morphogenesis';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = rollbackMorphSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const result = rollbackMorph(parsed.data.event_id, parsed.data.reason);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/rollback] POST error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'POST /api/a2a/morphogenesis/rollback'), { status: 500 });
  }
}
