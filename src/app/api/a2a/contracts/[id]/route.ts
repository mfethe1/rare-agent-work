import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  getContractDetail,
  checkCompliance,
  terminateContract,
  contractTerminateSchema,
} from '@/lib/a2a/contracts';
import { validateRequest } from '@/lib/api-validation';

/**
 * GET /api/a2a/contracts/:id — Get full contract details.
 *
 * Returns the contract, negotiation history, compliance metrics,
 * and any SLA violations. Triggers a compliance check for active contracts.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const detail = await getContractDetail(id, agent.id);
    if (!detail) {
      return NextResponse.json({ error: 'Contract not found.' }, { status: 404 });
    }

    // Run compliance check for active contracts
    if (detail.contract.status === 'active') {
      const compliance = await checkCompliance(id);
      if (compliance) {
        detail.contract.compliance = compliance;
      }
    }

    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/contracts/:id'), { status: 500 });
  }
}

/**
 * DELETE /api/a2a/contracts/:id — Terminate a contract early.
 *
 * Requires a reason in the request body. Either party can terminate.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const { id } = await params;

  const parsed = await validateRequest(request, contractTerminateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await terminateContract(id, agent.id, parsed.data.reason);
    if (!result.success) {
      const code = result.error === 'Contract not found' ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status: code });
    }

    return NextResponse.json({ contract_id: id, status: 'terminated' });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'DELETE /api/a2a/contracts/:id'), { status: 500 });
  }
}
