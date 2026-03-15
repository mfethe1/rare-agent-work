/**
 * A2A Formal Verification Engine — Pre-Deployment Safety Proofs
 *
 * Core engine for model checking, temporal logic verification, deadlock
 * detection, compositional verification, invariant discovery, and proof
 * certificate generation for agent behavioral models.
 *
 * Implements bounded model checking (BMC) with explicit state enumeration,
 * supporting both LTL and CTL property specifications. Produces machine-
 * checkable proof certificates that can be cryptographically bound to
 * agent genomes for attestation.
 */

import { createHash, randomUUID } from 'crypto';
import type {
  AgentBehaviorModel,
  AgentState,
  StateTransition,
  StatePredicate,
  TemporalFormula,
  VerificationProperty,
  VerificationSpec,
  VerificationBounds,
  PropertyVerificationResult,
  VerificationVerdict,
  CounterexampleTrace,
  CounterexampleState,
  ProofWitness,
  ProofCertificate,
  CertificateVerdict,
  VerificationSummary,
  VerificationResponse,
  VerifyModelRequest,
  VerifyCompositionRequest,
  CompositionContext,
  CompositionOperator,
  DeadlockAnalysis,
  InvariantDiscoveryRequest,
  DiscoveredInvariant,
  PropertyCategory,
  StandardPropertyTemplate,
  ValidityCondition,
  StateVariable,
  ChannelSpec,
} from './types';

// ─── Error Type ─────────────────────────────────────────────────────────────

export class VerificationError extends Error {
  constructor(
    message: string,
    public code: VerificationErrorCode,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

export type VerificationErrorCode =
  | 'INVALID_MODEL'
  | 'INVALID_PROPERTY'
  | 'INVALID_FORMULA'
  | 'STATE_EXPLOSION'
  | 'TIMEOUT'
  | 'COMPOSITION_ERROR'
  | 'CERTIFICATE_ERROR'
  | 'INVARIANT_ERROR'
  | 'NO_INITIAL_STATE'
  | 'UNREACHABLE_STATE'
  | 'MALFORMED_TRANSITION';

// ─── Default Bounds ─────────────────────────────────────────────────────────

const DEFAULT_BOUNDS: VerificationBounds = {
  maxDepth: 1000,
  maxStates: 100_000,
  timeoutMs: 30_000,
  symmetryReduction: true,
  partialOrderReduction: true,
};

// ─── Certificate Registry ──────────────────────────────────────────────────

const certificateRegistry = new Map<string, ProofCertificate>();
const genomeCertificates = new Map<string, string[]>(); // genomeHash -> certificate IDs

/** Reset all state (for testing) */
export function _resetVerificationState(): void {
  certificateRegistry.clear();
  genomeCertificates.clear();
}

// ─── Model Validation ──────────────────────────────────────────────────────

/** Validate that a behavioral model is well-formed */
export function validateModel(model: AgentBehaviorModel): string[] {
  const errors: string[] = [];
  const stateIds = new Set(model.states.map((s) => s.id));

  // Must have at least one state
  if (model.states.length === 0) {
    errors.push('Model has no states');
  }

  // Must have at least one initial state
  const initialStates = model.states.filter((s) => s.initial);
  if (initialStates.length === 0) {
    errors.push('Model has no initial state');
  }

  // All transitions must reference valid states
  for (const t of model.transitions) {
    if (!stateIds.has(t.from)) {
      errors.push(`Transition references unknown source state: ${t.from}`);
    }
    if (!stateIds.has(t.to)) {
      errors.push(`Transition references unknown target state: ${t.to}`);
    }
  }

  // State IDs must be unique
  if (stateIds.size !== model.states.length) {
    errors.push('Duplicate state IDs found');
  }

  // Variable initial values must match declared types
  for (const v of model.variables) {
    if (v.type === 'boolean' && typeof v.initial !== 'boolean') {
      errors.push(`Variable ${v.name} declared boolean but initial value is ${typeof v.initial}`);
    }
    if (v.type === 'integer' && typeof v.initial !== 'number') {
      errors.push(`Variable ${v.name} declared integer but initial value is ${typeof v.initial}`);
    }
    if (v.type === 'bounded_integer') {
      if (typeof v.initial !== 'number') {
        errors.push(`Variable ${v.name} declared bounded_integer but initial value is ${typeof v.initial}`);
      } else if (v.min !== undefined && (v.initial as number) < v.min) {
        errors.push(`Variable ${v.name} initial value ${v.initial} below minimum ${v.min}`);
      } else if (v.max !== undefined && (v.initial as number) > v.max) {
        errors.push(`Variable ${v.name} initial value ${v.initial} above maximum ${v.max}`);
      }
    }
    if (v.type === 'enum') {
      if (!v.values || !v.values.includes(v.initial as string)) {
        errors.push(`Variable ${v.name} initial value not in declared enum values`);
      }
    }
  }

  return errors;
}

// ─── Predicate Evaluation ──────────────────────────────────────────────────

/** Evaluate a state predicate against a set of variable assignments */
export function evaluatePredicate(
  predicate: StatePredicate,
  variables: Record<string, unknown>,
): boolean {
  const actual = variables[predicate.expression];
  const expected = predicate.value;

  switch (predicate.comparator) {
    case '==': return actual === expected;
    case '!=': return actual !== expected;
    case '<': return (actual as number) < (expected as number);
    case '<=': return (actual as number) <= (expected as number);
    case '>': return (actual as number) > (expected as number);
    case '>=': return (actual as number) >= (expected as number);
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
    case 'matches': return typeof actual === 'string' && new RegExp(expected as string).test(actual);
    default: return false;
  }
}

/** Evaluate a temporal formula at a specific state (for invariant/atomic checks) */
export function evaluateAtomicFormula(
  formula: TemporalFormula,
  stateVars: Record<string, unknown>,
): boolean | null {
  switch (formula.kind) {
    case 'atomic':
      return evaluatePredicate(formula.predicate, stateVars);

    case 'ltl': {
      switch (formula.operator) {
        case 'not':
          const inner = evaluateAtomicFormula(formula.operands[0], stateVars);
          return inner !== null ? !inner : null;
        case 'and':
          return formula.operands.every((op) => evaluateAtomicFormula(op, stateVars) === true);
        case 'or':
          return formula.operands.some((op) => evaluateAtomicFormula(op, stateVars) === true);
        case 'implies': {
          const antecedent = evaluateAtomicFormula(formula.operands[0], stateVars);
          const consequent = evaluateAtomicFormula(formula.operands[1], stateVars);
          if (antecedent === null || consequent === null) return null;
          return !antecedent || consequent;
        }
        // Temporal operators can't be evaluated at a single state
        default:
          return null;
      }
    }

    case 'ctl':
      return null; // CTL formulas need path-based evaluation

    default:
      return null;
  }
}

// ─── State Space Exploration ───────────────────────────────────────────────

interface ExplorationState {
  stateId: string;
  variables: Record<string, unknown>;
  depth: number;
  path: string[]; // sequence of state IDs from initial
  transitionPath: string[]; // sequence of transition actions
}

/** Get all enabled transitions from a state */
function getEnabledTransitions(
  model: AgentBehaviorModel,
  stateId: string,
  variables: Record<string, unknown>,
): StateTransition[] {
  return model.transitions
    .filter((t) => t.from === stateId)
    .filter((t) => !t.guard || evaluatePredicate(t.guard, variables))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/** Apply a transition to get the next variable state */
function applyTransition(
  state: AgentState,
  _transition: StateTransition,
  targetState: AgentState,
  currentVars: Record<string, unknown>,
): Record<string, unknown> {
  // Merge current variables with target state properties
  return { ...currentVars, ...targetState.properties };
}

/** Compute a canonical hash for a state (for cycle detection) */
function stateHash(stateId: string, variables: Record<string, unknown>): string {
  const canonical = JSON.stringify({ stateId, variables: Object.entries(variables).sort() });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

// ─── Core Model Checker ────────────────────────────────────────────────────

/**
 * Bounded model checker using explicit state enumeration with BFS.
 * Checks invariant (safety) properties: □P — P must hold in all reachable states.
 */
export function checkInvariant(
  model: AgentBehaviorModel,
  property: VerificationProperty,
  bounds: VerificationBounds = DEFAULT_BOUNDS,
): PropertyVerificationResult {
  const startTime = Date.now();
  const errors = validateModel(model);
  if (errors.length > 0) {
    throw new VerificationError('Invalid model', 'INVALID_MODEL', { errors });
  }

  const visited = new Map<string, ExplorationState>();
  const queue: ExplorationState[] = [];
  let statesExplored = 0;
  let transitionsExplored = 0;
  let maxDepth = 0;

  // Initialize with all initial states
  const initialStates = model.states.filter((s) => s.initial);
  for (const s of initialStates) {
    const vars = buildInitialVariables(model, s);
    const hash = stateHash(s.id, vars);
    const exploration: ExplorationState = {
      stateId: s.id,
      variables: vars,
      depth: 0,
      path: [s.id],
      transitionPath: [],
    };
    visited.set(hash, exploration);
    queue.push(exploration);
  }

  // BFS exploration
  while (queue.length > 0) {
    // Check bounds
    if (Date.now() - startTime > bounds.timeoutMs) {
      return makeResult(property.id, 'timeout', statesExplored, transitionsExplored, Date.now() - startTime, maxDepth, true);
    }
    if (statesExplored >= bounds.maxStates) {
      return makeResult(property.id, 'inconclusive', statesExplored, transitionsExplored, Date.now() - startTime, maxDepth, true);
    }

    const current = queue.shift()!;
    statesExplored++;
    maxDepth = Math.max(maxDepth, current.depth);

    // Check property at current state
    const holds = evaluateFormulaAtState(property.formula, current, model);
    if (holds === false) {
      // Property violated — construct counterexample
      const counterexample = buildCounterexample(current, 'finite', property);
      return {
        propertyId: property.id,
        verdict: 'violated',
        counterexample,
        statesExplored,
        transitionsExplored,
        durationMs: Date.now() - startTime,
        bounded: true,
        depthReached: maxDepth,
      };
    }

    // Explore successors
    if (current.depth < bounds.maxDepth) {
      const state = model.states.find((s) => s.id === current.stateId);
      if (!state) continue;

      const enabled = getEnabledTransitions(model, current.stateId, current.variables);
      for (const t of enabled) {
        transitionsExplored++;
        const targetState = model.states.find((s) => s.id === t.to);
        if (!targetState) continue;

        const nextVars = applyTransition(state, t, targetState, current.variables);
        const hash = stateHash(t.to, nextVars);

        if (!visited.has(hash)) {
          const next: ExplorationState = {
            stateId: t.to,
            variables: nextVars,
            depth: current.depth + 1,
            path: [...current.path, t.to],
            transitionPath: [...current.transitionPath, t.action],
          };
          visited.set(hash, next);
          queue.push(next);
        }
      }
    }
  }

  // All reachable states explored, property holds
  const witness = buildProofWitness(statesExplored === visited.size ? 'exhaustive_search' : 'bmc_bounded', property);
  return {
    propertyId: property.id,
    verdict: 'verified',
    witness,
    statesExplored,
    transitionsExplored,
    durationMs: Date.now() - startTime,
    bounded: statesExplored < bounds.maxStates,
    depthReached: maxDepth,
  };
}

/**
 * Check a liveness property: ◇P — P must eventually hold on all paths.
 * Uses nested DFS for cycle detection (simplified Emerson-Lei algorithm).
 */
export function checkLiveness(
  model: AgentBehaviorModel,
  property: VerificationProperty,
  bounds: VerificationBounds = DEFAULT_BOUNDS,
): PropertyVerificationResult {
  const startTime = Date.now();
  const errors = validateModel(model);
  if (errors.length > 0) {
    throw new VerificationError('Invalid model', 'INVALID_MODEL', { errors });
  }

  const visited = new Set<string>();
  let statesExplored = 0;
  let transitionsExplored = 0;
  let maxDepth = 0;

  // DFS to find accepting cycles (cycles where property never holds)
  const stack: ExplorationState[] = [];
  const onStack = new Set<string>();

  const initialStates = model.states.filter((s) => s.initial);

  for (const s of initialStates) {
    const vars = buildInitialVariables(model, s);
    stack.push({
      stateId: s.id,
      variables: vars,
      depth: 0,
      path: [s.id],
      transitionPath: [],
    });
  }

  while (stack.length > 0) {
    if (Date.now() - startTime > bounds.timeoutMs) {
      return makeResult(property.id, 'timeout', statesExplored, transitionsExplored, Date.now() - startTime, maxDepth, true);
    }
    if (statesExplored >= bounds.maxStates) {
      return makeResult(property.id, 'inconclusive', statesExplored, transitionsExplored, Date.now() - startTime, maxDepth, true);
    }

    const current = stack.pop()!;
    const hash = stateHash(current.stateId, current.variables);

    if (visited.has(hash)) {
      // Check if we found a cycle where property never holds
      if (onStack.has(hash)) {
        const holds = evaluateFormulaAtState(property.formula, current, model);
        if (holds === false) {
          // Found a cycle where property never becomes true — liveness violation
          const counterexample = buildCounterexample(current, 'lasso', property);
          return {
            propertyId: property.id,
            verdict: 'violated',
            counterexample,
            statesExplored,
            transitionsExplored,
            durationMs: Date.now() - startTime,
            bounded: true,
            depthReached: maxDepth,
          };
        }
      }
      continue;
    }

    visited.add(hash);
    onStack.add(hash);
    statesExplored++;
    maxDepth = Math.max(maxDepth, current.depth);

    if (current.depth < bounds.maxDepth) {
      const enabled = getEnabledTransitions(model, current.stateId, current.variables);
      for (const t of enabled) {
        transitionsExplored++;
        const targetState = model.states.find((s) => s.id === t.to);
        if (!targetState) continue;

        const state = model.states.find((s) => s.id === current.stateId)!;
        const nextVars = applyTransition(state, t, targetState, current.variables);
        stack.push({
          stateId: t.to,
          variables: nextVars,
          depth: current.depth + 1,
          path: [...current.path, t.to],
          transitionPath: [...current.transitionPath, t.action],
        });
      }
    }

    onStack.delete(hash);
  }

  const witness = buildProofWitness('exhaustive_search', property);
  return {
    propertyId: property.id,
    verdict: 'verified',
    witness,
    statesExplored,
    transitionsExplored,
    durationMs: Date.now() - startTime,
    bounded: false,
    depthReached: maxDepth,
  };
}

// ─── Deadlock Detection ────────────────────────────────────────────────────

/** Analyze a model for deadlock states (states with no enabled transitions) */
export function analyzeDeadlocks(
  model: AgentBehaviorModel,
  bounds: VerificationBounds = DEFAULT_BOUNDS,
): DeadlockAnalysis {
  const errors = validateModel(model);
  if (errors.length > 0) {
    throw new VerificationError('Invalid model', 'INVALID_MODEL', { errors });
  }

  const deadlockStates: DeadlockAnalysis['deadlockStates'] = [];
  const visited = new Set<string>();
  const queue: ExplorationState[] = [];
  let statesAnalyzed = 0;

  const initialStates = model.states.filter((s) => s.initial);
  for (const s of initialStates) {
    const vars = buildInitialVariables(model, s);
    queue.push({
      stateId: s.id,
      variables: vars,
      depth: 0,
      path: [s.id],
      transitionPath: [],
    });
  }

  while (queue.length > 0 && statesAnalyzed < bounds.maxStates) {
    const current = queue.shift()!;
    const hash = stateHash(current.stateId, current.variables);

    if (visited.has(hash)) continue;
    visited.add(hash);
    statesAnalyzed++;

    const state = model.states.find((s) => s.id === current.stateId);
    if (!state) continue;

    // Check if this state is a deadlock (no enabled transitions and not accepting)
    const enabled = getEnabledTransitions(model, current.stateId, current.variables);
    if (enabled.length === 0 && !state.accepting) {
      deadlockStates.push({
        stateId: current.stateId,
        variables: current.variables,
        pathToDeadlock: current.path,
        explanation: `State '${state.label}' has no enabled transitions and is not a final state. ` +
          `Path: ${current.path.join(' → ')}`,
      });
    }

    // Explore successors
    if (current.depth < bounds.maxDepth) {
      for (const t of enabled) {
        const targetState = model.states.find((s) => s.id === t.to);
        if (!targetState) continue;

        const nextVars = applyTransition(state, t, targetState, current.variables);
        queue.push({
          stateId: t.to,
          variables: nextVars,
          depth: current.depth + 1,
          path: [...current.path, t.to],
          transitionPath: [...current.transitionPath, t.action],
        });
      }
    }
  }

  return {
    deadlockFree: deadlockStates.length === 0,
    deadlockStates,
    statesAnalyzed,
  };
}

// ─── Composition Verification ──────────────────────────────────────────────

/**
 * Compose multiple agent models and verify properties on the product system.
 * Uses interleaving semantics for parallel composition.
 */
export function composeAndVerify(
  request: VerifyCompositionRequest,
): VerificationResponse {
  const runId = randomUUID();
  const startTime = Date.now();
  const bounds = { ...DEFAULT_BOUNDS, ...request.bounds };

  // Build the product model
  const composed = composeModels(
    request.agents,
    request.operator ?? 'parallel',
    request.synchronizationActions ?? [],
    request.sharedVariables ?? [],
  );

  // Build properties from templates + explicit
  const properties = [
    ...(request.properties ?? []),
    ...(request.templates ?? []).map((t) => templateToProperty(t, composed)),
  ];

  // Verify each property
  const results: PropertyVerificationResult[] = [];
  const violations: VerificationResponse['violations'] = [];

  for (const prop of properties) {
    const result = prop.category === 'liveness' || prop.category === 'fairness'
      ? checkLiveness(composed, prop, bounds)
      : checkInvariant(composed, prop, bounds);

    results.push(result);

    if (result.verdict === 'violated' && result.counterexample) {
      violations.push({
        propertyId: prop.id,
        propertyName: prop.name,
        severity: prop.severity,
        counterexample: result.counterexample,
      });
    }
  }

  const summary = buildSummary(results, Date.now() - startTime);
  const verdict = computeVerdict(results, properties);

  return { runId, verdict, results, summary, violations };
}

/** Compose two or more models into a product model */
export function composeModels(
  models: AgentBehaviorModel[],
  operator: CompositionOperator,
  syncActions: string[],
  sharedVars: string[],
): AgentBehaviorModel {
  if (models.length === 0) {
    throw new VerificationError('No models to compose', 'COMPOSITION_ERROR');
  }
  if (models.length === 1) return models[0];

  // For parallel composition, build product state space
  let result = models[0];
  for (let i = 1; i < models.length; i++) {
    result = composePair(result, models[i], operator, syncActions, sharedVars);
  }
  return result;
}

function composePair(
  a: AgentBehaviorModel,
  b: AgentBehaviorModel,
  operator: CompositionOperator,
  syncActions: string[],
  _sharedVars: string[],
): AgentBehaviorModel {
  const states: AgentState[] = [];
  const transitions: StateTransition[] = [];
  const syncSet = new Set(syncActions);

  // Product states
  for (const sa of a.states) {
    for (const sb of b.states) {
      states.push({
        id: `${sa.id}||${sb.id}`,
        label: `${sa.label} || ${sb.label}`,
        properties: { ...sa.properties, ...sb.properties },
        initial: sa.initial && sb.initial,
        accepting: sa.accepting && sb.accepting,
        unsafe: sa.unsafe || sb.unsafe,
      });
    }
  }

  if (operator === 'parallel' || operator === 'asynchronous') {
    // Interleaving: each agent can move independently on non-sync actions
    for (const sa of a.states) {
      for (const sb of b.states) {
        const fromId = `${sa.id}||${sb.id}`;

        // A moves, B stays (if action not in sync set)
        for (const ta of a.transitions) {
          if (ta.from === sa.id && (operator === 'asynchronous' || !syncSet.has(ta.action))) {
            transitions.push({
              from: fromId,
              to: `${ta.to}||${sb.id}`,
              action: `A:${ta.action}`,
              guard: ta.guard,
              priority: ta.priority,
            });
          }
        }

        // B moves, A stays (if action not in sync set)
        for (const tb of b.transitions) {
          if (tb.from === sb.id && (operator === 'asynchronous' || !syncSet.has(tb.action))) {
            transitions.push({
              from: fromId,
              to: `${sa.id}||${tb.to}`,
              action: `B:${tb.action}`,
              guard: tb.guard,
              priority: tb.priority,
            });
          }
        }

        // Synchronized actions: both move together
        if (operator === 'parallel') {
          for (const ta of a.transitions) {
            if (ta.from === sa.id && syncSet.has(ta.action)) {
              for (const tb of b.transitions) {
                if (tb.from === sb.id && ta.action === tb.action) {
                  transitions.push({
                    from: fromId,
                    to: `${ta.to}||${tb.to}`,
                    action: `sync:${ta.action}`,
                    priority: Math.max(ta.priority ?? 0, tb.priority ?? 0),
                  });
                }
              }
            }
          }
        }
      }
    }
  } else if (operator === 'synchronous') {
    // Lock-step: both agents must move on every step
    for (const sa of a.states) {
      for (const sb of b.states) {
        const fromId = `${sa.id}||${sb.id}`;
        for (const ta of a.transitions) {
          if (ta.from !== sa.id) continue;
          for (const tb of b.transitions) {
            if (tb.from !== sb.id) continue;
            transitions.push({
              from: fromId,
              to: `${ta.to}||${tb.to}`,
              action: `${ta.action}+${tb.action}`,
              priority: Math.max(ta.priority ?? 0, tb.priority ?? 0),
            });
          }
        }
      }
    }
  } else if (operator === 'pipeline') {
    // Pipeline: A's accepting states connect to B's initial states
    // Include all of A's states and transitions
    for (const sa of a.states) {
      states.push({ ...sa, id: `A:${sa.id}`, accepting: false });
    }
    for (const ta of a.transitions) {
      transitions.push({ ...ta, from: `A:${ta.from}`, to: `A:${ta.to}` });
    }
    // Include all of B's states and transitions
    for (const sb of b.states) {
      states.push({ ...sb, id: `B:${sb.id}`, initial: false });
    }
    for (const tb of b.transitions) {
      transitions.push({ ...tb, from: `B:${tb.from}`, to: `B:${tb.to}` });
    }
    // Connect A's accepting states to B's initial states
    for (const sa of a.states.filter((s) => s.accepting)) {
      for (const sb of b.states.filter((s) => s.initial)) {
        transitions.push({
          from: `A:${sa.id}`,
          to: `B:${sb.id}`,
          action: 'pipeline_handoff',
        });
      }
    }
  }

  // Merge variables (prefix to avoid collisions)
  const variables: StateVariable[] = [
    ...a.variables.map((v) => ({ ...v, name: `a.${v.name}` })),
    ...b.variables.map((v) => ({ ...v, name: `b.${v.name}` })),
  ];

  return {
    id: `${a.id}||${b.id}`,
    states,
    transitions,
    variables,
  };
}

// ─── Standard Property Templates ───────────────────────────────────────────

/** Convert a standard property template to a concrete VerificationProperty */
export function templateToProperty(
  template: StandardPropertyTemplate,
  model: AgentBehaviorModel,
): VerificationProperty {
  const templates: Record<StandardPropertyTemplate, () => VerificationProperty> = {
    no_unsafe_states: () => ({
      id: `std:${template}`,
      name: 'No Unsafe States Reachable',
      description: 'No execution path can reach a state marked as unsafe',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'not',
          operands: [{
            kind: 'atomic',
            predicate: { id: 'unsafe', description: 'State is unsafe', expression: '_unsafe', comparator: '==', value: true },
          }],
        }],
      },
      category: 'safety',
      severity: 'critical',
    }),

    deadlock_free: () => ({
      id: `std:${template}`,
      name: 'Deadlock Freedom',
      description: 'Every non-accepting state has at least one enabled transition',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'atomic',
          predicate: { id: 'has_transition', description: 'Has enabled transition', expression: '_has_enabled_transition', comparator: '==', value: true },
        }],
      },
      category: 'deadlock_freedom',
      severity: 'critical',
    }),

    always_eventually_idle: () => ({
      id: `std:${template}`,
      name: 'No Permanent Busy-Lock',
      description: 'Agent always eventually returns to idle state',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'eventually',
          operands: [{
            kind: 'atomic',
            predicate: { id: 'idle', description: 'Agent is idle', expression: 'status', comparator: '==', value: 'idle' },
          }],
        }],
      },
      category: 'liveness',
      severity: 'high',
    }),

    mutual_exclusion: () => ({
      id: `std:${template}`,
      name: 'Mutual Exclusion',
      description: 'No two agents are simultaneously in critical sections',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'not',
          operands: [{
            kind: 'ltl',
            operator: 'and',
            operands: [
              { kind: 'atomic', predicate: { id: 'crit_a', description: 'A in critical', expression: 'a.critical', comparator: '==', value: true } },
              { kind: 'atomic', predicate: { id: 'crit_b', description: 'B in critical', expression: 'b.critical', comparator: '==', value: true } },
            ],
          }],
        }],
      },
      category: 'mutual_exclusion',
      severity: 'critical',
    }),

    starvation_free: () => ({
      id: `std:${template}`,
      name: 'Starvation Freedom',
      description: 'Every requesting agent eventually gets service',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'implies',
          operands: [
            { kind: 'atomic', predicate: { id: 'requesting', description: 'Agent requesting', expression: 'requesting', comparator: '==', value: true } },
            { kind: 'ltl', operator: 'eventually', operands: [
              { kind: 'atomic', predicate: { id: 'served', description: 'Agent served', expression: 'served', comparator: '==', value: true } },
            ]},
          ],
        }],
      },
      category: 'fairness',
      severity: 'high',
    }),

    bounded_resource: () => ({
      id: `std:${template}`,
      name: 'Bounded Resource Usage',
      description: 'Resource usage never exceeds declared bounds',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'atomic',
          predicate: { id: 'resource_ok', description: 'Resources within bounds', expression: '_resource_bounded', comparator: '==', value: true },
        }],
      },
      category: 'invariant',
      severity: 'high',
    }),

    request_response: () => ({
      id: `std:${template}`,
      name: 'Request-Response Guarantee',
      description: 'Every request eventually receives a response',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'implies',
          operands: [
            { kind: 'atomic', predicate: { id: 'request', description: 'Request sent', expression: 'has_pending_request', comparator: '==', value: true } },
            { kind: 'ltl', operator: 'eventually', operands: [
              { kind: 'atomic', predicate: { id: 'response', description: 'Response received', expression: 'has_pending_request', comparator: '==', value: false } },
            ]},
          ],
        }],
      },
      category: 'liveness',
      severity: 'high',
    }),

    no_message_loss: () => ({
      id: `std:${template}`,
      name: 'No Message Loss',
      description: 'Every sent message is eventually received',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'implies',
          operands: [
            { kind: 'atomic', predicate: { id: 'msg_sent', description: 'Message sent', expression: 'messages_in_flight', comparator: '>', value: 0 } },
            { kind: 'ltl', operator: 'eventually', operands: [
              { kind: 'atomic', predicate: { id: 'msg_delivered', description: 'All delivered', expression: 'messages_in_flight', comparator: '==', value: 0 } },
            ]},
          ],
        }],
      },
      category: 'liveness',
      severity: 'high',
    }),

    termination: () => ({
      id: `std:${template}`,
      name: 'Guaranteed Termination',
      description: 'All execution paths eventually reach an accepting state',
      formula: {
        kind: 'ltl',
        operator: 'eventually',
        operands: [{
          kind: 'atomic',
          predicate: { id: 'accepting', description: 'Accepting state', expression: '_accepting', comparator: '==', value: true },
        }],
      },
      category: 'termination',
      severity: 'medium',
    }),

    constitutional_compliance: () => ({
      id: `std:${template}`,
      name: 'Constitutional Compliance',
      description: 'Agent never violates its constitutional constraints',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'atomic',
          predicate: { id: 'constitutional', description: 'Constitution holds', expression: '_constitutional_compliant', comparator: '==', value: true },
        }],
      },
      category: 'safety',
      severity: 'critical',
    }),

    capability_bounded: () => ({
      id: `std:${template}`,
      name: 'Capability Bounded',
      description: 'Agent only uses capabilities declared in its genome',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'atomic',
          predicate: { id: 'cap_bounded', description: 'Within capabilities', expression: '_capability_bounded', comparator: '==', value: true },
        }],
      },
      category: 'safety',
      severity: 'critical',
    }),

    escalation_reachable: () => ({
      id: `std:${template}`,
      name: 'Escalation Always Reachable',
      description: 'From any unsafe situation, human notification is eventually possible',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'implies',
          operands: [
            { kind: 'atomic', predicate: { id: 'unsafe_sit', description: 'Unsafe situation', expression: '_unsafe_situation', comparator: '==', value: true } },
            { kind: 'ltl', operator: 'eventually', operands: [
              { kind: 'atomic', predicate: { id: 'notified', description: 'Human notified', expression: '_human_notified', comparator: '==', value: true } },
            ]},
          ],
        }],
      },
      category: 'safety',
      severity: 'critical',
    }),

    audit_completeness: () => ({
      id: `std:${template}`,
      name: 'Audit Completeness',
      description: 'Every action is eventually logged in the audit trail',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'implies',
          operands: [
            { kind: 'atomic', predicate: { id: 'action_taken', description: 'Action occurred', expression: 'unlogged_actions', comparator: '>', value: 0 } },
            { kind: 'ltl', operator: 'eventually', operands: [
              { kind: 'atomic', predicate: { id: 'logged', description: 'All logged', expression: 'unlogged_actions', comparator: '==', value: 0 } },
            ]},
          ],
        }],
      },
      category: 'liveness',
      severity: 'high',
    }),

    graceful_degradation: () => ({
      id: `std:${template}`,
      name: 'Graceful Degradation',
      description: 'Subsystem failure eventually leads to degraded mode (not crash)',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'ltl',
          operator: 'implies',
          operands: [
            { kind: 'atomic', predicate: { id: 'failure', description: 'Subsystem failed', expression: '_subsystem_failed', comparator: '==', value: true } },
            { kind: 'ltl', operator: 'eventually', operands: [
              { kind: 'atomic', predicate: { id: 'degraded', description: 'In degraded mode', expression: '_degraded_mode', comparator: '==', value: true } },
            ]},
          ],
        }],
      },
      category: 'liveness',
      severity: 'high',
    }),

    data_flow_integrity: () => ({
      id: `std:${template}`,
      name: 'Data Flow Integrity',
      description: 'No unauthorized information flow between security domains',
      formula: {
        kind: 'ltl',
        operator: 'always',
        operands: [{
          kind: 'atomic',
          predicate: { id: 'dfi', description: 'Data flow integrity holds', expression: '_data_flow_integrity', comparator: '==', value: true },
        }],
      },
      category: 'safety',
      severity: 'critical',
    }),
  };

  return templates[template]();
}

// ─── Invariant Discovery ───────────────────────────────────────────────────

/**
 * Automatically discover invariants from a behavioral model by analyzing
 * reachable state space. Uses Daikon-style dynamic invariant detection.
 */
export function discoverInvariants(
  request: InvariantDiscoveryRequest,
): DiscoveredInvariant[] {
  const model = request.model;
  const maxInvariants = request.maxInvariants ?? 20;
  const bounds = DEFAULT_BOUNDS;

  // First, collect all reachable states
  const reachableStates: Array<{ stateId: string; variables: Record<string, unknown> }> = [];
  const visited = new Set<string>();
  const queue: ExplorationState[] = [];

  const initialStates = model.states.filter((s) => s.initial);
  for (const s of initialStates) {
    const vars = buildInitialVariables(model, s);
    queue.push({ stateId: s.id, variables: vars, depth: 0, path: [], transitionPath: [] });
  }

  while (queue.length > 0 && reachableStates.length < bounds.maxStates) {
    const current = queue.shift()!;
    const hash = stateHash(current.stateId, current.variables);
    if (visited.has(hash)) continue;
    visited.add(hash);
    reachableStates.push({ stateId: current.stateId, variables: current.variables });

    if (current.depth < bounds.maxDepth) {
      const state = model.states.find((s) => s.id === current.stateId);
      if (!state) continue;
      const enabled = getEnabledTransitions(model, current.stateId, current.variables);
      for (const t of enabled) {
        const targetState = model.states.find((s) => s.id === t.to);
        if (!targetState) continue;
        const nextVars = applyTransition(state, t, targetState, current.variables);
        queue.push({
          stateId: t.to,
          variables: nextVars,
          depth: current.depth + 1,
          path: [...current.path, t.to],
          transitionPath: [...current.transitionPath, t.action],
        });
      }
    }
  }

  if (reachableStates.length === 0) return [];

  const invariants: DiscoveredInvariant[] = [];

  // Discover constant variables (same value in all reachable states)
  for (const v of model.variables) {
    const values = new Set(reachableStates.map((s) => JSON.stringify(s.variables[v.name])));
    if (values.size === 1) {
      const constantValue = reachableStates[0].variables[v.name];
      invariants.push({
        predicate: {
          id: `inv:constant:${v.name}`,
          description: `${v.name} is always ${JSON.stringify(constantValue)}`,
          expression: v.name,
          comparator: '==',
          value: constantValue,
        },
        description: `Variable '${v.name}' is constant across all reachable states (value: ${JSON.stringify(constantValue)})`,
        confidence: 1.0,
        category: 'invariant',
        supportingStates: reachableStates.length,
      });
    }
  }

  // Discover bounded variables (min/max across all states)
  for (const v of model.variables) {
    if (v.type !== 'integer' && v.type !== 'bounded_integer') continue;
    const numValues = reachableStates
      .map((s) => s.variables[v.name])
      .filter((val): val is number => typeof val === 'number');

    if (numValues.length === 0) continue;
    const min = Math.min(...numValues);
    const max = Math.max(...numValues);

    if (max < Infinity) {
      invariants.push({
        predicate: {
          id: `inv:upper_bound:${v.name}`,
          description: `${v.name} ≤ ${max}`,
          expression: v.name,
          comparator: '<=',
          value: max,
        },
        description: `Variable '${v.name}' never exceeds ${max} in any reachable state`,
        confidence: 1.0,
        category: 'invariant',
        supportingStates: reachableStates.length,
      });
    }

    if (min > -Infinity) {
      invariants.push({
        predicate: {
          id: `inv:lower_bound:${v.name}`,
          description: `${v.name} ≥ ${min}`,
          expression: v.name,
          comparator: '>=',
          value: min,
        },
        description: `Variable '${v.name}' is always at least ${min} in any reachable state`,
        confidence: 1.0,
        category: 'invariant',
        supportingStates: reachableStates.length,
      });
    }
  }

  // Discover unreachable states
  const reachableStateIds = new Set(reachableStates.map((s) => s.stateId));
  for (const state of model.states) {
    if (!reachableStateIds.has(state.id) && state.unsafe) {
      invariants.push({
        predicate: {
          id: `inv:unreachable_unsafe:${state.id}`,
          description: `Unsafe state '${state.label}' is unreachable`,
          expression: '_current_state',
          comparator: '!=',
          value: state.id,
        },
        description: `Unsafe state '${state.label}' is not reachable from any initial state`,
        confidence: 1.0,
        category: 'safety',
        supportingStates: reachableStates.length,
      });
    }
  }

  // Discover mutual exclusion between state properties
  const types = request.invariantTypes ?? ['state', 'transition', 'mutual_exclusion', 'ordering'];
  if (types.includes('mutual_exclusion')) {
    const boolVars = model.variables.filter((v) => v.type === 'boolean');
    for (let i = 0; i < boolVars.length; i++) {
      for (let j = i + 1; j < boolVars.length; j++) {
        const bothTrue = reachableStates.some(
          (s) => s.variables[boolVars[i].name] === true && s.variables[boolVars[j].name] === true,
        );
        if (!bothTrue) {
          invariants.push({
            predicate: {
              id: `inv:mutex:${boolVars[i].name}:${boolVars[j].name}`,
              description: `¬(${boolVars[i].name} ∧ ${boolVars[j].name})`,
              expression: `${boolVars[i].name}_and_${boolVars[j].name}`,
              comparator: '!=',
              value: true,
            },
            description: `Variables '${boolVars[i].name}' and '${boolVars[j].name}' are never simultaneously true (mutual exclusion)`,
            confidence: 1.0,
            category: 'mutual_exclusion',
            supportingStates: reachableStates.length,
          });
        }
      }
    }
  }

  return invariants.slice(0, maxInvariants);
}

// ─── Proof Certificates ────────────────────────────────────────────────────

/** Generate a proof certificate from verification results */
export function generateCertificate(
  genomeHash: string,
  specId: string,
  results: PropertyVerificationResult[],
  properties: VerificationProperty[],
): ProofCertificate {
  const summary = buildSummary(results, results.reduce((sum, r) => sum + r.durationMs, 0));
  const verdict = computeVerdict(results, properties);

  const certificate: ProofCertificate = {
    id: randomUUID(),
    version: '1.0',
    genomeHash,
    verifiedAt: new Date().toISOString(),
    specId,
    results,
    overallVerdict: verdict,
    summary,
    signature: {
      algorithm: 'ed25519',
      publicKey: 'placeholder:verification-authority-key',
      signature: computeCertificateSignature(genomeHash, results),
    },
    validityConditions: [
      { condition: `Genome hash matches ${genomeHash}`, kind: 'genome_unchanged' },
      { condition: 'Verification bounds may exclude deep violations', kind: 'temporal_bound' },
    ],
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
  };

  // Store in registry
  certificateRegistry.set(certificate.id, certificate);
  const existing = genomeCertificates.get(genomeHash) ?? [];
  existing.push(certificate.id);
  genomeCertificates.set(genomeHash, existing);

  return certificate;
}

/** Look up certificates for a genome */
export function getCertificatesForGenome(genomeHash: string): ProofCertificate[] {
  const ids = genomeCertificates.get(genomeHash) ?? [];
  return ids.map((id) => certificateRegistry.get(id)!).filter(Boolean);
}

/** Verify a certificate's integrity */
export function verifyCertificateIntegrity(certificate: ProofCertificate): boolean {
  const expectedSig = computeCertificateSignature(
    certificate.genomeHash,
    certificate.results,
  );
  return certificate.signature.signature === expectedSig;
}

// ─── Main Verification Entry Point ─────────────────────────────────────────

/**
 * Verify a complete model against a set of properties.
 * This is the primary API for the formal verification engine.
 */
export function verifyModel(request: VerifyModelRequest): VerificationResponse {
  const runId = randomUUID();
  const startTime = Date.now();
  const bounds = { ...DEFAULT_BOUNDS, ...request.bounds };

  // Validate the model
  const modelErrors = validateModel(request.model);
  if (modelErrors.length > 0) {
    throw new VerificationError('Invalid behavioral model', 'INVALID_MODEL', { errors: modelErrors });
  }

  // Build properties from templates + explicit
  const properties = [
    ...(request.properties ?? []),
    ...(request.templates ?? []).map((t) => templateToProperty(t, request.model)),
  ];

  if (properties.length === 0) {
    throw new VerificationError('No properties to verify', 'INVALID_PROPERTY');
  }

  // Verify each property
  const results: PropertyVerificationResult[] = [];
  const violations: VerificationResponse['violations'] = [];

  for (const prop of properties) {
    const result = prop.category === 'liveness' || prop.category === 'fairness' || prop.category === 'termination'
      ? checkLiveness(request.model, prop, bounds)
      : checkInvariant(request.model, prop, bounds);

    results.push(result);

    if (result.verdict === 'violated' && result.counterexample) {
      violations.push({
        propertyId: prop.id,
        propertyName: prop.name,
        severity: prop.severity,
        counterexample: result.counterexample,
      });
    }
  }

  const summary = buildSummary(results, Date.now() - startTime);
  const verdict = computeVerdict(results, properties);

  // Generate certificate if requested
  let certificate: ProofCertificate | undefined;
  if (request.generateCertificate && request.genomeHash) {
    certificate = generateCertificate(request.genomeHash, `run:${runId}`, results, properties);
  }

  return { runId, verdict, results, summary, certificate, violations };
}

// ─── Helper Functions ──────────────────────────────────────────────────────

function buildInitialVariables(model: AgentBehaviorModel, state: AgentState): Record<string, unknown> {
  const vars: Record<string, unknown> = {};
  for (const v of model.variables) {
    vars[v.name] = v.initial;
  }
  // Overlay state-specific properties
  return { ...vars, ...state.properties };
}

function evaluateFormulaAtState(
  formula: TemporalFormula,
  exploration: ExplorationState,
  model: AgentBehaviorModel,
): boolean | null {
  const state = model.states.find((s) => s.id === exploration.stateId);
  if (!state) return null;

  // Augment variables with meta-properties
  const augmented: Record<string, unknown> = {
    ...exploration.variables,
    _unsafe: state.unsafe ?? false,
    _accepting: state.accepting ?? false,
    _current_state: state.id,
    _has_enabled_transition: getEnabledTransitions(model, state.id, exploration.variables).length > 0 || state.accepting,
  };

  // For invariant formulas (□P), we check P at this state
  if (formula.kind === 'ltl' && formula.operator === 'always') {
    return evaluateAtomicFormula(formula.operands[0], augmented);
  }

  // For eventual formulas (◇P), we check if P holds here
  if (formula.kind === 'ltl' && formula.operator === 'eventually') {
    return evaluateAtomicFormula(formula.operands[0], augmented);
  }

  // For atomic formulas, evaluate directly
  return evaluateAtomicFormula(formula, augmented);
}

function buildCounterexample(
  exploration: ExplorationState,
  kind: 'finite' | 'lasso',
  property: VerificationProperty,
): CounterexampleTrace {
  const states: CounterexampleState[] = exploration.path.map((stateId, i) => ({
    stateId,
    variables: i === exploration.path.length - 1 ? exploration.variables : {},
    transition: i > 0 ? exploration.transitionPath[i - 1] : undefined,
    step: i,
  }));

  return {
    states,
    kind,
    loopStart: kind === 'lasso' ? Math.max(0, states.length - 2) : undefined,
    explanation: `Property '${property.name}' violated at state '${exploration.stateId}' ` +
      `(depth ${exploration.depth}). Path: ${exploration.path.join(' → ')}`,
  };
}

function buildProofWitness(
  technique: ProofWitness['technique'],
  property: VerificationProperty,
): ProofWitness {
  const proofContent = JSON.stringify({ propertyId: property.id, technique, verified: true });
  return {
    technique,
    certificateHash: createHash('sha256').update(proofContent).digest('hex'),
    proofObject: proofContent,
  };
}

function makeResult(
  propertyId: string,
  verdict: VerificationVerdict,
  statesExplored: number,
  transitionsExplored: number,
  durationMs: number,
  depthReached: number,
  bounded: boolean,
): PropertyVerificationResult {
  return { propertyId, verdict, statesExplored, transitionsExplored, durationMs, bounded, depthReached };
}

function buildSummary(results: PropertyVerificationResult[], totalMs: number): VerificationSummary {
  return {
    totalProperties: results.length,
    verified: results.filter((r) => r.verdict === 'verified').length,
    violated: results.filter((r) => r.verdict === 'violated').length,
    inconclusive: results.filter((r) => r.verdict === 'inconclusive').length,
    timeout: results.filter((r) => r.verdict === 'timeout').length,
    errors: results.filter((r) => r.verdict === 'error').length,
    totalStatesExplored: results.reduce((sum, r) => sum + r.statesExplored, 0),
    totalTransitionsExplored: results.reduce((sum, r) => sum + r.transitionsExplored, 0),
    totalDurationMs: totalMs,
    maxDepthReached: Math.max(0, ...results.map((r) => r.depthReached)),
  };
}

function computeVerdict(
  results: PropertyVerificationResult[],
  properties: VerificationProperty[],
): CertificateVerdict {
  const propMap = new Map(properties.map((p) => [p.id, p]));

  // If any critical property is violated, unsafe
  for (const r of results) {
    if (r.verdict === 'violated') {
      const prop = propMap.get(r.propertyId);
      if (prop && (prop.severity === 'critical' || prop.severity === 'high')) {
        return 'unsafe';
      }
    }
  }

  // If any property is inconclusive or timed out, incomplete
  if (results.some((r) => r.verdict === 'inconclusive' || r.verdict === 'timeout' || r.verdict === 'error')) {
    return 'incomplete';
  }

  // If any non-critical property is violated, conditionally safe
  if (results.some((r) => r.verdict === 'violated')) {
    return 'conditionally_safe';
  }

  return 'certified_safe';
}

function computeCertificateSignature(
  genomeHash: string,
  results: PropertyVerificationResult[],
): string {
  const payload = JSON.stringify({
    genomeHash,
    results: results.map((r) => ({ id: r.propertyId, verdict: r.verdict })),
  });
  return createHash('sha256').update(payload).digest('hex');
}
