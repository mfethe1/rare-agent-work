/**
 * POST /api/a2a/adversarial-resilience/quarantine — Quarantine an agent
 * GET  /api/a2a/adversarial-resilience/quarantine — List all quarantines
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  quarantineAgent,
  escalateQuarantine,
  releaseQuarantine,
  getAllQuarantines,
  quarantineAgentSchema,
  escalateQuarantineSchema,
  releaseQuarantineSchema,
} from '@/lib/a2a/adversarial-resilience';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'quarantine';

    if (action === 'escalate') {
      const parsed = escalateQuarantineSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const result = escalateQuarantine(parsed.data);
      return NextResponse.json({ quarantine: result });
    }

    if (action === 'release') {
      const parsed = releaseQuarantineSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const result = releaseQuarantine(parsed.data.agent_id, parsed.data.reason, parsed.data.shadow_monitor);
      return NextResponse.json({ quarantine: result });
    }

    const parsed = quarantineAgentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const result = quarantineAgent(parsed.data);
    return NextResponse.json({ quarantine: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const quarantines = getAllQuarantines();
    return NextResponse.json({ quarantines, total: quarantines.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
