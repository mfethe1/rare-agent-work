import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { generateCounterOffer } from '@/lib/a2a/negotiation/engine';
import { generateCounterOfferSchema } from '@/lib/a2a/negotiation/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = generateCounterOfferSchema.parse(body);
    const offer = generateCounterOffer(parsed);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/negotiation/counter error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
