import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { registerGenome, getGenome, getLatestGenome, getGenomeByVersion, getRegistryStats } from '@/lib/a2a/agent-genome/engine';
import { registerGenomeSchema, getGenomeSchema } from '@/lib/a2a/agent-genome/validation';
import { GenomeError } from '@/lib/a2a/agent-genome/engine';

/** POST /api/a2a/genome/registry — Register a new genome */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = registerGenomeSchema.parse(body);
    const result = registerGenome(parsed.genome);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof GenomeError) {
      const status = err.code === 'GENOME_ALREADY_EXISTS' ? 409
        : err.code === 'HASH_MISMATCH' ? 422
        : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** GET /api/a2a/genome/registry — Get a genome or registry stats */
export async function GET(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const hash = searchParams.get('hash');
    const lineageId = searchParams.get('lineageId');
    const version = searchParams.get('version');

    // If no params, return registry stats
    if (!hash && !lineageId) {
      return NextResponse.json(getRegistryStats());
    }

    if (hash) {
      return NextResponse.json(getGenome(hash));
    }

    if (lineageId && version) {
      return NextResponse.json(getGenomeByVersion(lineageId, version));
    }

    if (lineageId) {
      return NextResponse.json(getLatestGenome(lineageId));
    }

    return NextResponse.json({ error: 'Provide hash or lineageId' }, { status: 400 });
  } catch (err) {
    if (err instanceof GenomeError) {
      const status = err.code === 'GENOME_NOT_FOUND' || err.code === 'LINEAGE_NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
