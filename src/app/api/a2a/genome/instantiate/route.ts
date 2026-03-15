import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { instantiateGenome } from '@/lib/a2a/agent-genome/engine';
import { GenomeError } from '@/lib/a2a/agent-genome/engine';
import { instantiateGenomeSchema } from '@/lib/a2a/agent-genome/validation';

/** POST /api/a2a/genome/instantiate — Instantiate a genome into a running process */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = instantiateGenomeSchema.parse(body);
    const result = instantiateGenome(parsed);
    const status = result.success ? 201 : 422;
    return NextResponse.json(result, { status });
  } catch (err) {
    if (err instanceof GenomeError) {
      const status = err.code === 'GENOME_NOT_FOUND' ? 404
        : err.code === 'PREFLIGHT_FAILED' ? 422
        : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
