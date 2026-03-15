import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { recommendStrategies, RecommendSchema } from '@/lib/a2a/intelligence';

/**
 * POST /api/a2a/intelligence/recommend — Get strategy recommendations
 *
 * The core intelligence endpoint: given a capability and context,
 * returns ranked strategies based on historical performance, context
 * similarity, trend analysis, and shared ecosystem insights.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = RecommendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { agentId, capability, context, topK } = parsed.data;
    const recommendations = recommendStrategies(agentId, capability, context ?? {}, topK ?? 3);
    return NextResponse.json({ recommendations });
  } catch (err) {
    console.error('POST /api/a2a/intelligence/recommend error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
