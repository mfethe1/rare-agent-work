import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { makeOffer } from '@/lib/a2a/negotiation/engine';
import { makeOfferSchema } from '@/lib/a2a/negotiation/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = makeOfferSchema.parse(body);
    const offer = makeOffer(parsed);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/negotiation/offers error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
