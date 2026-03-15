import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  registerSubsystem,
  listSubsystems,
  subsystemCall,
} from '@/lib/a2a/runtime-kernel/engine';
import {
  registerSubsystemSchema,
  subsystemCallSchema,
} from '@/lib/a2a/runtime-kernel/validation';

/** POST /api/a2a/kernel/subsystems — Register subsystems or make subsystem calls */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'register': {
        const parsed = registerSubsystemSchema.parse(body);
        const result = registerSubsystem(parsed);
        return NextResponse.json(result, { status: 201 });
      }
      case 'call': {
        const parsed = subsystemCallSchema.parse(body);
        const result = subsystemCall(parsed);
        return NextResponse.json(result);
      }
      case 'list': {
        const result = listSubsystems();
        return NextResponse.json({ subsystems: result });
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: register, call, list` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
