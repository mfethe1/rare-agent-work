import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { diffGenomes } from '@/lib/a2a/agent-genome/engine';
import { GenomeError } from '@/lib/a2a/agent-genome/engine';
import { diffGenomesSchema } from '@/lib/a2a/agent-genome/validation';

/** POST /api/a2a/genome/diff — Compute semantic diff between two genomes */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = diffGenomesSchema.parse(body);
    const result = diffGenomes(parsed.fromHash, parsed.toHash);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GenomeError) {
      const status = err.code === 'GENOME_NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
