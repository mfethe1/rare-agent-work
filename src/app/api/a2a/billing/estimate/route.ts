import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { costEstimateSchema, computeCost } from '@/lib/a2a/billing';

/**
 * POST /api/a2a/billing/estimate — Estimate the cost of the next task under a contract.
 *
 * Computes cost based on the contract's pricing model (per_task, subscription,
 * tiered, free). For tiered pricing, uses the count of already-completed tasks
 * to determine the applicable tier.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const parsed = await validateRequest(request, costEstimateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const estimate = await computeCost(parsed.data.contract_id);
    if (!estimate) {
      return NextResponse.json({ error: 'Contract not found or cost computation failed.' }, { status: 404 });
    }

    return NextResponse.json({ estimate });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/billing/estimate'), { status: 500 });
  }
}
