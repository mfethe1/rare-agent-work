import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import { validateRequest } from '@/lib/api-validation';
import { DetectSplitBrainSchema } from '@/lib/a2a/consensus/validation';
import { ConsensusEngine } from '@/lib/a2a/consensus/engine';

const engine = new ConsensusEngine();

/**
 * POST /api/a2a/consensus/split-brain/detect — Detect split-brain scenarios.
 *
 * Analyzes the current state of a council or proposal to determine if
 * conflicting decisions have been reached by partitioned agent groups.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  const parsed = await validateRequest(request, DetectSplitBrainSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await engine.detectSplitBrain(agent.id, parsed.data);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status_code });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/consensus/split-brain/detect'),
      { status: 500 },
    );
  }
}
