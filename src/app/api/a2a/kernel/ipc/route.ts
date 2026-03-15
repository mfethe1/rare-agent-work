import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  createIpcChannel,
  sendIpcMessage,
  receiveIpcMessages,
} from '@/lib/a2a/runtime-kernel/engine';
import {
  createIpcChannelSchema,
  sendIpcMessageSchema,
  receiveIpcMessageSchema,
} from '@/lib/a2a/runtime-kernel/validation';

/** POST /api/a2a/kernel/ipc — Create channels, send/receive messages */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'create_channel': {
        const parsed = createIpcChannelSchema.parse(body);
        const result = createIpcChannel(parsed);
        return NextResponse.json(result, { status: 201 });
      }
      case 'send': {
        const parsed = sendIpcMessageSchema.parse(body);
        const result = sendIpcMessage(parsed);
        return NextResponse.json(result);
      }
      case 'receive': {
        const parsed = receiveIpcMessageSchema.parse(body);
        const result = receiveIpcMessages(parsed);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: create_channel, send, receive` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
