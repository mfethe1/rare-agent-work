/**
 * GET /api/a2a/protocol-bridge/compatibility — Get the protocol compatibility matrix
 */
import { NextResponse } from 'next/server';
import { getCompatibilityMatrix } from '@/lib/a2a/protocol-bridge';

export async function GET() {
  const result = getCompatibilityMatrix();
  return NextResponse.json(result);
}
