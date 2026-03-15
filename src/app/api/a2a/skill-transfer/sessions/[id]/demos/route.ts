import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  recordDemoSchema,
  recordDemonstration,
  getDemonstrations,
} from '@/lib/a2a/skill-transfer';

/**
 * GET /api/a2a/skill-transfer/sessions/:id/demos — List demonstrations.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const demos = getDemonstrations(id);
    return NextResponse.json({ demonstrations: demos });
  } catch (err) {
    console.error('[skill-transfer/sessions/demos/list]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

/**
 * POST /api/a2a/skill-transfer/sessions/:id/demos — Record a demonstration.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const input = recordDemoSchema.parse(body);
    const demo = recordDemonstration(id, input);
    return NextResponse.json({ demonstration: demo }, { status: 201 });
  } catch (err) {
    console.error('[skill-transfer/sessions/demos/record]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
