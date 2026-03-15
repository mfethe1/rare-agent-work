import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { createArtifact } from '@/lib/a2a/noosphere/engine';
import { createArtifactSchema } from '@/lib/a2a/noosphere/validation';

/** POST /api/a2a/noosphere/artifacts — Create a shared working memory artifact */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = createArtifactSchema.parse(body);
    const result = createArtifact(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
