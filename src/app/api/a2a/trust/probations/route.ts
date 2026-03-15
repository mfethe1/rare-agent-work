/**
 * POST /api/a2a/trust/probations/resolve — Resolve all expired probation periods
 */
import { NextResponse } from 'next/server';
import { resolveExpiredProbations } from '@/lib/a2a/trust';

export async function POST() {
  const events = resolveExpiredProbations();
  return NextResponse.json({
    resolved: events.length,
    events,
  });
}
