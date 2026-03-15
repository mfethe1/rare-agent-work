import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  spawnProcess,
  killProcess,
  suspendProcess,
  resumeProcess,
  listProcesses,
} from '@/lib/a2a/runtime-kernel/engine';
import {
  spawnProcessSchema,
  killProcessSchema,
  suspendProcessSchema,
  resumeProcessSchema,
  listProcessesSchema,
} from '@/lib/a2a/runtime-kernel/validation';

/** POST /api/a2a/kernel/processes — Spawn, kill, suspend, resume, or list processes */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'spawn': {
        const parsed = spawnProcessSchema.parse(body);
        const result = spawnProcess(parsed);
        return NextResponse.json(result, { status: 201 });
      }
      case 'kill': {
        const parsed = killProcessSchema.parse(body);
        const result = killProcess(parsed);
        return NextResponse.json(result);
      }
      case 'suspend': {
        const parsed = suspendProcessSchema.parse(body);
        const result = suspendProcess(parsed);
        return NextResponse.json(result);
      }
      case 'resume': {
        const parsed = resumeProcessSchema.parse(body);
        const result = resumeProcess(parsed);
        return NextResponse.json(result);
      }
      case 'list': {
        const parsed = listProcessesSchema.parse(body);
        const result = listProcesses(parsed);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: spawn, kill, suspend, resume, list` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
