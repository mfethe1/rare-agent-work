import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { requestCapability, checkCapability, revokeCapability } from '@/lib/a2a/runtime-kernel/engine';
import { requestCapabilitySchema } from '@/lib/a2a/runtime-kernel/validation';

/** POST /api/a2a/kernel/capabilities — Request, check, or revoke capabilities */
export async function POST(req: NextRequest) {
  const authError = await authenticateAgent(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'request': {
        const parsed = requestCapabilitySchema.parse(body);
        const result = requestCapability(parsed);
        return NextResponse.json(result, { status: result.granted ? 200 : 403 });
      }
      case 'check': {
        const { pid, scope, permission } = body;
        const result = checkCapability(pid, scope, permission);
        return NextResponse.json(result);
      }
      case 'revoke': {
        const { pid, capabilityId } = body;
        revokeCapability(pid, capabilityId);
        return NextResponse.json({ revoked: true });
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: request, check, revoke` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
