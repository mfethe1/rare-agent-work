import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { searchGenomes } from '@/lib/a2a/agent-genome/engine';
import { searchGenomesSchema } from '@/lib/a2a/agent-genome/validation';

/** GET /api/a2a/genome/search — Search the genome registry */
export async function GET(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const parsed = searchGenomesSchema.parse({
      query: searchParams.get('query') ?? undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) ?? undefined,
      author: searchParams.get('author') ?? undefined,
      capabilityId: searchParams.get('capabilityId') ?? undefined,
      minFitness: searchParams.get('minFitness') ? parseFloat(searchParams.get('minFitness')!) : undefined,
      verificationStatus: searchParams.get('verificationStatus') ?? undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    });
    const result = searchGenomes(parsed);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
