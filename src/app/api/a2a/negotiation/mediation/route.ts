import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { triggerMediation } from '@/lib/a2a/negotiation/engine';
import { triggerMediationSchema } from '@/lib/a2a/negotiation/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = triggerMediationSchema.parse(body);
    const offer = triggerMediation(parsed);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/negotiation/mediation error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
