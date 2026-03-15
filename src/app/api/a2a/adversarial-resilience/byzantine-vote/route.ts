/**
 * POST /api/a2a/adversarial-resilience/byzantine-vote — Initiate BFT round, submit commitment, or reveal vote
 * GET  /api/a2a/adversarial-resilience/byzantine-vote — List active BFT rounds
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  initiateBFTRound,
  submitBFTVoteCommitment,
  revealBFTVote,
  getActiveBFTRounds,
  initiateBFTRoundSchema,
  submitBFTVoteSchema,
  revealBFTVoteSchema,
} from '@/lib/a2a/adversarial-resilience';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'initiate';

    if (action === 'commit') {
      const parsed = submitBFTVoteSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const result = submitBFTVoteCommitment(parsed.data);
      return NextResponse.json(result);
    }

    if (action === 'reveal') {
      const parsed = revealBFTVoteSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const result = revealBFTVote(parsed.data);
      return NextResponse.json(result);
    }

    const parsed = initiateBFTRoundSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const result = initiateBFTRound(parsed.data);
    return NextResponse.json({ round: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const rounds = getActiveBFTRounds();
    return NextResponse.json({ rounds, total: rounds.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
