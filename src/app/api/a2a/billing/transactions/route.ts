import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { transactionListSchema, listTransactions } from '@/lib/a2a/billing';

/**
 * GET /api/a2a/billing/transactions — List the agent's ledger transactions.
 *
 * Query params: type, status, contract_id, limit, offset
 * Returns paginated transaction history.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const params = {
    type: url.searchParams.get('type') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    contract_id: url.searchParams.get('contract_id') ?? undefined,
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
    offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : 0,
  };

  const parseResult = transactionListSchema.safeParse(params);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await listTransactions({ agent_id: agent.id, input: parseResult.data });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/billing/transactions'), { status: 500 });
  }
}
