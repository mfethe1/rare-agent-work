import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  scheduleNext,
  getSchedulerState,
  configureScheduler,
} from '@/lib/a2a/runtime-kernel/engine';
import { configureSchedulerSchema } from '@/lib/a2a/runtime-kernel/validation';

/** POST /api/a2a/kernel/scheduler — Schedule, get state, or configure scheduler */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'schedule': {
        const decision = scheduleNext();
        return NextResponse.json({ decision });
      }
      case 'state': {
        const state = getSchedulerState();
        return NextResponse.json({ scheduler: state });
      }
      case 'configure': {
        const parsed = configureSchedulerSchema.parse(body.config ?? {});
        const config = configureScheduler(parsed);
        return NextResponse.json({ config });
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: schedule, state, configure` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
