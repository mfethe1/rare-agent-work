/**
 * POST /api/a2a/autonomic/healing — Propose or trigger a healing action
 * GET  /api/a2a/autonomic/healing — List healing actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { triggerHealingSchema } from '@/lib/a2a/autonomic';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = triggerHealingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    // Propose healing action
    const action = {
      id: `heal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: parsed.data.action_type,
      target_agent_id: parsed.data.target_agent_id,
      reason: parsed.data.reason,
      status: 'proposed',
      auto_approved: false,
      priority: 5,
      created_at: Date.now(),
    };

    return NextResponse.json(action, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/autonomic/healing error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = req.nextUrl.searchParams.get('status');

    return NextResponse.json({
      actions: [],
      filters: { status: status || 'all' },
      total: 0,
    });
  } catch (err) {
    console.error('GET /api/a2a/autonomic/healing error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
