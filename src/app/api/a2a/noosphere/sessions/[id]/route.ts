import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getSessionState, concludeSession, dissolveSession } from '@/lib/a2a/noosphere/engine';
import { concludeSessionSchema } from '@/lib/a2a/noosphere/validation';

/** GET /api/a2a/noosphere/sessions/:id — Get full session state */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const result = getSessionState({ sessionId: id });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Session not found';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

/** POST /api/a2a/noosphere/sessions/:id — Conclude or dissolve session */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await req.json();

    if (body.action === 'dissolve') {
      const result = dissolveSession(id, body.reason ?? 'No reason provided');
      return NextResponse.json({ session: result });
    }

    const parsed = concludeSessionSchema.parse({ ...body, sessionId: id });
    const result = concludeSession(parsed);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
