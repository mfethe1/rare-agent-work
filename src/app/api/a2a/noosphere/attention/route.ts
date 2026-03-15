import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { signalAttention } from '@/lib/a2a/noosphere/engine';
import { signalAttentionSchema } from '@/lib/a2a/noosphere/validation';

/** POST /api/a2a/noosphere/attention — Signal collective attention */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = signalAttentionSchema.parse(body);
    const result = signalAttention(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
