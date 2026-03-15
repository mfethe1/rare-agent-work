import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import { createBank, listBanks, CreateBankSchema } from '@/lib/a2a/memory';

/**
 * POST /api/a2a/memory/banks — Create a memory bank
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
    const parsed = CreateBankSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { name, description, retention, tags } = parsed.data;
    const bank = createBank(agent.id, name, description, retention, tags);
    return NextResponse.json({ bank }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/memory/banks error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/memory/banks — List memory banks for the authenticated agent
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const agentBanks = listBanks(agent.id);
    return NextResponse.json({ banks: agentBanks });
  } catch (err) {
    console.error('GET /api/a2a/memory/banks error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
