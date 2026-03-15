/**
 * Vector Clock & Causal Ordering
 *
 * Implements Lamport and vector clocks for establishing causal ordering
 * of events across distributed agents. Without this, agents cannot
 * determine if event A happened-before event B in a distributed system.
 *
 * This is the foundational primitive that makes temporal reasoning
 * correct in a multi-agent environment.
 */

import type { TemporalCoordinate } from './types';

// ---------------------------------------------------------------------------
// Vector clock operations
// ---------------------------------------------------------------------------

export type VectorClock = Record<string, number>;

/** Create a new vector clock for an agent */
export function createVectorClock(agentId: string): VectorClock {
  return { [agentId]: 0 };
}

/** Increment the local component of a vector clock */
export function tick(clock: VectorClock, agentId: string): VectorClock {
  return { ...clock, [agentId]: (clock[agentId] ?? 0) + 1 };
}

/** Merge two vector clocks (component-wise max), then tick the local agent */
export function merge(local: VectorClock, remote: VectorClock, localAgentId: string): VectorClock {
  const merged: VectorClock = { ...local };

  for (const [agent, time] of Object.entries(remote)) {
    merged[agent] = Math.max(merged[agent] ?? 0, time);
  }

  // Tick local clock after merge
  merged[localAgentId] = (merged[localAgentId] ?? 0) + 1;
  return merged;
}

// ---------------------------------------------------------------------------
// Causal ordering
// ---------------------------------------------------------------------------

export type CausalOrder = 'before' | 'after' | 'concurrent';

/**
 * Compare two vector clocks to determine causal ordering.
 * Returns:
 * - 'before' if a happened-before b
 * - 'after' if b happened-before a
 * - 'concurrent' if neither can be causally ordered
 */
export function compare(a: VectorClock, b: VectorClock): CausalOrder {
  const allAgents = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aBeforeB = false;
  let bBeforeA = false;

  for (const agent of allAgents) {
    const aTime = a[agent] ?? 0;
    const bTime = b[agent] ?? 0;

    if (aTime < bTime) aBeforeB = true;
    if (bTime < aTime) bBeforeA = true;
  }

  if (aBeforeB && !bBeforeA) return 'before';
  if (bBeforeA && !aBeforeB) return 'after';
  return 'concurrent';
}

/** Check if clock a happened-before clock b */
export function happenedBefore(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === 'before';
}

/** Check if two events are causally concurrent */
export function isConcurrent(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === 'concurrent';
}

// ---------------------------------------------------------------------------
// Temporal coordinate management
// ---------------------------------------------------------------------------

let globalLogicalClock = 0;

/** Create a new temporal coordinate for an event */
export function createTemporalCoordinate(
  agentId: string,
  vectorClock: VectorClock,
): TemporalCoordinate {
  globalLogicalClock++;
  return {
    wallClock: new Date().toISOString(),
    logicalClock: globalLogicalClock,
    vectorClock: tick(vectorClock, agentId),
  };
}

/** Order a set of temporal coordinates by causal ordering */
export function causalSort(coordinates: TemporalCoordinate[]): TemporalCoordinate[] {
  return [...coordinates].sort((a, b) => {
    const order = compare(a.vectorClock, b.vectorClock);
    if (order === 'before') return -1;
    if (order === 'after') return 1;
    // For concurrent events, fall back to logical clock, then wall clock
    if (a.logicalClock !== b.logicalClock) return a.logicalClock - b.logicalClock;
    return new Date(a.wallClock).getTime() - new Date(b.wallClock).getTime();
  });
}

// ---------------------------------------------------------------------------
// Consistency checking
// ---------------------------------------------------------------------------

/**
 * Detect clock skew: vector clock says A→B but wall clock says B→A.
 * Returns pairs of events with inconsistent orderings.
 */
export function detectClockSkew(
  events: Array<{ id: string; coordinate: TemporalCoordinate }>,
  maxAcceptableSkewMs: number = 5000,
): Array<{ eventA: string; eventB: string; skewMs: number }> {
  const skews: Array<{ eventA: string; eventB: string; skewMs: number }> = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      const causalOrder = compare(a.coordinate.vectorClock, b.coordinate.vectorClock);

      if (causalOrder === 'concurrent') continue;

      const aWall = new Date(a.coordinate.wallClock).getTime();
      const bWall = new Date(b.coordinate.wallClock).getTime();
      const wallDiff = bWall - aWall;

      // If causal order says A→B but wall clock says B before A
      if (causalOrder === 'before' && wallDiff < -maxAcceptableSkewMs) {
        skews.push({ eventA: a.id, eventB: b.id, skewMs: Math.abs(wallDiff) });
      }
      // If causal order says B→A but wall clock says A before B
      if (causalOrder === 'after' && wallDiff > maxAcceptableSkewMs) {
        skews.push({ eventA: b.id, eventB: a.id, skewMs: Math.abs(wallDiff) });
      }
    }
  }

  return skews;
}
