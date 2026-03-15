import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  advancePlan,
  completeStep,
  failStep,
  createReplanContext,
  getPlan,
  getGoal,
  decomposeGoal,
  mapCapabilities,
  generatePlan,
  getSubGoals,
} from '@/lib/a2a/planner/engine';
import {
  CompleteStepSchema,
  FailStepSchema,
  ReplanSchema,
} from '@/lib/a2a/planner/validation';

/**
 * POST /api/a2a/planner/execute — Advance plan execution.
 *
 * Supports three actions:
 *   - action: "advance"  — Get ready steps and advance state machine
 *   - action: "complete" — Mark a step as completed with output
 *   - action: "fail"     — Mark a step as failed, trigger retry/fallback/replan
 */
export async function POST(req: Request) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.submit');
    if (!rl.allowed) {
      return NextResponse.json(rateLimitBody('task.submit', rl), {
        status: 429,
        headers: rateLimitHeaders(rl),
      });
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === 'advance') {
      const planId = body.plan_id;
      if (!planId) {
        return NextResponse.json({ error: 'plan_id required.' }, { status: 400 });
      }

      const result = advancePlan(planId);

      // If re-plan needed, auto-generate a new plan
      if (result.needs_replan) {
        const replanCtx = createReplanContext(planId, result.needs_replan);
        if (replanCtx) {
          const plan = getPlan(planId);
          if (plan) {
            const goal = getGoal(plan.goal_id);
            if (goal) {
              const sgs = getSubGoals(goal.id);
              const matches = mapCapabilities(sgs, [
                ...goal.constraints.excluded_agent_ids,
                ...replanCtx.blacklisted_agent_ids,
              ]);
              const newPlan = generatePlan(goal.id, sgs, matches, 'balanced', replanCtx);
              return NextResponse.json({
                ...result,
                replanned: true,
                new_plan: newPlan,
              });
            }
          }
        }
        return NextResponse.json({ ...result, replanned: false, replan_exhausted: true });
      }

      return NextResponse.json(result);
    }

    if (action === 'complete') {
      const parsed = CompleteStepSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request.', details: parsed.error.issues },
          { status: 400 },
        );
      }
      completeStep(parsed.data.plan_id, parsed.data.step_id, parsed.data.output);
      return NextResponse.json({ ok: true, step_id: parsed.data.step_id, status: 'succeeded' });
    }

    if (action === 'fail') {
      const parsed = FailStepSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request.', details: parsed.error.issues },
          { status: 400 },
        );
      }
      const result = failStep(parsed.data.plan_id, parsed.data.step_id, parsed.data.error);
      return NextResponse.json({ ok: true, step_id: parsed.data.step_id, ...result });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use "advance", "complete", or "fail".' },
      { status: 400 },
    );
  } catch (err) {
    console.error('[A2A Planner Execute] POST error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
