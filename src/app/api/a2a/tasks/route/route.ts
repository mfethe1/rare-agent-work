import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-validation';
import { safeErrorBody } from '@/lib/api-errors';
import {
  authenticateAgent,
  taskRouteSchema,
  getServiceDb,
} from '@/lib/a2a';
import { routeTask, fetchRoutingCandidatesWithReputation } from '@/lib/a2a/router';
import type { TaskRouteResponse } from '@/lib/a2a';
import { emitEvent } from '@/lib/a2a/webhooks';
import { checkRateLimit, rateLimitHeaders, rateLimitBody } from '@/lib/a2a/rate-limiter';

/**
 * POST /api/a2a/tasks/route — Capability-based task routing.
 *
 * Instead of specifying a target_agent_id, the caller describes what
 * capability they need. The platform scores all registered agents,
 * selects the best match(es) based on the routing policy, and creates
 * task(s) assigned to the selected agent(s).
 *
 * Rate-limited per agent based on trust level.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid or missing agent API key.' },
      { status: 401 },
    );
  }

  // Rate limit check
  const rl = await checkRateLimit(agent.id, agent.trust_level, 'task.route');
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitBody('task.route', rl),
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const parsed = await validateRequest(request, taskRouteSchema);
  if (!parsed.success) return parsed.response;

  const {
    required_capability,
    input,
    policy,
    max_targets,
    priority,
    correlation_id,
    ttl_seconds,
  } = parsed.data;

  const db = getServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      { status: 503 },
    );
  }

  try {
    // Fetch candidate agents with reputation data pre-loaded
    const { candidates, trustBlender } = await fetchRoutingCandidatesWithReputation(required_capability);

    // Run the routing algorithm with reputation-aware scoring
    const routing = routeTask(
      candidates,
      required_capability,
      policy,
      max_targets,
      [agent.id], // Exclude the sender from routing
      trustBlender,
    );

    if (!routing.matched || routing.selected.length === 0) {
      return NextResponse.json(
        {
          error: 'No agents found matching the required capability.',
          routing: {
            required_capability,
            policy,
            candidates_evaluated: routing.candidates_evaluated,
            reason: routing.reason,
          },
        },
        { status: 404 },
      );
    }

    const baseUrl = new URL(request.url).origin;
    const taskIds: string[] = [];

    // Create a task for each selected agent
    for (const selected of routing.selected) {
      const { data: task, error: insertError } = await db
        .from('a2a_tasks')
        .insert({
          sender_agent_id: agent.id,
          target_agent_id: selected.agent_id,
          intent: required_capability,
          priority,
          status: 'accepted',
          input,
          correlation_id: correlation_id ?? null,
          ttl_seconds,
          routing_metadata: {
            routed: true,
            policy,
            required_capability,
            composite_score: selected.composite_score,
            matched_capability: selected.matched_capability,
            capability_match: selected.capability_match,
            trust_score: selected.trust_score,
            recency_score: selected.recency_score,
            candidates_evaluated: routing.candidates_evaluated,
          },
        })
        .select('id, created_at')
        .single();

      if (insertError || !task) {
        console.error('[A2A Router] Failed to create routed task:', insertError);
        continue;
      }

      taskIds.push(task.id);

      // Notify the target agent
      emitEvent(
        'task.assigned',
        {
          task_id: task.id,
          intent: required_capability,
          sender_agent_id: agent.id,
          target_agent_id: selected.agent_id,
          priority,
          input,
          correlation_id: correlation_id ?? null,
          status_url: `${baseUrl}/api/a2a/tasks/${task.id}`,
          routed: true,
          routing_score: selected.composite_score,
          matched_capability: selected.matched_capability,
        },
        selected.agent_id,
      );
    }

    if (taskIds.length === 0) {
      return NextResponse.json(
        safeErrorBody(new Error('Task creation failed'), 'db', 'POST /api/a2a/tasks/route'),
        { status: 500 },
      );
    }

    // Emit a routing event for observability
    emitEvent('task.routed', {
      task_ids: taskIds,
      required_capability,
      policy,
      sender_agent_id: agent.id,
      selected_agents: routing.selected.map((s) => ({
        agent_id: s.agent_id,
        score: s.composite_score,
      })),
      candidates_evaluated: routing.candidates_evaluated,
      correlation_id: correlation_id ?? null,
    });

    const response: TaskRouteResponse = {
      task_ids: taskIds,
      routing,
      status_url_template: `${baseUrl}/api/a2a/tasks/{id}`,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      safeErrorBody(err, 'db', 'POST /api/a2a/tasks/route'),
      { status: 500 },
    );
  }
}
