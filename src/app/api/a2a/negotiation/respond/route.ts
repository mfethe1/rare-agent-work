import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { respondToOffer } from '@/lib/a2a/negotiation/engine';
import { respondToOfferSchema } from '@/lib/a2a/negotiation/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = respondToOfferSchema.parse(body);
    const session = respondToOffer(parsed);
    return NextResponse.json({ session });
  } catch (err) {
    console.error('POST /api/a2a/negotiation/respond error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
