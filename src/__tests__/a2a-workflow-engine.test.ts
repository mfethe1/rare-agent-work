/**
 * Tests for the A2A Multi-Agent Workflow Orchestrator.
 *
 * Covers DAG validation, condition evaluation, template interpolation,
 * and progress computation — the core pure-logic functions.
 */

import { describe, it, expect } from 'vitest';
import {
  validateDAG,
  evaluateCondition,
  interpolateTemplate,
  computeProgress,
  getStepCategories,
} from '@/lib/a2a/workflow-engine';
import type { WorkflowStepDefinition, StepExecution, StepCondition } from '@/lib/a2a/workflow-types';

// ──────────────────────────────────────────────
// DAG Validation
// ──────────────────────────────────────────────

describe('validateDAG', () => {
  const makeStep = (id: string, deps: string[] = []): WorkflowStepDefinition => ({
    step_id: id,
    name: id,
    agent_target: { type: 'capability', capability: 'test.run' },
    depends_on: deps,
    intent: 'test.run',
    input_template: {},
  });

  it('accepts a valid linear DAG', () => {
    const steps = [
      makeStep('a'),
      makeStep('b', ['a']),
      makeStep('c', ['b']),
    ];
    expect(validateDAG(steps)).toBeNull();
  });

  it('accepts a valid diamond DAG (fan-out / fan-in)', () => {
    const steps = [
      makeStep('start'),
      makeStep('left', ['start']),
      makeStep('right', ['start']),
      makeStep('merge', ['left', 'right']),
    ];
    expect(validateDAG(steps)).toBeNull();
  });

  it('rejects empty steps', () => {
    expect(validateDAG([])).toBe('Workflow must have at least one step.');
  });

  it('rejects duplicate step IDs', () => {
    expect(validateDAG([makeStep('a'), makeStep('a')])).toBe('Duplicate step IDs detected.');
  });

  it('rejects references to unknown steps', () => {
    const result = validateDAG([makeStep('a', ['nonexistent'])]);
    expect(result).toContain('unknown step');
  });

  it('rejects self-dependency', () => {
    const result = validateDAG([makeStep('a', ['a'])]);
    expect(result).toContain('cannot depend on itself');
  });

  it('rejects cycles', () => {
    const steps = [
      makeStep('a', ['c']),
      makeStep('b', ['a']),
      makeStep('c', ['b']),
    ];
    // All steps have dependencies, so no root
    const result = validateDAG(steps);
    expect(result).toBeTruthy();
  });

  it('rejects unknown fallback references', () => {
    const steps = [{ ...makeStep('a'), fallback_step_id: 'nope' }];
    expect(validateDAG(steps)).toContain('unknown fallback');
  });
});

// ──────────────────────────────────────────────
// Condition Evaluation
// ──────────────────────────────────────────────

describe('evaluateCondition', () => {
  const makeStepMap = (result: Record<string, unknown>): Map<string, StepExecution> => {
    return new Map([
      [
        'research',
        {
          step_id: 'research',
          status: 'completed',
          result,
          attempts: 1,
        },
      ],
    ]);
  };

  it('evaluates "eq" correctly', () => {
    const condition: StepCondition = {
      source_step_id: 'research',
      field: 'category',
      operator: 'eq',
      value: 'technology',
    };
    expect(evaluateCondition(condition, makeStepMap({ category: 'technology' }))).toBe(true);
    expect(evaluateCondition(condition, makeStepMap({ category: 'sports' }))).toBe(false);
  });

  it('evaluates "gt" for numeric fields', () => {
    const condition: StepCondition = {
      source_step_id: 'research',
      field: 'confidence',
      operator: 'gt',
      value: 0.8,
    };
    expect(evaluateCondition(condition, makeStepMap({ confidence: 0.9 }))).toBe(true);
    expect(evaluateCondition(condition, makeStepMap({ confidence: 0.5 }))).toBe(false);
  });

  it('evaluates "exists"', () => {
    const condition: StepCondition = {
      source_step_id: 'research',
      field: 'summary',
      operator: 'exists',
    };
    expect(evaluateCondition(condition, makeStepMap({ summary: 'hello' }))).toBe(true);
    expect(evaluateCondition(condition, makeStepMap({}))).toBe(false);
  });

  it('evaluates "contains" on strings', () => {
    const condition: StepCondition = {
      source_step_id: 'research',
      field: 'tags',
      operator: 'contains',
      value: 'ai',
    };
    expect(evaluateCondition(condition, makeStepMap({ tags: 'ai, ml, robotics' }))).toBe(true);
    expect(evaluateCondition(condition, makeStepMap({ tags: 'web, design' }))).toBe(false);
  });

  it('evaluates "contains" on arrays', () => {
    const condition: StepCondition = {
      source_step_id: 'research',
      field: 'labels',
      operator: 'contains',
      value: 'urgent',
    };
    expect(evaluateCondition(condition, makeStepMap({ labels: ['urgent', 'bug'] }))).toBe(true);
    expect(evaluateCondition(condition, makeStepMap({ labels: ['feature'] }))).toBe(false);
  });

  it('returns false for non-completed steps', () => {
    const map = new Map<string, StepExecution>([
      ['research', { step_id: 'research', status: 'running', attempts: 1 }],
    ]);
    const condition: StepCondition = {
      source_step_id: 'research',
      field: 'done',
      operator: 'exists',
    };
    expect(evaluateCondition(condition, map)).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Template Interpolation
// ──────────────────────────────────────────────

describe('interpolateTemplate', () => {
  const stepMap = new Map<string, StepExecution>([
    [
      'research',
      {
        step_id: 'research',
        status: 'completed',
        result: { findings: 'AI is growing', confidence: 0.95, items: ['a', 'b'] },
        attempts: 1,
      },
    ],
  ]);

  it('interpolates workflow input references', () => {
    const template = { query: '{{workflow.input.topic}}' };
    const result = interpolateTemplate(template, { topic: 'quantum computing' }, stepMap);
    expect(result.query).toBe('quantum computing');
  });

  it('interpolates step result references', () => {
    const template = { summary_of: '{{steps.research.result.findings}}' };
    const result = interpolateTemplate(template, {}, stepMap);
    expect(result.summary_of).toBe('AI is growing');
  });

  it('interpolates nested paths', () => {
    const template = { first_item: '{{steps.research.result.items.0}}' };
    const result = interpolateTemplate(template, {}, stepMap);
    expect(result.first_item).toBe('a');
  });

  it('handles missing references gracefully', () => {
    const template = { data: '{{steps.nonexistent.result.value}}' };
    const result = interpolateTemplate(template, {}, stepMap);
    expect(result.data).toBe('');
  });

  it('preserves non-template values', () => {
    const template = { static: 'hello', number: 42 };
    const result = interpolateTemplate(template, {}, stepMap);
    expect(result.static).toBe('hello');
    expect(result.number).toBe(42);
  });
});

// ──────────────────────────────────────────────
// Progress Computation
// ──────────────────────────────────────────────

describe('computeProgress', () => {
  it('returns 0 for empty steps', () => {
    expect(computeProgress([])).toBe(0);
  });

  it('returns 0 when all steps are pending', () => {
    const steps: StepExecution[] = [
      { step_id: 'a', status: 'pending', attempts: 0 },
      { step_id: 'b', status: 'pending', attempts: 0 },
    ];
    expect(computeProgress(steps)).toBe(0);
  });

  it('computes partial progress', () => {
    const steps: StepExecution[] = [
      { step_id: 'a', status: 'completed', attempts: 1 },
      { step_id: 'b', status: 'running', attempts: 1 },
      { step_id: 'c', status: 'pending', attempts: 0 },
      { step_id: 'd', status: 'skipped', attempts: 0 },
    ];
    expect(computeProgress(steps)).toBe(0.5); // 2 of 4 terminal
  });

  it('returns 1 when all steps are terminal', () => {
    const steps: StepExecution[] = [
      { step_id: 'a', status: 'completed', attempts: 1 },
      { step_id: 'b', status: 'skipped', attempts: 0 },
      { step_id: 'c', status: 'failed', attempts: 2 },
    ];
    expect(computeProgress(steps)).toBe(1);
  });
});

describe('getStepCategories', () => {
  it('categorizes steps correctly', () => {
    const steps: StepExecution[] = [
      { step_id: 'a', status: 'completed', attempts: 1 },
      { step_id: 'b', status: 'running', attempts: 1 },
      { step_id: 'c', status: 'pending', attempts: 0 },
      { step_id: 'd', status: 'ready', attempts: 0 },
    ];
    const { active, blocked } = getStepCategories(steps);
    expect(active).toEqual(['b', 'd']);
    expect(blocked).toEqual(['c']);
  });
});
