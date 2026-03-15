import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { analyzeParetoEfficiency } from '@/lib/a2a/negotiation/engine';
import { paretoAnalysisSchema } from '@/lib/a2a/negotiation/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = paretoAnalysisSchema.parse(body);
    const analysis = analyzeParetoEfficiency(parsed.negotiation_id, parsed.offer_id);
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error('POST /api/a2a/negotiation/pareto error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
