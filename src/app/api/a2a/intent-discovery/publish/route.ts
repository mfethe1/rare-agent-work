import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { intentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import { publishIntentSchema } from '@/lib/a2a/intent-discovery/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = publishIntentSchema.parse(body);
    const intent = intentDiscoveryEngine.publishIntent(parsed);
    return NextResponse.json({ intent }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/intent-discovery/publish error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
