import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';
import {
  planGoal,
  getGoal,
  getPlan,
  getSubGoals,
  getReplanHistory,
} from '@/lib/a2a/planner/engine';
import { SubmitGoalSchema } from '@/lib/a2a/planner/validation';
import type { OptimizationStrategy } from '@/lib/a2a/planner/types';

/**
 * POST /api/a2a/planner — Submit a goal for autonomous decomposition and planning.
 *
 * The planner decomposes the goal into sub-goals, maps them to agent capabilities,
 * generates an optimized execution plan, and returns it for approval or auto-execution.
 *
 * This is the "brain" of the A2A platform — agents express intent, and the platform
 * figures out the optimal multi-agent execution strategy.
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
    const parsed = SubmitGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request.', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Ensure the authenticated agent matches the requester
    if (data.requester_agent_id !== agent.id) {
      return NextResponse.json(
        { error: 'requester_agent_id must match authenticated agent.' },
        { status: 403 },
      );
    }

    const result = planGoal(data.requester_agent_id, data.objective, {
      constraints: data.constraints ?? {},
      context: data.context ?? {},
      priority: data.priority ?? 'normal',
      strategy: (data.strategy ?? 'balanced') as OptimizationStrategy,
    });

    return NextResponse.json({
      goal: result.goal,
      sub_goals: result.subGoals,
      capability_matches: result.matches,
      plan: result.plan,
    }, { status: 201 });
  } catch (err) {
    console.error('[A2A Planner] POST error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * GET /api/a2a/planner?goal_id=<id> — Retrieve a goal, its sub-goals, plan, and re-plan history.
 */
export async function GET(req: Request) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const goalId = url.searchParams.get('goal_id');
    if (!goalId) {
      return NextResponse.json({ error: 'goal_id query parameter required.' }, { status: 400 });
    }

    const goal = getGoal(goalId);
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found.' }, { status: 404 });
    }

    // Only the requester can view their goal
    if (goal.requester_agent_id !== agent.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const subGoals = getSubGoals(goalId);
    const plan = goal.plan_id ? getPlan(goal.plan_id) : null;
    const replanHistory = getReplanHistory(goalId);

    return NextResponse.json({
      goal,
      sub_goals: subGoals,
      plan,
      replan_history: replanHistory,
    });
  } catch (err) {
    console.error('[A2A Planner] GET error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
