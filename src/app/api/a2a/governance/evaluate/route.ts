import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { evaluateActionSchema, evaluateAction } from '@/lib/a2a/governance';

/**
 * POST /api/a2a/governance/evaluate — Evaluate an action against governance policies.
 *
 * The authenticated agent asks whether a given action is permitted.
 * Returns allow, deny, or escalate with full reasoning.
 * If escalated, an escalation request is created automatically.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const parsed = await validateRequest(request, evaluateActionSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await evaluateAction(agent.id, parsed.data);
    if (!result) {
      return NextResponse.json({ error: 'Failed to evaluate action.' }, { status: 500 });
    }

    const status = result.evaluation.decision === 'deny' ? 403 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/governance/evaluate'), { status: 500 });
  }
}
