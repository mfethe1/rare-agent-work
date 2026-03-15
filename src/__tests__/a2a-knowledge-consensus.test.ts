/**
 * Tests for A2A Knowledge Graph Collaborative Consensus Layer
 *
 * Covers: endorsement validation, conflict resolution validation,
 * community confidence computation logic, consensus level derivation,
 * tally computation, and Bayesian scoring.
 *
 * These tests validate the pure logic and Zod schemas without
 * requiring a database connection.
 */

import { describe, it, expect } from 'vitest';
import {
  endorseSchema,
  raiseConflictSchema,
  voteConflictSchema,
  listConflictsSchema,
} from '@/lib/a2a/knowledge/consensus-validation';
import type {
  KnowledgeEndorsement,
  CommunityConfidence,
  ConsensusLevel,
  KnowledgeConflict,
  ConflictVote,
  ConflictTally,
  ConflictResolution,
  ConflictStatus,
} from '@/lib/a2a/knowledge/consensus-types';

// ──────────────────────────────────────────────
// Test Fixtures
// ──────────────────────────────────────────────

function makeEndorsement(overrides: Partial<KnowledgeEndorsement> = {}): KnowledgeEndorsement {
  const now = new Date().toISOString();
  return {
    entry_id: overrides.entry_id ?? crypto.randomUUID(),
    agent_id: overrides.agent_id ?? crypto.randomUUID(),
    confidence: overrides.confidence ?? 0.85,
    rationale: overrides.rationale ?? 'Looks correct based on my analysis',
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

function makeConflict(overrides: Partial<KnowledgeConflict> = {}): KnowledgeConflict {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 604800 * 1000);
  return {
    id: overrides.id ?? crypto.randomUUID(),
    entry_a_id: overrides.entry_a_id ?? crypto.randomUUID(),
    entry_b_id: overrides.entry_b_id ?? crypto.randomUUID(),
    reason: overrides.reason ?? 'These entries contradict each other on the key assertion',
    status: overrides.status ?? 'open',
    quorum: overrides.quorum ?? 3,
    resolution: overrides.resolution ?? null,
    merged_entry_id: overrides.merged_entry_id ?? null,
    raised_by: overrides.raised_by ?? crypto.randomUUID(),
    resolved_at: overrides.resolved_at ?? null,
    ttl_seconds: overrides.ttl_seconds ?? 604800,
    expires_at: overrides.expires_at ?? expiresAt.toISOString(),
    created_at: overrides.created_at ?? now.toISOString(),
  };
}

function makeVote(overrides: Partial<ConflictVote> = {}): ConflictVote {
  return {
    conflict_id: overrides.conflict_id ?? crypto.randomUUID(),
    agent_id: overrides.agent_id ?? crypto.randomUUID(),
    vote: overrides.vote ?? 'entry_a_wins',
    rationale: overrides.rationale ?? 'Entry A has stronger evidence',
    confidence: overrides.confidence ?? 0.9,
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// Bayesian Confidence (pure function tests)
// ──────────────────────────────────────────────

const BAYESIAN_PRIOR = 0.5;
const BAYESIAN_WEIGHT = 3;

function computeBayesian(scores: number[]): number {
  if (scores.length === 0) return BAYESIAN_PRIOR;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return (BAYESIAN_WEIGHT * BAYESIAN_PRIOR + scores.length * mean) / (BAYESIAN_WEIGHT + scores.length);
}

function computeStddev(scores: number[]): number {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}

function deriveConsensusLevel(count: number, stddev: number, mean: number): ConsensusLevel {
  if (count < 2) return 'weak';
  if (stddev > 0.3) return 'contested';
  if (count >= 3 && stddev <= 0.15 && mean >= 0.7) return 'strong';
  if (count >= 2 && stddev <= 0.25) return 'moderate';
  return 'weak';
}

describe('A2A Knowledge Consensus — Bayesian Community Confidence', () => {
  it('returns prior when no endorsements exist', () => {
    expect(computeBayesian([])).toBe(0.5);
  });

  it('pulls single high endorsement toward prior', () => {
    const score = computeBayesian([1.0]);
    // (3*0.5 + 1*1.0) / (3+1) = 2.5/4 = 0.625
    expect(score).toBeCloseTo(0.625, 4);
  });

  it('converges to sample mean with many endorsements', () => {
    const scores = Array(100).fill(0.9);
    const score = computeBayesian(scores);
    // (3*0.5 + 100*0.9) / 103 ≈ 0.8884
    expect(score).toBeGreaterThan(0.88);
    expect(score).toBeLessThan(0.9);
  });

  it('balances between prior and sample for moderate counts', () => {
    const scores = [0.8, 0.9, 0.85, 0.75, 0.95];
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length; // 0.85
    const score = computeBayesian(scores);
    // (3*0.5 + 5*0.85) / 8 = 5.75/8 = 0.71875
    expect(score).toBeCloseTo(0.71875, 4);
    expect(score).toBeLessThan(mean);
    expect(score).toBeGreaterThan(BAYESIAN_PRIOR);
  });

  it('computes stddev correctly for uniform scores', () => {
    const scores = [0.8, 0.8, 0.8];
    expect(computeStddev(scores)).toBeCloseTo(0, 10);
  });

  it('computes stddev correctly for varied scores', () => {
    const scores = [0.2, 0.8];
    // mean = 0.5, variance = ((0.3^2 + 0.3^2)/2) = 0.09, stddev = 0.3
    expect(computeStddev(scores)).toBeCloseTo(0.3, 4);
  });
});

describe('A2A Knowledge Consensus — Consensus Level Derivation', () => {
  it('returns weak for single endorsement', () => {
    expect(deriveConsensusLevel(1, 0, 0.9)).toBe('weak');
  });

  it('returns strong for 3+ endorsements with low stddev and high mean', () => {
    expect(deriveConsensusLevel(5, 0.1, 0.85)).toBe('strong');
  });

  it('returns contested for high stddev', () => {
    expect(deriveConsensusLevel(5, 0.35, 0.6)).toBe('contested');
  });

  it('returns moderate for 2+ endorsements with moderate stddev', () => {
    expect(deriveConsensusLevel(3, 0.2, 0.6)).toBe('moderate');
  });

  it('returns weak for low count even with perfect agreement', () => {
    expect(deriveConsensusLevel(1, 0.0, 1.0)).toBe('weak');
  });

  it('returns strong at boundary conditions (3 endorsements, stddev=0.15, mean=0.7)', () => {
    expect(deriveConsensusLevel(3, 0.15, 0.7)).toBe('strong');
  });

  it('returns moderate when stddev is 0.25 (boundary)', () => {
    expect(deriveConsensusLevel(2, 0.25, 0.5)).toBe('moderate');
  });
});

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

describe('A2A Knowledge Consensus — Endorsement Schema', () => {
  it('accepts valid endorsement', () => {
    const result = endorseSchema.safeParse({ confidence: 0.85, rationale: 'Good entry' });
    expect(result.success).toBe(true);
  });

  it('accepts endorsement without rationale', () => {
    const result = endorseSchema.safeParse({ confidence: 0.5 });
    expect(result.success).toBe(true);
  });

  it('rejects confidence below 0', () => {
    const result = endorseSchema.safeParse({ confidence: -0.1 });
    expect(result.success).toBe(false);
  });

  it('rejects confidence above 1', () => {
    const result = endorseSchema.safeParse({ confidence: 1.1 });
    expect(result.success).toBe(false);
  });

  it('accepts boundary confidence values (0 and 1)', () => {
    expect(endorseSchema.safeParse({ confidence: 0 }).success).toBe(true);
    expect(endorseSchema.safeParse({ confidence: 1 }).success).toBe(true);
  });

  it('rejects rationale exceeding 2000 chars', () => {
    const result = endorseSchema.safeParse({ confidence: 0.5, rationale: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe('A2A Knowledge Consensus — Raise Conflict Schema', () => {
  it('accepts valid conflict', () => {
    const result = raiseConflictSchema.safeParse({
      entry_a_id: crypto.randomUUID(),
      entry_b_id: crypto.randomUUID(),
      reason: 'These entries make contradictory claims about the data source.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quorum).toBe(3); // default
      expect(result.data.ttl_seconds).toBe(604800); // 7 days default
    }
  });

  it('rejects reason shorter than 10 chars', () => {
    const result = raiseConflictSchema.safeParse({
      entry_a_id: crypto.randomUUID(),
      entry_b_id: crypto.randomUUID(),
      reason: 'Too short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for entry IDs', () => {
    const result = raiseConflictSchema.safeParse({
      entry_a_id: 'not-a-uuid',
      entry_b_id: crypto.randomUUID(),
      reason: 'These entries conflict on key assertions.',
    });
    expect(result.success).toBe(false);
  });

  it('rejects quorum below 2', () => {
    const result = raiseConflictSchema.safeParse({
      entry_a_id: crypto.randomUUID(),
      entry_b_id: crypto.randomUUID(),
      reason: 'Contradictory assertions about the same topic.',
      quorum: 1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts custom quorum and ttl', () => {
    const result = raiseConflictSchema.safeParse({
      entry_a_id: crypto.randomUUID(),
      entry_b_id: crypto.randomUUID(),
      reason: 'Contradictory assertions about the same topic.',
      quorum: 5,
      ttl_seconds: 86400, // 1 day
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quorum).toBe(5);
      expect(result.data.ttl_seconds).toBe(86400);
    }
  });

  it('rejects ttl below 1 hour', () => {
    const result = raiseConflictSchema.safeParse({
      entry_a_id: crypto.randomUUID(),
      entry_b_id: crypto.randomUUID(),
      reason: 'Contradictory assertions about the same topic.',
      ttl_seconds: 1800, // 30 minutes
    });
    expect(result.success).toBe(false);
  });
});

describe('A2A Knowledge Consensus — Vote Conflict Schema', () => {
  it('accepts valid vote', () => {
    const result = voteConflictSchema.safeParse({
      vote: 'entry_a_wins',
      rationale: 'Entry A has more supporting evidence.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidence).toBe(0.8); // default
    }
  });

  it('accepts all valid resolution types', () => {
    const resolutions: ConflictResolution[] = [
      'entry_a_wins', 'entry_b_wins', 'both_valid', 'both_retracted', 'merged',
    ];
    for (const vote of resolutions) {
      const result = voteConflictSchema.safeParse({
        vote,
        rationale: 'Valid reasoning for this vote.',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid vote type', () => {
    const result = voteConflictSchema.safeParse({
      vote: 'invalid_resolution',
      rationale: 'Should not pass',
    });
    expect(result.success).toBe(false);
  });

  it('rejects rationale shorter than 5 chars', () => {
    const result = voteConflictSchema.safeParse({
      vote: 'entry_a_wins',
      rationale: 'ok',
    });
    expect(result.success).toBe(false);
  });

  it('accepts custom confidence', () => {
    const result = voteConflictSchema.safeParse({
      vote: 'both_valid',
      rationale: 'Both entries describe different valid contexts.',
      confidence: 0.95,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidence).toBe(0.95);
    }
  });
});

describe('A2A Knowledge Consensus — List Conflicts Schema', () => {
  it('accepts empty query (uses defaults)', () => {
    const result = listConflictsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts status filter', () => {
    const result = listConflictsSchema.safeParse({ status: 'open' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = listConflictsSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid statuses', () => {
    const statuses: ConflictStatus[] = ['open', 'resolved', 'escalated', 'expired'];
    for (const status of statuses) {
      const result = listConflictsSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────
// Type & Fixture Integrity
// ──────────────────────────────────────────────

describe('A2A Knowledge Consensus — Type Fixtures', () => {
  it('creates valid endorsement fixture', () => {
    const e = makeEndorsement();
    expect(e.entry_id).toBeTruthy();
    expect(e.agent_id).toBeTruthy();
    expect(e.confidence).toBeGreaterThanOrEqual(0);
    expect(e.confidence).toBeLessThanOrEqual(1);
  });

  it('creates valid conflict fixture', () => {
    const c = makeConflict();
    expect(c.id).toBeTruthy();
    expect(c.entry_a_id).not.toBe(c.entry_b_id);
    expect(c.status).toBe('open');
    expect(c.quorum).toBeGreaterThanOrEqual(2);
    expect(new Date(c.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('creates valid vote fixture', () => {
    const v = makeVote();
    expect(v.conflict_id).toBeTruthy();
    expect(v.agent_id).toBeTruthy();
    expect(['entry_a_wins', 'entry_b_wins', 'both_valid', 'both_retracted', 'merged']).toContain(v.vote);
  });

  it('conflict resolution types are exhaustive', () => {
    const allResolutions: ConflictResolution[] = [
      'entry_a_wins', 'entry_b_wins', 'both_valid', 'both_retracted', 'merged',
    ];
    expect(allResolutions).toHaveLength(5);
  });

  it('consensus levels are exhaustive', () => {
    const allLevels: ConsensusLevel[] = ['strong', 'moderate', 'weak', 'contested'];
    expect(allLevels).toHaveLength(4);
  });
});

// ──────────────────────────────────────────────
// Tally Computation (pure logic)
// ──────────────────────────────────────────────

describe('A2A Knowledge Consensus — Tally Computation', () => {
  function computeTallyFromVotes(
    votes: Array<{ vote: ConflictResolution; confidence: number }>,
    quorum: number,
  ): ConflictTally {
    const resolutions: ConflictResolution[] = [
      'entry_a_wins', 'entry_b_wins', 'both_valid', 'both_retracted', 'merged',
    ];

    const weightedCounts: Record<string, number> = {};
    const rawCounts: Record<string, number> = {};

    for (const r of resolutions) {
      weightedCounts[r] = 0;
      rawCounts[r] = 0;
    }

    for (const v of votes) {
      rawCounts[v.vote] = (rawCounts[v.vote] ?? 0) + 1;
      weightedCounts[v.vote] = (weightedCounts[v.vote] ?? 0) + v.confidence;
    }

    const sorted = resolutions
      .map((r) => ({ resolution: r, weighted: weightedCounts[r], count: rawCounts[r] }))
      .sort((a, b) => b.weighted - a.weighted);

    const leading = sorted[0].count > 0 ? sorted[0].resolution : null;
    const margin = sorted.length >= 2 ? sorted[0].weighted - sorted[1].weighted : sorted[0].weighted;

    return {
      conflict_id: 'test-conflict',
      total_votes: votes.length,
      votes_by_resolution: rawCounts as Record<ConflictResolution, number>,
      quorum_reached: votes.length >= quorum,
      leading_resolution: leading,
      margin: Math.round(margin * 10000) / 10000,
    };
  }

  it('returns empty tally with no votes', () => {
    const tally = computeTallyFromVotes([], 3);
    expect(tally.total_votes).toBe(0);
    expect(tally.quorum_reached).toBe(false);
    expect(tally.leading_resolution).toBeNull();
  });

  it('identifies leading resolution correctly', () => {
    const votes = [
      { vote: 'entry_a_wins' as ConflictResolution, confidence: 0.9 },
      { vote: 'entry_a_wins' as ConflictResolution, confidence: 0.8 },
      { vote: 'entry_b_wins' as ConflictResolution, confidence: 0.7 },
    ];
    const tally = computeTallyFromVotes(votes, 3);
    expect(tally.leading_resolution).toBe('entry_a_wins');
    expect(tally.quorum_reached).toBe(true);
    expect(tally.votes_by_resolution.entry_a_wins).toBe(2);
    expect(tally.votes_by_resolution.entry_b_wins).toBe(1);
  });

  it('weights votes by confidence', () => {
    // 1 high-confidence vote for A, 2 low-confidence for B
    const votes = [
      { vote: 'entry_a_wins' as ConflictResolution, confidence: 1.0 },
      { vote: 'entry_b_wins' as ConflictResolution, confidence: 0.3 },
      { vote: 'entry_b_wins' as ConflictResolution, confidence: 0.3 },
    ];
    const tally = computeTallyFromVotes(votes, 3);
    // A: 1.0 weighted, B: 0.6 weighted. A leads by weighted score.
    expect(tally.leading_resolution).toBe('entry_a_wins');
    expect(tally.margin).toBeCloseTo(0.4, 4);
  });

  it('reports quorum not reached when below threshold', () => {
    const votes = [
      { vote: 'both_valid' as ConflictResolution, confidence: 0.8 },
      { vote: 'both_valid' as ConflictResolution, confidence: 0.9 },
    ];
    const tally = computeTallyFromVotes(votes, 3);
    expect(tally.quorum_reached).toBe(false);
    expect(tally.total_votes).toBe(2);
  });

  it('handles unanimous vote', () => {
    const votes = Array(5).fill(null).map(() => ({
      vote: 'merged' as ConflictResolution,
      confidence: 0.95,
    }));
    const tally = computeTallyFromVotes(votes, 3);
    expect(tally.leading_resolution).toBe('merged');
    expect(tally.quorum_reached).toBe(true);
    expect(tally.votes_by_resolution.merged).toBe(5);
    expect(tally.margin).toBeCloseTo(4.75, 2);
  });

  it('handles evenly split vote', () => {
    const votes = [
      { vote: 'entry_a_wins' as ConflictResolution, confidence: 0.8 },
      { vote: 'entry_b_wins' as ConflictResolution, confidence: 0.8 },
    ];
    const tally = computeTallyFromVotes(votes, 2);
    // Both have same weighted score; depends on sort stability (a or b)
    expect(tally.total_votes).toBe(2);
    expect(tally.margin).toBeCloseTo(0, 4);
    expect(tally.quorum_reached).toBe(true);
  });
});
