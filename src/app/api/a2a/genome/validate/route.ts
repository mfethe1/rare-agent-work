import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { validateGenome } from '@/lib/a2a/agent-genome/engine';
import { validateGenomeSchema } from '@/lib/a2a/agent-genome/validation';

/** POST /api/a2a/genome/validate — Validate a genome's semantic consistency */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = validateGenomeSchema.parse(body);
    const result = validateGenome(parsed.genome);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
