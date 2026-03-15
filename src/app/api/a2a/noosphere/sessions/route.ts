import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { createSession, joinSession } from '@/lib/a2a/noosphere/engine';
import { createSessionSchema, joinSessionSchema } from '@/lib/a2a/noosphere/validation';

/** POST /api/a2a/noosphere/sessions — Create a new cognitive session */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    // Check if this is a join request (has sessionId)
    if (body.sessionId) {
      const parsed = joinSessionSchema.parse(body);
      const result = joinSession(parsed);
      return NextResponse.json(result);
    }

    const parsed = createSessionSchema.parse(body);
    const result = createSession(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
