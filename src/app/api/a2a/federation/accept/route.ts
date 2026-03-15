import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import {
  peerAcceptSchema,
  acceptPeering,
} from '@/lib/a2a/federation';

/**
 * POST /api/a2a/federation/accept — Accept an inbound peering request.
 *
 * This endpoint is called by remote platforms to establish federation.
 * It does not require agent authentication — it uses the peering
 * request's cryptographic signature for verification.
 */
export async function POST(request: Request) {
  // Verify service-role key for internal administration, OR
  // accept from remote platforms with valid peering signatures
  const serviceKey = request.headers.get('x-service-key');
  const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isService = serviceKey && expectedKey && serviceKey === expectedKey;

  // For remote platforms, we also accept requests with valid signatures
  // (signature verification happens inside acceptPeering)
  if (!isService) {
    // Allow remote platforms to call this endpoint
    // The acceptPeering function validates the handshake
  }

  const parsed = await validateRequest(request, peerAcceptSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await acceptPeering(parsed.data.peering_request);
    if (!result.accepted) {
      return NextResponse.json(
        { accepted: false, rejection_reason: result.rejection_reason },
        { status: 409 },
      );
    }
    return NextResponse.json({ accepted: true, peer: result.peer }, { status: 201 });
  } catch (err) {
    return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/a2a/federation/accept'), { status: 500 });
  }
}
