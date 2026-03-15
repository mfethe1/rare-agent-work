import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { getOrCreateWallet } from '@/lib/a2a/billing';

/**
 * GET /api/a2a/billing/wallet — Get the authenticated agent's wallet.
 *
 * Auto-creates a wallet on first access. Returns balance, held amount,
 * lifetime stats, and wallet status.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const currency = url.searchParams.get('currency') ?? 'credits';

  try {
    const wallet = await getOrCreateWallet(agent.id, currency);
    if (!wallet) {
      return NextResponse.json({ error: 'Failed to retrieve wallet.' }, { status: 500 });
    }

    return NextResponse.json({ wallet });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'GET /api/a2a/billing/wallet'), { status: 500 });
  }
}
