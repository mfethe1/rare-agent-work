import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { endorseThought } from '@/lib/a2a/noosphere/engine';
import { endorseThoughtSchema } from '@/lib/a2a/noosphere/validation';

/** POST /api/a2a/noosphere/thoughts/:id/endorse — Endorse or challenge a thought */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = endorseThoughtSchema.parse({ ...body, thoughtId: id });
    const result = endorseThought(parsed);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
