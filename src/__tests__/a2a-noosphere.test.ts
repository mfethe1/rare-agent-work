/**
 * Tests for the A2A Noosphere — Collective Intelligence & Distributed Cognition Engine
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  joinSession,
  contributeThought,
  endorseThought,
  createArtifact,
  updateArtifact,
  signalAttention,
  fuseInsights,
  getSessionState,
  concludeSession,
  dissolveSession,
  detectStagnation,
} from '@/lib/a2a/noosphere/engine';
import type {
  CreateSessionRequest,
  ContributeThoughtRequest,
} from '@/lib/a2a/noosphere/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

const agentA = '00000000-0000-0000-0000-000000000001';
const agentB = '00000000-0000-0000-0000-000000000002';
const agentC = '00000000-0000-0000-0000-000000000003';

function makeSession(overrides?: Partial<CreateSessionRequest>) {
  return createSession({
    goal: 'Diagnose intermittent API failures in production',
    goalType: 'root_cause_analysis',
    initiatorAgentId: agentA,
    requiredDomains: ['infrastructure', 'observability'],
    minParticipants: 2,
    ...overrides,
  });
}

function addAgentAndThought(
  sessionId: string,
  agentId: string,
  type: ContributeThoughtRequest['type'] = 'observation',
  content = 'Test thought',
) {
  // Join if not already in
  try {
    joinSession({ sessionId, agentId, domains: ['general'] });
  } catch {
    // Already joined
  }
  return contributeThought({
    sessionId,
    agentId,
    type,
    content,
    confidence: 0.8,
    domain: 'general',
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Noosphere — Cognitive Sessions', () => {
  it('creates a session in forming status', () => {
    const { session } = makeSession();
    expect(session.status).toBe('forming');
    expect(session.participantAgentIds).toContain(agentA);
    expect(session.goalType).toBe('root_cause_analysis');
  });

  it('transitions to active when min participants join', () => {
    const { session } = makeSession();
    const result = joinSession({ sessionId: session.id, agentId: agentB, domains: ['observability'] });
    expect(result.session.status).toBe('active');
    expect(result.session.participantAgentIds).toHaveLength(2);
  });

  it('rejects joining a full session', () => {
    const { session } = makeSession({ maxParticipants: 2 });
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['infra'] });
    expect(() => joinSession({ sessionId: session.id, agentId: agentC, domains: ['obs'] }))
      .toThrow('full');
  });

  it('rejects duplicate joins', () => {
    const { session } = makeSession();
    expect(() => joinSession({ sessionId: session.id, agentId: agentA, domains: ['x'] }))
      .toThrow('already');
  });
});

describe('Noosphere — Thought Streams', () => {
  it('contributes a thought and updates budget', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    const result = contributeThought({
      sessionId: session.id,
      agentId: agentA,
      type: 'observation',
      content: 'Error rate spikes correlate with deployment events',
      confidence: 0.9,
      domain: 'observability',
    });

    expect(result.thought.type).toBe('observation');
    expect(result.thought.confidence).toBe(0.9);
    expect(result.budgetRemaining.consumed).toBeGreaterThan(0);
    expect(result.budgetRemaining.contributionCount).toBe(1);
  });

  it('rejects thoughts from non-participants', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    expect(() => contributeThought({
      sessionId: session.id,
      agentId: agentC, // Not joined
      type: 'hypothesis',
      content: 'test',
      confidence: 0.5,
      domain: 'x',
    })).toThrow('not a participant');
  });

  it('enforces constitutional constraints', () => {
    const { session } = makeSession({
      constitutionalConstraints: [{
        id: 'no-weapons',
        rule: 'No discussion of weapons',
        scope: ['all'],
        severity: 'hard',
        prohibitedTopics: ['weapons', 'explosives'],
      }],
    });
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    expect(() => contributeThought({
      sessionId: session.id,
      agentId: agentA,
      type: 'observation',
      content: 'We should consider weapons-grade encryption',
      confidence: 0.5,
      domain: 'security',
    })).toThrow('constitutional constraints');
  });

  it('supports thought endorsement', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    const { thought } = contributeThought({
      sessionId: session.id,
      agentId: agentA,
      type: 'hypothesis',
      content: 'Memory leak in connection pool',
      confidence: 0.7,
      domain: 'infrastructure',
    });

    const result = endorseThought({
      sessionId: session.id,
      agentId: agentB,
      thoughtId: thought.id,
      strength: 0.9,
      reason: 'Consistent with heap dump analysis',
    });

    expect(result.thought.endorsements).toHaveLength(1);
    expect(result.thought.endorsements[0].strength).toBe(0.9);
  });

  it('prevents self-endorsement', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    const { thought } = contributeThought({
      sessionId: session.id,
      agentId: agentA,
      type: 'hypothesis',
      content: 'test',
      confidence: 0.5,
      domain: 'x',
    });

    expect(() => endorseThought({
      sessionId: session.id,
      agentId: agentA,
      thoughtId: thought.id,
      strength: 1,
      reason: 'I agree with myself',
    })).toThrow('own thought');
  });
});

describe('Noosphere — Working Memory', () => {
  it('creates and updates shared artifacts', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    const { artifact } = createArtifact({
      sessionId: session.id,
      agentId: agentA,
      type: 'hypothesis_set',
      content: { hypotheses: ['memory leak', 'DNS timeout'] },
    });

    expect(artifact.type).toBe('hypothesis_set');
    expect(artifact.version).toBe(1);

    const updated = updateArtifact({
      sessionId: session.id,
      artifactId: artifact.id,
      agentId: agentB,
      delta: { hypotheses: ['memory leak', 'DNS timeout', 'thread starvation'] },
      rationale: 'Added thread starvation hypothesis based on CPU metrics',
    });

    expect(updated.artifact.version).toBe(2);
    expect(updated.artifact.contributorAgentIds).toContain(agentB);
    expect(updated.artifact.history).toHaveLength(2);
  });
});

describe('Noosphere — Attention Synchronization', () => {
  it('signals attention and updates attention state', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    const result = signalAttention({
      sessionId: session.id,
      agentId: agentA,
      type: 'breakthrough',
      target: 'Connection pool exhaustion pattern',
      priority: 0.9,
      context: 'Found clear correlation between pool size and error rate',
    });

    expect(result.signal.type).toBe('breakthrough');
    expect(result.attentionState.pendingSignals.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Noosphere — Cognitive Fusion', () => {
  it('fuses thoughts using weighted aggregation', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });
    joinSession({ sessionId: session.id, agentId: agentC, domains: ['infra'] });

    const t1 = contributeThought({
      sessionId: session.id, agentId: agentA, type: 'observation',
      content: 'Error rate correlates with deployment frequency', confidence: 0.85, domain: 'obs',
    });
    const t2 = contributeThought({
      sessionId: session.id, agentId: agentB, type: 'hypothesis',
      content: 'Connection pool exhaustion during rolling deploys', confidence: 0.7, domain: 'infra',
    });
    const t3 = contributeThought({
      sessionId: session.id, agentId: agentC, type: 'evidence',
      content: 'Heap dumps show 500+ idle connections during failures', confidence: 0.9, domain: 'infra',
    });

    const result = fuseInsights({
      sessionId: session.id,
      thoughtIds: [t1.thought.id, t2.thought.id, t3.thought.id],
      strategy: 'weighted_aggregation',
    });

    expect(result.conclusion.content).toContain('Weighted Aggregation');
    expect(result.conclusion.sourceThoughtIds).toHaveLength(3);
    expect(result.conclusion.contributorAgentIds).toHaveLength(3);
    expect(result.conclusion.emergenceScore).toBeGreaterThan(0);
    expect(result.conclusion.provenance).toBeDefined();
    expect(result.conclusion.provenance.reasoningChain).toHaveLength(3);
  });

  it('fuses with dialectical synthesis when contradictions exist', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    const t1 = contributeThought({
      sessionId: session.id, agentId: agentA, type: 'hypothesis',
      content: 'The issue is a memory leak', confidence: 0.8, domain: 'infra',
    });
    const t2 = contributeThought({
      sessionId: session.id, agentId: agentB, type: 'critique',
      content: 'Memory is stable — the issue is thread contention',
      confidence: 0.75, domain: 'infra',
      contradicts: [t1.thought.id],
    });

    const result = fuseInsights({
      sessionId: session.id,
      thoughtIds: [t1.thought.id, t2.thought.id],
      strategy: 'dialectical_synthesis',
    });

    expect(result.conclusion.content).toContain('Dialectical Synthesis');
    expect(result.conclusion.fusionStrategy).toBe('dialectical_synthesis');
  });

  it('rejects fusion with insufficient thoughts', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    const t1 = contributeThought({
      sessionId: session.id, agentId: agentA, type: 'observation',
      content: 'test', confidence: 0.5, domain: 'x',
    });

    expect(() => fuseInsights({
      sessionId: session.id,
      thoughtIds: [t1.thought.id],
      strategy: 'weighted_aggregation',
    })).toThrow('at least 2');
  });
});

describe('Noosphere — Session Lifecycle', () => {
  it('concludes a session with full stats and provenance', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });
    joinSession({ sessionId: session.id, agentId: agentC, domains: ['infra'] });

    // Multiple agents contribute thoughts
    const t1 = contributeThought({
      sessionId: session.id, agentId: agentA, type: 'observation',
      content: 'Errors spike at 2am UTC', confidence: 0.9, domain: 'obs',
    });
    const t2 = contributeThought({
      sessionId: session.id, agentId: agentB, type: 'hypothesis',
      content: 'Cron job conflicts with backup process', confidence: 0.7, domain: 'infra',
      parentThoughtIds: [t1.thought.id],
    });
    contributeThought({
      sessionId: session.id, agentId: agentC, type: 'evidence',
      content: 'Backup logs show lock contention at 2am', confidence: 0.85, domain: 'infra',
      parentThoughtIds: [t2.thought.id],
    });

    // Fuse into conclusion
    fuseInsights({
      sessionId: session.id,
      thoughtIds: [t1.thought.id, t2.thought.id],
      strategy: 'hierarchical_abstraction',
    });

    // Conclude
    const result = concludeSession({
      sessionId: session.id,
      agentId: agentA,
      reason: 'Root cause identified',
    });

    expect(result.session.status).toBe('concluded');
    expect(result.finalConclusions).toHaveLength(1);
    expect(result.fullProvenance).toHaveLength(1);
    expect(result.stats.totalThoughts).toBe(3);
    expect(result.stats.totalContributors).toBe(3);
    expect(result.stats.conclusionsReached).toBe(1);
    expect(result.stats.maxReasoningDepth).toBe(2); // observation → hypothesis → evidence
    expect(Object.keys(result.stats.contributionDistribution)).toHaveLength(3);
  });

  it('dissolves a session without conclusion', () => {
    const { session } = makeSession();
    const dissolved = dissolveSession(session.id, 'Budget exhausted with no convergence');
    expect(dissolved.status).toBe('dissolved');
  });

  it('detects stagnation', () => {
    const { session } = makeSession();
    const result = detectStagnation(session.id);
    expect(result.stagnant).toBe(true);
    expect(result.suggestion).toBeTruthy();
  });

  it('gets full session state', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    contributeThought({
      sessionId: session.id, agentId: agentA, type: 'observation',
      content: 'Test observation', confidence: 0.5, domain: 'obs',
    });

    const state = getSessionState({ sessionId: session.id });
    expect(state.session.id).toBe(session.id);
    expect(state.thoughts).toHaveLength(1);
    expect(state.attentionState.sessionId).toBe(session.id);
  });

  it('only allows initiator to conclude', () => {
    const { session } = makeSession();
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    expect(() => concludeSession({
      sessionId: session.id,
      agentId: agentB,
      reason: 'I want to end this',
    })).toThrow('initiator');
  });
});

describe('Noosphere — Budget Enforcement', () => {
  it('enforces per-agent contribution limits', () => {
    const { session } = makeSession({
      attentionBudget: { perAgentLimit: 2 },
    });
    joinSession({ sessionId: session.id, agentId: agentB, domains: ['obs'] });

    contributeThought({
      sessionId: session.id, agentId: agentA, type: 'observation',
      content: 'First', confidence: 0.5, domain: 'x',
    });
    contributeThought({
      sessionId: session.id, agentId: agentA, type: 'observation',
      content: 'Second', confidence: 0.5, domain: 'x',
    });

    expect(() => contributeThought({
      sessionId: session.id, agentId: agentA, type: 'observation',
      content: 'Third — should fail', confidence: 0.5, domain: 'x',
    })).toThrow('per-agent contribution limit');
  });
});
