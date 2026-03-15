import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  bulkheadCreateSchema,
  createBulkheadPartition,
  acquireBulkheadSlot,
  releaseBulkheadSlot,
} from '@/lib/a2a/mesh';

/**
 * POST /api/a2a/mesh/bulkheads — Create a bulkhead partition.
 *
 * Bulkheads limit how much capacity a single consumer can consume from
 * a provider agent, preventing noisy-neighbor problems in multi-tenant
 * agent ecosystems.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = bulkheadCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Only the provider agent or partner-level agents can create partitions
    if (parsed.data.provider_agent_id !== agent.id && agent.trust_level !== 'partner') {
      return NextResponse.json(
        { error: 'Only the provider agent or partner-level agents can create bulkhead partitions.' },
        { status: 403 },
      );
    }

    const result = await createBulkheadPartition(parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/mesh/bulkheads'), { status: 500 });
  }
}
