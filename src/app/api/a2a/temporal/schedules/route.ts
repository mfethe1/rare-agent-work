/**
 * POST /api/a2a/temporal/schedules — Create a temporal schedule with critical-path analysis
 * GET  /api/a2a/temporal/schedules?schedule_id=X — Get schedule status and risks
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { createSchedule, detectScheduleRisks } from '@/lib/a2a/temporal';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, participants, milestones } = body;

    if (!name || !participants || !milestones) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'name, participants, and milestones are required' },
        { status: 400 },
      );
    }

    const schedule = createSchedule({ name, participants, milestones });
    const risks = detectScheduleRisks(schedule);

    return NextResponse.json({ schedule, risks }, { status: 201 });
  } catch (err) {
    console.error('[a2a/temporal/schedules] POST error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduleId = req.nextUrl.searchParams.get('schedule_id');
    if (!scheduleId) {
      return NextResponse.json({ error: 'schedule_id query parameter required' }, { status: 400 });
    }

    // In production, fetch from persistent storage
    return NextResponse.json({
      message: 'Schedule retrieval requires persistent storage backend',
      scheduleId,
    });
  } catch (err) {
    console.error('[a2a/temporal/schedules] GET error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
