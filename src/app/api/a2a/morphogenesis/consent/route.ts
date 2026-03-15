/**
 * POST /api/a2a/morphogenesis/consent — Consent to or reject a morph operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { consentToMorph, consentMorphSchema } from '@/lib/a2a/morphogenesis';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = consentMorphSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { event_id, consent, reason } = parsed.data;
    const result = consentToMorph(event_id, agent.id, consent, reason);

    return NextResponse.json({
      event: result.event,
      all_consented: result.all_consented,
    }, { status: 200 });
  } catch (err) {
    console.error('[a2a/morphogenesis/consent] POST error:', err);
    return NextResponse.json(safeErrorBody(err, 'unknown', 'POST /api/a2a/morphogenesis/consent'), { status: 500 });
  }
}
