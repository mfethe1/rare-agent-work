import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { getLineage } from '@/lib/a2a/agent-genome/engine';
import { GenomeError } from '@/lib/a2a/agent-genome/engine';
import { getLineageSchema } from '@/lib/a2a/agent-genome/validation';

/** GET /api/a2a/genome/lineage — Get the evolution history for a genome lineage */
export async function GET(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const lineageId = searchParams.get('lineageId');
    const maxDepth = searchParams.get('maxDepth');

    const parsed = getLineageSchema.parse({
      lineageId,
      maxDepth: maxDepth ? parseInt(maxDepth, 10) : undefined,
    });
    const result = getLineage(parsed);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GenomeError) {
      const status = err.code === 'LINEAGE_NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
