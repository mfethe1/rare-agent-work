import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { intentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import { searchIntentsSchema } from '@/lib/a2a/intent-discovery/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();
    const parsed = searchIntentsSchema.parse(body);
    const result = intentDiscoveryEngine.searchIntents(parsed);
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/a2a/intent-discovery/search error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
