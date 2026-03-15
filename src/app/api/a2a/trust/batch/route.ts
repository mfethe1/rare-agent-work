/**
 * POST /api/a2a/trust/batch — Process multiple trust signals at once
 */
import { NextRequest, NextResponse } from 'next/server';
import { evaluateBatch, batchTrustSignalSchema } from '@/lib/a2a/trust';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = batchTrustSignalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid batch signal', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const results = evaluateBatch(parsed.data.signals);
  return NextResponse.json({ results, count: results.length });
}
