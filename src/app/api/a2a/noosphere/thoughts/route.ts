import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { contributeThought } from '@/lib/a2a/noosphere/engine';
import { contributeThoughtSchema } from '@/lib/a2a/noosphere/validation';

/** POST /api/a2a/noosphere/thoughts — Contribute a thought to a cognitive session */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = contributeThoughtSchema.parse(body);
    const result = contributeThought(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
