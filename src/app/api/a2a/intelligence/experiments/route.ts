import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  createExperiment,
  listExperiments,
  CreateExperimentSchema,
} from '@/lib/a2a/intelligence';

/**
 * POST /api/a2a/intelligence/experiments — Create a strategy A/B experiment
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CreateExperimentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { agentId, capability, name, hypothesis, controlStrategyId, candidateStrategyIds, minSampleSize } = parsed.data;
    const experiment = createExperiment(
      agentId, capability, name, hypothesis,
      controlStrategyId, candidateStrategyIds, minSampleSize
    );
    return NextResponse.json({ experiment }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/intelligence/experiments error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/intelligence/experiments?agentId=...
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') ?? agent.id;
    const experiments = listExperiments(agentId);
    return NextResponse.json({ experiments });
  } catch (err) {
    console.error('GET /api/a2a/intelligence/experiments error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
