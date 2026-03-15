import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { createInvariant, listInvariants } from '@/lib/a2a/sandbox/engine';
import { createInvariantSchema, listInvariantsSchema } from '@/lib/a2a/sandbox/validation';

/**
 * POST /api/a2a/sandbox/invariants — Create a safety invariant
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
    const parsed = createInvariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await createInvariant(agent.id, parsed.data);
    if (!result) {
      return NextResponse.json(safeErrorBody(), { status: 500 });
    }

    return NextResponse.json({
      invariant_id: result.invariant_id,
      name: parsed.data.name,
      category: parsed.data.category,
      severity: parsed.data.severity,
      is_mandatory: parsed.data.is_mandatory,
      created_at: result.created_at,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/sandbox/invariants error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/sandbox/invariants — List safety invariants
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listInvariantsSchema.safeParse({
      category: searchParams.get('category') ?? undefined,
      severity: searchParams.get('severity') ?? undefined,
      is_mandatory: searchParams.has('is_mandatory') ? searchParams.get('is_mandatory') === 'true' : undefined,
      limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const invariants = await listInvariants(parsed.data);
    return NextResponse.json({ invariants, count: invariants.length });
  } catch (err) {
    console.error('GET /api/a2a/sandbox/invariants error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
