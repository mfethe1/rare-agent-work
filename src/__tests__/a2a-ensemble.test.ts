/**
 * A2A Agent Ensemble Protocol — Unit Tests
 *
 * Tests validation schemas and pure functions for the ensemble system.
 * Database-dependent functions (createEnsemble, voteOnRound, etc.) are
 * tested via integration tests.
 */

import {
  createEnsembleSchema,
  inviteMemberSchema,
  proposeOutputSchema,
  voteSchema,
  dissolveSchema,
  listEnsemblesSchema,
} from '@/lib/a2a/ensemble/validation';
import { computeRequiredVotes } from '@/lib/a2a/ensemble/engine';

// ──────────────────────────────────────────────
// Validation: createEnsembleSchema
// ──────────────────────────────────────────────

describe('createEnsembleSchema', () => {
  const validInput = {
    name: 'Legal Analysis Team',
    goal: 'Analyze multi-jurisdiction compliance requirements for contract review',
    formation_strategy: 'manual',
    consensus_policy: 'majority',
  };

  it('accepts valid minimal input with defaults', () => {
    const result = createEnsembleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_quorum).toBe(3);
      expect(result.data.max_members).toBe(10);
      expect(result.data.idle_timeout_seconds).toBe(3600);
      expect(result.data.tags).toEqual([]);
      expect(result.data.top_n).toBe(3);
    }
  });

  it('accepts full input with all fields', () => {
    const result = createEnsembleSchema.safeParse({
      ...validInput,
      formation_strategy: 'reputation_top_n',
      consensus_policy: 'supermajority',
      min_quorum: 5,
      max_members: 20,
      tags: ['legal', 'compliance', 'multi-jurisdiction'],
      idle_timeout_seconds: 7200,
      required_capabilities: ['legal.analysis', 'report.generate'],
      top_n: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_quorum).toBe(5);
      expect(result.data.max_members).toBe(20);
      expect(result.data.required_capabilities).toEqual(['legal.analysis', 'report.generate']);
      expect(result.data.top_n).toBe(5);
    }
  });

  it('accepts manual formation with invite_agents', () => {
    const result = createEnsembleSchema.safeParse({
      ...validInput,
      invite_agents: ['agent-1', 'agent-2', 'agent-3'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invite_agents).toHaveLength(3);
    }
  });

  it('rejects missing name', () => {
    const { name, ...rest } = validInput;
    const result = createEnsembleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing goal', () => {
    const { goal, ...rest } = validInput;
    const result = createEnsembleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid formation_strategy', () => {
    const result = createEnsembleSchema.safeParse({
      ...validInput,
      formation_strategy: 'random',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid consensus_policy', () => {
    const result = createEnsembleSchema.safeParse({
      ...validInput,
      consensus_policy: 'dice_roll',
    });
    expect(result.success).toBe(false);
  });

  it('rejects min_quorum below 2', () => {
    const result = createEnsembleSchema.safeParse({
      ...validInput,
      min_quorum: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects max_members above 100', () => {
    const result = createEnsembleSchema.safeParse({
      ...validInput,
      max_members: 101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects idle_timeout below 60 seconds', () => {
    const result = createEnsembleSchema.safeParse({
      ...validInput,
      idle_timeout_seconds: 30,
    });
    expect(result.success).toBe(false);
  });

  it('rejects idle_timeout above 7 days', () => {
    const result = createEnsembleSchema.safeParse({
      ...validInput,
      idle_timeout_seconds: 604801,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all formation strategies', () => {
    for (const strategy of ['manual', 'capability_match', 'auction', 'reputation_top_n']) {
      const result = createEnsembleSchema.safeParse({ ...validInput, formation_strategy: strategy });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all consensus policies', () => {
    for (const policy of [
      'majority', 'supermajority', 'unanimous',
      'weighted_reputation', 'coordinator_decides', 'validator_gate',
    ]) {
      const result = createEnsembleSchema.safeParse({ ...validInput, consensus_policy: policy });
      expect(result.success).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────
// Validation: inviteMemberSchema
// ──────────────────────────────────────────────

describe('inviteMemberSchema', () => {
  it('accepts a valid invite', () => {
    const result = inviteMemberSchema.safeParse({
      agent_id: 'agent-abc-123',
      role: 'specialist',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all roles', () => {
    for (const role of ['coordinator', 'specialist', 'validator', 'critic', 'observer']) {
      const result = inviteMemberSchema.safeParse({ agent_id: 'agent-1', role });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const result = inviteMemberSchema.safeParse({ agent_id: 'agent-1', role: 'manager' });
    expect(result.success).toBe(false);
  });

  it('rejects missing agent_id', () => {
    const result = inviteMemberSchema.safeParse({ role: 'specialist' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: proposeOutputSchema
// ──────────────────────────────────────────────

describe('proposeOutputSchema', () => {
  const validInput = {
    external_task_id: 'task-xyz-789',
    proposed_output: { analysis: 'This contract has three compliance gaps.', confidence: 0.92 },
  };

  it('accepts valid input with default max_rounds', () => {
    const result = proposeOutputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_rounds).toBe(3);
    }
  });

  it('accepts custom max_rounds', () => {
    const result = proposeOutputSchema.safeParse({ ...validInput, max_rounds: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_rounds).toBe(5);
    }
  });

  it('rejects max_rounds above 10', () => {
    const result = proposeOutputSchema.safeParse({ ...validInput, max_rounds: 11 });
    expect(result.success).toBe(false);
  });

  it('rejects missing external_task_id', () => {
    const { external_task_id, ...rest } = validInput;
    const result = proposeOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: voteSchema
// ──────────────────────────────────────────────

describe('voteSchema', () => {
  it('accepts an approval vote with defaults', () => {
    const result = voteSchema.safeParse({
      decision: 'approve',
      rationale: 'Output meets quality standards and addresses all requirements.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidence).toBe(0.8);
    }
  });

  it('accepts a reject vote', () => {
    const result = voteSchema.safeParse({
      decision: 'reject',
      rationale: 'Missing jurisdiction analysis for EU regulations.',
      confidence: 0.95,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a revise vote with suggested changes', () => {
    const result = voteSchema.safeParse({
      decision: 'revise',
      rationale: 'Good overall but needs additional section on GDPR implications.',
      suggested_changes: { add_section: 'GDPR implications', expand_analysis: true },
      confidence: 0.7,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggested_changes).toEqual({ add_section: 'GDPR implications', expand_analysis: true });
    }
  });

  it('rejects invalid decision', () => {
    const result = voteSchema.safeParse({ decision: 'abstain', rationale: 'No opinion.' });
    expect(result.success).toBe(false);
  });

  it('rejects missing rationale', () => {
    const result = voteSchema.safeParse({ decision: 'approve' });
    expect(result.success).toBe(false);
  });

  it('rejects confidence above 1.0', () => {
    const result = voteSchema.safeParse({
      decision: 'approve',
      rationale: 'Good.',
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence below 0.0', () => {
    const result = voteSchema.safeParse({
      decision: 'approve',
      rationale: 'Good.',
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: dissolveSchema
// ──────────────────────────────────────────────

describe('dissolveSchema', () => {
  it('accepts minimal dissolution', () => {
    const result = dissolveSchema.safeParse({ reason: 'goal_complete' });
    expect(result.success).toBe(true);
  });

  it('accepts full dissolution with learnings', () => {
    const result = dissolveSchema.safeParse({
      reason: 'goal_complete',
      accomplishment_summary: 'Analyzed 15 contracts across 3 jurisdictions.',
      learnings: [
        'EU GDPR requires explicit data processor agreements in all contracts.',
        'Cross-border data transfer clauses need jurisdiction-specific review.',
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.learnings).toHaveLength(2);
    }
  });

  it('rejects invalid reason', () => {
    const result = dissolveSchema.safeParse({ reason: 'bored' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: listEnsemblesSchema
// ──────────────────────────────────────────────

describe('listEnsemblesSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = listEnsemblesSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts filters', () => {
    const result = listEnsemblesSchema.safeParse({
      status: 'active',
      tag: 'legal',
      created_by: 'agent-creator',
      member_agent_id: 'agent-member',
      limit: 50,
      offset: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = listEnsemblesSchema.safeParse({ status: 'sleeping' });
    expect(result.success).toBe(false);
  });

  it('rejects limit above 100', () => {
    const result = listEnsemblesSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Pure Functions: computeRequiredVotes
// ──────────────────────────────────────────────

describe('computeRequiredVotes', () => {
  it('majority requires >50%', () => {
    expect(computeRequiredVotes('majority', 5)).toBe(3);
    expect(computeRequiredVotes('majority', 4)).toBe(3);
    expect(computeRequiredVotes('majority', 3)).toBe(2);
    expect(computeRequiredVotes('majority', 10)).toBe(6);
  });

  it('supermajority requires >=2/3', () => {
    expect(computeRequiredVotes('supermajority', 3)).toBe(2);
    expect(computeRequiredVotes('supermajority', 6)).toBe(4);
    expect(computeRequiredVotes('supermajority', 9)).toBe(6);
  });

  it('unanimous requires all', () => {
    expect(computeRequiredVotes('unanimous', 5)).toBe(5);
    expect(computeRequiredVotes('unanimous', 1)).toBe(1);
  });

  it('coordinator_decides requires 1', () => {
    expect(computeRequiredVotes('coordinator_decides', 10)).toBe(1);
  });

  it('weighted_reputation uses majority count', () => {
    expect(computeRequiredVotes('weighted_reputation', 5)).toBe(3);
  });

  it('validator_gate returns 1 (actual threshold computed dynamically)', () => {
    expect(computeRequiredVotes('validator_gate', 10)).toBe(1);
  });
});
