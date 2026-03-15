import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { signAgreement, getAgreement } from '@/lib/a2a/negotiation/engine';
import { signAgreementSchema } from '@/lib/a2a/negotiation/validation';

export async function GET(req: NextRequest) {
  try {
    authenticateAgent(req);
    const negotiation_id = req.nextUrl.searchParams.get('negotiation_id');
    if (!negotiation_id) {
      return NextResponse.json({ error: 'negotiation_id required' }, { status: 400 });
    }
    const agreement = getAgreement(negotiation_id);
    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }
    return NextResponse.json({ agreement });
  } catch (err) {
    console.error('GET /api/a2a/negotiation/agreement error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = signAgreementSchema.parse(body);
    const agreement = signAgreement(parsed);
    return NextResponse.json({ agreement });
  } catch (err) {
    console.error('POST /api/a2a/negotiation/agreement error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
