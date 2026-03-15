import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  createContinuitySession,
  listContinuitySessions,
  getContinuitySession,
  updateContinuitySession,
  resumeContinuitySession,
  CreateContinuitySessionSchema,
  UpdateContinuitySessionSchema,
} from '@/lib/a2a/memory';

/**
 * POST /api/a2a/memory/sessions — Create a new continuity session
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const rl = checkRateLimit(agent.id, agent.trust_level ?? 'untrusted', 'task.submit');
  if (!rl.allowed) {
    return NextResponse.json(rateLimitBody(rl), { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const body = await request.json();
    const parsed = CreateContinuitySessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { name, initialContext } = parsed.data;
    const session = createContinuitySession(agent.id, name, initialContext);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/memory/sessions error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/memory/sessions?status=...&id=...
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const session = getContinuitySession(id);
      if (!session || session.agentId !== agent.id) {
        return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
      }
      return NextResponse.json({ session });
    }

    const status = searchParams.get('status') as 'active' | 'suspended' | 'completed' | null;
    const agentSessions = listContinuitySessions(agent.id, status ?? undefined);
    return NextResponse.json({ sessions: agentSessions });
  } catch (err) {
    console.error('GET /api/a2a/memory/sessions error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * PATCH /api/a2a/memory/sessions?id=... — Update or resume a session
 */
export async function PATCH(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Session ID required.' }, { status: 400 });
    }

    const body = await request.json();

    // If body contains { resume: true }, resume the session
    if (body.resume) {
      const result = resumeContinuitySession(id, agent.id, body.recentCount ?? 10);
      return NextResponse.json(result);
    }

    const parsed = UpdateContinuitySessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const session = updateContinuitySession(id, agent.id, parsed.data);
    return NextResponse.json({ session });
  } catch (err) {
    console.error('PATCH /api/a2a/memory/sessions error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
