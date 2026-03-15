/**
 * POST /api/a2a/adversarial-resilience/integrity-proofs — Generate or verify integrity proof
 * GET  /api/a2a/adversarial-resilience/integrity-proofs — Get agent's proof chain
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  generateIntegrityProof,
  verifyIntegrityProof,
  getAgentProofChain,
  generateIntegrityProofSchema,
  verifyIntegrityProofSchema,
} from '@/lib/a2a/adversarial-resilience';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'generate';

    if (action === 'verify') {
      const parsed = verifyIntegrityProofSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const result = verifyIntegrityProof(parsed.data.proof_id, parsed.data.output_content);
      return NextResponse.json({ verification: result });
    }

    const parsed = generateIntegrityProofSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const result = generateIntegrityProof(parsed.data);
    return NextResponse.json({ proof: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agent_id');
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id query parameter required' }, { status: 400 });
    }
    const chain = getAgentProofChain(agentId);
    return NextResponse.json({ proofs: chain, chain_length: chain.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
