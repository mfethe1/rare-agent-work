/**
 * Temporal Scheduling & Coordination
 *
 * Critical-path analysis, temporal constraint satisfaction, and
 * multi-agent schedule coordination. Enables agents to plan
 * collaborative work across time with awareness of dependencies,
 * deadlines, and resource conflicts.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  TemporalSchedule,
  ScheduleParticipant,
  ScheduleMilestone,
  TemporalConstraint,
  TemporalPolicy,
  TemporalWindow,
  TemporalAnomaly,
} from './types';

// ---------------------------------------------------------------------------
// Schedule construction
// ---------------------------------------------------------------------------

export function createSchedule(params: {
  name: string;
  participants: ScheduleParticipant[];
  milestones: Omit<ScheduleMilestone, 'earliestStart' | 'latestFinish' | 'actualStart' | 'actualFinish' | 'status'>[];
}): TemporalSchedule {
  const now = new Date().toISOString();

  const milestones: ScheduleMilestone[] = params.milestones.map((m) => ({
    ...m,
    earliestStart: now,
    latestFinish: new Date(Date.now() + m.estimatedDuration * 10).toISOString(), // generous default
    actualStart: null,
    actualFinish: null,
    status: 'pending',
  }));

  const schedule: TemporalSchedule = {
    id: uuidv4(),
    name: params.name,
    participants: params.participants,
    milestones,
    criticalPath: [],
    totalDuration: 0,
    slack: {},
    status: 'planning',
    createdAt: now,
    updatedAt: now,
  };

  return computeCriticalPath(schedule);
}

// ---------------------------------------------------------------------------
// Critical Path Method (CPM)
// ---------------------------------------------------------------------------

export function computeCriticalPath(schedule: TemporalSchedule): TemporalSchedule {
  const milestoneMap = new Map(schedule.milestones.map((m) => [m.id, m]));

  // Forward pass: compute earliest start times
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();

  function forwardPass(milestoneId: string): number {
    if (earliestFinish.has(milestoneId)) return earliestFinish.get(milestoneId)!;

    const milestone = milestoneMap.get(milestoneId)!;
    let es = 0;

    for (const depId of milestone.dependencies) {
      const depFinish = forwardPass(depId);
      es = Math.max(es, depFinish);
    }

    earliestStart.set(milestoneId, es);
    earliestFinish.set(milestoneId, es + milestone.estimatedDuration);
    return es + milestone.estimatedDuration;
  }

  // Process all milestones
  for (const m of schedule.milestones) {
    forwardPass(m.id);
  }

  // Project total duration
  const totalDuration = Math.max(...[...earliestFinish.values()], 0);

  // Backward pass: compute latest start/finish times
  const latestFinish = new Map<string, number>();
  const latestStart = new Map<string, number>();

  // Find terminal milestones (no one depends on them)
  const dependedOn = new Set<string>();
  for (const m of schedule.milestones) {
    for (const dep of m.dependencies) dependedOn.add(dep);
  }
  const terminals = schedule.milestones.filter((m) => !dependedOn.has(m.id));

  function backwardPass(milestoneId: string): number {
    if (latestStart.has(milestoneId)) return latestStart.get(milestoneId)!;

    const milestone = milestoneMap.get(milestoneId)!;

    // Find all milestones that depend on this one
    const dependents = schedule.milestones.filter((m) => m.dependencies.includes(milestoneId));

    let lf: number;
    if (dependents.length === 0) {
      lf = totalDuration; // terminal node
    } else {
      lf = Math.min(...dependents.map((d) => backwardPass(d.id)));
    }

    latestFinish.set(milestoneId, lf);
    latestStart.set(milestoneId, lf - milestone.estimatedDuration);
    return lf - milestone.estimatedDuration;
  }

  for (const m of schedule.milestones) {
    backwardPass(m.id);
  }

  // Compute slack and identify critical path
  const slack: Record<string, number> = {};
  const criticalMilestones: string[] = [];

  for (const m of schedule.milestones) {
    const s = (latestStart.get(m.id) ?? 0) - (earliestStart.get(m.id) ?? 0);
    slack[m.id] = Math.max(0, s);
    if (s <= 0) criticalMilestones.push(m.id);
  }

  // Order critical path by dependency chain
  const criticalPath = topologicalSortMilestones(criticalMilestones, schedule.milestones);

  // Update milestones with computed times
  const baseTime = Date.now();
  const updatedMilestones = schedule.milestones.map((m) => ({
    ...m,
    earliestStart: new Date(baseTime + (earliestStart.get(m.id) ?? 0)).toISOString(),
    latestFinish: new Date(baseTime + (latestFinish.get(m.id) ?? totalDuration)).toISOString(),
  }));

  return {
    ...schedule,
    milestones: updatedMilestones,
    criticalPath,
    totalDuration,
    slack,
    updatedAt: new Date().toISOString(),
  };
}

function topologicalSortMilestones(milestoneIds: string[], allMilestones: ScheduleMilestone[]): string[] {
  const idSet = new Set(milestoneIds);
  const milestoneMap = new Map(allMilestones.map((m) => [m.id, m]));
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(id: string) {
    if (visited.has(id) || !idSet.has(id)) return;
    visited.add(id);

    const m = milestoneMap.get(id);
    if (m) {
      for (const dep of m.dependencies) {
        if (idSet.has(dep)) visit(dep);
      }
    }
    result.push(id);
  }

  for (const id of milestoneIds) visit(id);
  return result;
}

// ---------------------------------------------------------------------------
// Temporal constraint evaluation
// ---------------------------------------------------------------------------

export function evaluateConstraint(
  constraint: TemporalConstraint,
  context: {
    currentTime: string;
    eventCount?: number;
    lastEventTime?: string;
    activeConcurrent?: number;
    dataAge?: number;
  },
): { satisfied: boolean; violation?: string } {
  const now = new Date(context.currentTime).getTime();

  switch (constraint.type) {
    case 'deadline': {
      const deadline = new Date(constraint.parameters.deadline as string).getTime();
      if (now > deadline) {
        return { satisfied: false, violation: `Deadline exceeded by ${now - deadline}ms` };
      }
      return { satisfied: true };
    }

    case 'embargo': {
      const embargoUntil = new Date(constraint.parameters.embargoUntil as string).getTime();
      if (now < embargoUntil) {
        return { satisfied: false, violation: `Embargoed until ${constraint.parameters.embargoUntil}` };
      }
      return { satisfied: true };
    }

    case 'rate_limit': {
      const maxCount = constraint.parameters.maxCount as number;
      if ((context.eventCount ?? 0) >= maxCount) {
        return { satisfied: false, violation: `Rate limit exceeded: ${context.eventCount}/${maxCount}` };
      }
      return { satisfied: true };
    }

    case 'cooldown': {
      const cooldownMs = constraint.parameters.cooldownMs as number;
      if (context.lastEventTime) {
        const elapsed = now - new Date(context.lastEventTime).getTime();
        if (elapsed < cooldownMs) {
          return { satisfied: false, violation: `Cooldown active: ${cooldownMs - elapsed}ms remaining` };
        }
      }
      return { satisfied: true };
    }

    case 'window': {
      const windowStart = new Date(constraint.parameters.windowStart as string).getTime();
      const windowEnd = new Date(constraint.parameters.windowEnd as string).getTime();
      if (now < windowStart || now > windowEnd) {
        return { satisfied: false, violation: `Outside allowed time window` };
      }
      return { satisfied: true };
    }

    case 'concurrency': {
      const maxConcurrent = constraint.parameters.maxConcurrent as number;
      if ((context.activeConcurrent ?? 0) >= maxConcurrent) {
        return { satisfied: false, violation: `Concurrency limit: ${context.activeConcurrent}/${maxConcurrent}` };
      }
      return { satisfied: true };
    }

    case 'freshness': {
      const maxAgeMs = constraint.parameters.maxAgeMs as number;
      if ((context.dataAge ?? Infinity) > maxAgeMs) {
        return { satisfied: false, violation: `Data too stale: age ${context.dataAge}ms > max ${maxAgeMs}ms` };
      }
      return { satisfied: true };
    }

    case 'sequence':
      // Sequence constraints are validated at a higher level
      return { satisfied: true };

    default:
      return { satisfied: true };
  }
}

/** Evaluate all constraints in a policy and return violations */
export function evaluatePolicy(
  policy: TemporalPolicy,
  agentId: string,
  context: {
    currentTime: string;
    eventCount?: number;
    lastEventTime?: string;
    activeConcurrent?: number;
    dataAge?: number;
  },
): { compliant: boolean; violations: Array<{ constraint: TemporalConstraint; violation: string }> } {
  if (!policy.active) return { compliant: true, violations: [] };

  // Check if policy applies to this agent
  if (policy.scope.agents !== '*' && !policy.scope.agents.includes(agentId)) {
    return { compliant: true, violations: [] };
  }

  const violations: Array<{ constraint: TemporalConstraint; violation: string }> = [];

  for (const constraint of policy.constraints) {
    const result = evaluateConstraint(constraint, context);
    if (!result.satisfied && result.violation) {
      violations.push({ constraint, violation: result.violation });
    }
  }

  return {
    compliant: violations.filter((v) => v.constraint.enforced).length === 0,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Schedule disruption detection
// ---------------------------------------------------------------------------

/** Detect if any milestones are at risk of missing their deadlines */
export function detectScheduleRisks(
  schedule: TemporalSchedule,
): TemporalAnomaly[] {
  const anomalies: TemporalAnomaly[] = [];
  const now = Date.now();

  for (const milestone of schedule.milestones) {
    if (milestone.status === 'completed' || milestone.status === 'skipped') continue;

    const latestFinish = new Date(milestone.latestFinish).getTime();
    const remainingTime = latestFinish - now;

    // Check if blocked
    if (milestone.status === 'pending') {
      const blockers = milestone.dependencies.filter((depId) => {
        const dep = schedule.milestones.find((m) => m.id === depId);
        return dep && dep.status !== 'completed';
      });

      if (blockers.length > 0 && remainingTime < milestone.estimatedDuration * 2) {
        anomalies.push({
          id: uuidv4(),
          type: 'deadline_risk',
          severity: remainingTime < milestone.estimatedDuration ? 'critical' : 'warning',
          description: `Milestone "${milestone.name}" blocked by ${blockers.length} dependencies with only ${Math.round(remainingTime / 60000)}min remaining`,
          affectedNodes: [milestone.id, ...blockers],
          affectedEdges: [],
          detectedAt: new Date().toISOString(),
          evidence: [],
          suggestedAction: `Prioritize completing blockers or negotiate deadline extension`,
          autoResolvable: false,
        });
      }
    }

    // Check if in-progress milestone is running late
    if (milestone.status === 'in_progress' && milestone.actualStart) {
      const elapsed = now - new Date(milestone.actualStart).getTime();
      if (elapsed > milestone.estimatedDuration * 1.5) {
        anomalies.push({
          id: uuidv4(),
          type: 'timing_drift',
          severity: elapsed > milestone.estimatedDuration * 2 ? 'critical' : 'warning',
          description: `Milestone "${milestone.name}" running ${Math.round((elapsed / milestone.estimatedDuration - 1) * 100)}% over estimated duration`,
          affectedNodes: [milestone.id],
          affectedEdges: [],
          detectedAt: new Date().toISOString(),
          evidence: [],
          suggestedAction: `Consider assigning additional agents or adjusting downstream schedules`,
          autoResolvable: false,
        });
      }
    }

    // Check critical path milestones with zero slack
    if (schedule.criticalPath.includes(milestone.id) && (schedule.slack[milestone.id] ?? 0) === 0) {
      if (milestone.status !== 'completed' && remainingTime < milestone.estimatedDuration * 1.2) {
        anomalies.push({
          id: uuidv4(),
          type: 'deadline_risk',
          severity: 'critical',
          description: `Critical-path milestone "${milestone.name}" has zero slack and tight remaining time`,
          affectedNodes: [milestone.id],
          affectedEdges: [],
          detectedAt: new Date().toISOString(),
          evidence: [],
          suggestedAction: `This milestone is on the critical path — any delay cascades to project completion`,
          autoResolvable: false,
        });
      }
    }
  }

  return anomalies;
}
