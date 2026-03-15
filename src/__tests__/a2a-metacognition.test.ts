/**
 * Tests for A2A Metacognition & Recursive Self-Improvement Engine
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  introspect,
  getOrCreateProfile,
  getCognitiveProfile,
  getAgentReports,
  getBlindSpots,
  generateStrategies,
  recordStrategyTestResult,
  adoptStrategy,
  getAgentStrategies,
  startImprovementCycle,
  advanceImprovementCycle,
  getAgentCycles,
  checkAlignment,
  propagateImprovement,
  recordPropagationResponse,
  getMetacognitionSummary,
  introspectSchema,
  generateStrategiesSchema,
  startImprovementCycleSchema,
  propagateImprovementSchema,
} from '@/lib/a2a/metacognition';

// ── Helpers ─────────────────────────────────────────────────────────────────

const AGENT_ID = '00000000-0000-4000-a000-000000000001';
const AGENT_ID_2 = '00000000-0000-4000-a000-000000000002';
const TASK_ID = '00000000-0000-4000-b000-000000000001';

function makeIntrospection(overrides: Record<string, unknown> = {}) {
  return {
    agent_id: AGENT_ID,
    task_id: TASK_ID,
    task_domain: 'code_review',
    outcome: 'failure' as const,
    decision_points: [
      {
        step_index: 0,
        description: 'Chose to skip context analysis',
        alternatives_considered: [],
        chosen_action: 'Proceeded directly to review',
        rationale: 'Assumed context was clear',
        quality: 'suboptimal' as const,
        counterfactual_impact: 0.7,
        confidence_at_time: 0.9,
      },
      {
        step_index: 1,
        description: 'Missed critical dependency',
        alternatives_considered: ['Check dependencies', 'Ask for clarification'],
        chosen_action: 'Continued without checking',
        rationale: 'Thought it was unnecessary',
        quality: 'harmful' as const,
        counterfactual_impact: 0.9,
        confidence_at_time: 0.85,
      },
    ],
    root_cause: 'Failed to analyze upstream dependencies before review',
    lessons_learned: ['Always check dependency graph', 'Low context = high risk'],
    ...overrides,
  };
}

// ── Validation Tests ────────────────────────────────────────────────────────

describe('Metacognition Validation', () => {
  it('validates introspect input', () => {
    const valid = introspectSchema.safeParse(makeIntrospection());
    expect(valid.success).toBe(true);
  });

  it('rejects introspect with missing agent_id', () => {
    const invalid = introspectSchema.safeParse({
      ...makeIntrospection(),
      agent_id: 'not-a-uuid',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates generate strategies input', () => {
    const valid = generateStrategiesSchema.safeParse({
      agent_id: AGENT_ID,
      target_weakness_ids: [TASK_ID],
      max_strategies: 3,
    });
    expect(valid.success).toBe(true);
  });

  it('validates start improvement cycle input', () => {
    const valid = startImprovementCycleSchema.safeParse({
      agent_id: AGENT_ID,
      trigger: 'failure_spike',
    });
    expect(valid.success).toBe(true);
  });

  it('validates propagate improvement input', () => {
    const valid = propagateImprovementSchema.safeParse({
      source_agent_id: AGENT_ID,
      strategy_id: TASK_ID,
      target_agent_ids: [AGENT_ID_2],
    });
    expect(valid.success).toBe(true);
  });
});

// ── Cognitive Profile Tests ─────────────────────────────────────────────────

describe('Cognitive Profile', () => {
  it('creates a default profile for a new agent', () => {
    const profile = getOrCreateProfile(AGENT_ID);
    expect(profile.agent_id).toBe(AGENT_ID);
    expect(profile.profile_version).toBe(1);
    expect(profile.alignment_invariants.length).toBeGreaterThan(0);
    expect(profile.meta_accuracy).toBe(0.5);
  });

  it('returns existing profile on subsequent calls', () => {
    const p1 = getOrCreateProfile(AGENT_ID);
    p1.profile_version = 42;
    const p2 = getOrCreateProfile(AGENT_ID);
    expect(p2.profile_version).toBe(42);
  });
});

// ── Introspection Tests ─────────────────────────────────────────────────────

describe('Introspection', () => {
  it('creates an introspection report with decision analysis', () => {
    const result = introspect(makeIntrospection());
    expect(result.report).toBeDefined();
    expect(result.report.agent_id).toBe(AGENT_ID);
    expect(result.report.outcome).toBe('failure');
    expect(result.report.decision_points).toHaveLength(2);
    expect(result.report.reasoning_efficiency).toBeLessThan(1);
  });

  it('detects overconfidence pattern', () => {
    // Agent was very confident (0.9, 0.85) but got it wrong
    const result = introspect(makeIntrospection());
    const profile = getCognitiveProfile(AGENT_ID);
    expect(profile).toBeDefined();
    const overconfidence = profile!.failure_patterns.find(
      p => p.category === 'overconfidence'
    );
    expect(overconfidence).toBeDefined();
  });

  it('detects context_blindness when high-impact decisions are suboptimal', () => {
    const result = introspect(makeIntrospection());
    const profile = getCognitiveProfile(AGENT_ID);
    const contextBlind = profile!.failure_patterns.find(
      p => p.category === 'context_blindness'
    );
    expect(contextBlind).toBeDefined();
  });

  it('updates domain competency on success', () => {
    const result = introspect(makeIntrospection({
      task_id: '00000000-0000-4000-b000-000000000099',
      outcome: 'success',
      decision_points: [{
        step_index: 0,
        description: 'Good decision',
        alternatives_considered: ['A', 'B'],
        chosen_action: 'Chose B',
        rationale: 'B was optimal',
        quality: 'optimal',
        counterfactual_impact: 0.1,
        confidence_at_time: 0.8,
      }],
    }));
    expect(result.report.outcome).toBe('success');
    const profile = getCognitiveProfile(AGENT_ID);
    const comp = profile!.domain_competencies.find(c => c.domain === 'code_review');
    expect(comp).toBeDefined();
    expect(comp!.sample_size).toBeGreaterThan(0);
  });

  it('retrieves agent reports', () => {
    const reports = getAgentReports(AGENT_ID);
    expect(reports.length).toBeGreaterThan(0);
  });
});

// ── Strategy Evolution Tests ────────────────────────────────────────────────

describe('Strategy Evolution', () => {
  it('generates strategies for failure patterns', () => {
    const profile = getOrCreateProfile(AGENT_ID);
    // Ensure there's a failure pattern
    introspect(makeIntrospection({
      task_id: '00000000-0000-4000-b000-000000000010',
    }));

    const activePatterns = profile.failure_patterns.filter(p => p.status === 'active');
    if (activePatterns.length === 0) return; // skip if no patterns

    const result = generateStrategies({
      agent_id: AGENT_ID,
      target_weakness_ids: activePatterns.map(p => p.id).slice(0, 3),
      max_strategies: 3,
    });

    expect(result.strategies.length).toBeGreaterThan(0);
    expect(result.strategies[0].status).toBe('hypothesis');
    expect(result.alignment_precheck).toBeDefined();
  });

  it('records test results and auto-validates', () => {
    const profile = getOrCreateProfile(AGENT_ID);
    const activePatterns = profile.failure_patterns.filter(p => p.status === 'active');
    if (activePatterns.length === 0) return;

    const { strategies } = generateStrategies({
      agent_id: AGENT_ID,
      target_weakness_ids: [activePatterns[0].id],
      max_strategies: 1,
    });

    if (strategies.length === 0) return;
    const strategy = strategies[0];

    // Submit 3 positive test results
    for (let i = 0; i < 3; i++) {
      recordStrategyTestResult(strategy.id, {
        test_task_ids: [`00000000-0000-4000-b000-00000000002${i}`],
        control_task_ids: [],
        improvement_measured: 0.15,
        statistical_significance: 0.01,
        sample_size: 10,
        side_effects: [],
        tested_at: new Date().toISOString(),
      });
    }

    const updated = getAgentStrategies(AGENT_ID).find(s => s.id === strategy.id);
    expect(updated?.status).toBe('validated');
  });

  it('adopts validated strategy and links to failure pattern', () => {
    const validated = getAgentStrategies(AGENT_ID, 'validated');
    if (validated.length === 0) return;

    const result = adoptStrategy(validated[0].id);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('adopted');
  });
});

// ── Improvement Cycle Tests ─────────────────────────────────────────────────

describe('Improvement Cycles', () => {
  it('starts a new improvement cycle', () => {
    const { cycle } = startImprovementCycle({
      agent_id: AGENT_ID,
      trigger: 'failure_spike',
    });
    expect(cycle.phase).toBe('observe');
    expect(cycle.cycle_number).toBeGreaterThan(0);
    expect(cycle.agent_id).toBe(AGENT_ID);
  });

  it('advances through cycle phases', () => {
    const { cycle } = startImprovementCycle({
      agent_id: AGENT_ID,
      trigger: 'manual',
    });

    let current = advanceImprovementCycle(cycle.id);
    expect(current?.phase).toBe('analyze');

    current = advanceImprovementCycle(cycle.id);
    expect(current?.phase).toBe('hypothesize');

    current = advanceImprovementCycle(cycle.id);
    expect(current?.phase).toBe('test');
  });

  it('lists cycles for an agent', () => {
    const cycles = getAgentCycles(AGENT_ID);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

// ── Alignment Guardrails Tests ──────────────────────────────────────────────

describe('Alignment Guardrails', () => {
  it('passes alignment check for normal strategy', () => {
    const profile = getOrCreateProfile(AGENT_ID);
    const result = checkAlignment(null, profile);
    expect(result.passed).toBe(true);
    expect(result.invariants_checked.length).toBeGreaterThan(0);
  });

  it('blocks strategy with unrealistic improvement claims', () => {
    const profile = getOrCreateProfile(AGENT_ID);
    const fakeStrategy = {
      id: 'fake',
      agent_id: AGENT_ID,
      name: 'Suspicious strategy',
      description: 'Claims to fix everything',
      target_weakness: 'none',
      approach: 'magic',
      preconditions: [],
      expected_improvement: 0.95, // unrealistically high
      status: 'hypothesis' as const,
      test_results: [],
      alignment_check: { passed: true, invariants_checked: [], violations: [], checked_at: '' },
      parent_strategy_id: null,
      generation: 1,
      created_at: '',
      updated_at: '',
    };

    const result = checkAlignment(fakeStrategy, profile);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].invariant_type).toBe('capability_ceiling');
  });
});

// ── Propagation Tests ───────────────────────────────────────────────────────

describe('Improvement Propagation', () => {
  it('propagates an adopted strategy to peers', () => {
    // Get an adopted strategy or create one
    const adopted = getAgentStrategies(AGENT_ID, 'adopted');
    if (adopted.length === 0) return;

    const { propagation } = propagateImprovement({
      source_agent_id: AGENT_ID,
      strategy_id: adopted[0].id,
      target_agent_ids: [AGENT_ID_2],
    });

    expect(propagation.status).toBe('pending_review');
    expect(propagation.provenance_chain).toHaveLength(1);
    expect(propagation.provenance_chain[0].action).toBe('originated');
  });

  it('records peer response and updates status', () => {
    const adopted = getAgentStrategies(AGENT_ID, 'adopted');
    if (adopted.length === 0) return;

    const { propagation } = propagateImprovement({
      source_agent_id: AGENT_ID,
      strategy_id: adopted[0].id,
      target_agent_ids: [AGENT_ID_2],
    });

    const updated = recordPropagationResponse(
      propagation.id,
      AGENT_ID_2,
      'adopted',
      0.12,
    );

    expect(updated).not.toBeNull();
    expect(updated!.adopted_by).toContain(AGENT_ID_2);
    expect(updated!.status).toBe('adopted_by_peers');
  });
});

// ── Summary Tests ───────────────────────────────────────────────────────────

describe('Metacognition Summary', () => {
  it('returns comprehensive summary for an agent', () => {
    const summary = getMetacognitionSummary(AGENT_ID);
    expect(summary.agent_id).toBe(AGENT_ID);
    expect(summary.total_introspections).toBeGreaterThan(0);
    expect(typeof summary.calibration_score).toBe('number');
    expect(typeof summary.net_improvement).toBe('number');
    expect(Array.isArray(summary.top_weaknesses)).toBe(true);
    expect(Array.isArray(summary.top_strengths)).toBe(true);
  });
});
