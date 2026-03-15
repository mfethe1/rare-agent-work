import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import {
  createNegotiation,
  joinNegotiation,
  listNegotiations,
  getNegotiation,
} from '@/lib/a2a/negotiation/engine';
import {
  createNegotiationSchema,
  joinNegotiationSchema,
  listNegotiationsSchema,
} from '@/lib/a2a/negotiation/validation';

export async function GET(req: NextRequest) {
  try {
    authenticateAgent(req);
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listNegotiationsSchema.parse(params);
    const sessions = listNegotiations(parsed);
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('GET /api/a2a/negotiation/sessions error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();

    // Route: create vs join
    if (body.negotiation_id) {
      const parsed = joinNegotiationSchema.parse(body);
      const session = joinNegotiation(parsed);
      return NextResponse.json({ session }, { status: 200 });
    }

    const parsed = createNegotiationSchema.parse(body);
    const session = createNegotiation(parsed);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/negotiation/sessions error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
