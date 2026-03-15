import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  createCurriculumSchema,
  searchCurriculaSchema,
  createCurriculum,
  listCurricula,
} from '@/lib/a2a/skill-transfer';

/**
 * GET /api/a2a/skill-transfer/curricula — Search published curricula.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const raw: Record<string, unknown> = {};
    for (const key of ['query', 'skill_name', 'difficulty']) {
      const v = url.searchParams.get(key);
      if (v) raw[key] = v;
    }
    for (const key of ['limit', 'offset', 'min_completion_rate']) {
      const v = url.searchParams.get(key);
      if (v) raw[key] = Number(v);
    }

    const params = searchCurriculaSchema.parse(raw);
    const result = listCurricula(params);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[skill-transfer/curricula/search]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

/**
 * POST /api/a2a/skill-transfer/curricula — Create a new curriculum.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = createCurriculumSchema.parse(body);
    const curriculum = createCurriculum(agent.id, input);
    return NextResponse.json({ curriculum }, { status: 201 });
  } catch (err) {
    console.error('[skill-transfer/curricula/create]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
