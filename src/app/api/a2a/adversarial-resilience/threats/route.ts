/**
 * POST /api/a2a/adversarial-resilience/threats — Report a new threat
 * GET  /api/a2a/adversarial-resilience/threats — List active threats
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  reportThreat,
  getActiveThreats,
  reportThreatSchema,
} from '@/lib/a2a/adversarial-resilience';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = reportThreatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = reportThreat(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') as Parameters<typeof getActiveThreats>[0]['category'] | undefined;
    const min_severity = url.searchParams.get('min_severity') as Parameters<typeof getActiveThreats>[0]['min_severity'] | undefined;
    const agent_id = url.searchParams.get('agent_id') ?? undefined;
    const threats = getActiveThreats({ category: category ?? undefined, min_severity: min_severity ?? undefined, agent_id });
    return NextResponse.json({ threats, total: threats.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
