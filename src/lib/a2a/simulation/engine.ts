/**
 * Agent Digital Twin & Multi-Agent Simulation Engine
 *
 * Core logic for creating digital twins from production agents, executing
 * multi-agent simulations with chaos injection, comparing results, and
 * replaying production incidents.
 *
 * Execution flow:
 *   1. Create simulation → snapshot production agent topology
 *   2. Provision digital twins from source agents
 *   3. Execute playbook steps with chaos event injection
 *   4. Collect per-twin metrics and interaction graphs
 *   5. Detect cascading failures and recovery patterns
 *   6. Generate ecosystem health score and summary
 *   7. Optionally compare against a baseline simulation
 */

import { getServiceDb } from '../auth';
import type {
  DigitalTwin,
  TwinBehavior,
  SimulationEnvironment,
  SimulationConfig,
  SimulationResult,
  TwinMetrics,
  InteractionEdge,
  ChaosEvent,
  ChaosOutcome,
  PlaybookStep,
  AssertionResult,
  CascadeChain,
  SimulationComparison,
  ComparisonDelta,
  ComparisonVerdict,
} from './types';
import type {
  CreateSimulationInput,
  ListSimulationsInput,
  CompareSimulationsInput,
  ReplaySimulationInput,
} from './validation';

// ──────────────────────────────────────────────
// Simulation CRUD
// ──────────────────────────────────────────────

/**
 * Create a simulation environment by cloning production agents as digital twins.
 */
export async function createSimulation(
  creator_id: string,
  input: CreateSimulationInput,
): Promise<{ simulation_id: string; twin_ids: string[]; created_at: string } | null> {
  const db = getServiceDb();
  const simulationId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Fetch source agents to build twin behaviors
  const { data: agents } = await db
    .from('a2a_agents')
    .select('id, name, capabilities, trust_level')
    .in('id', input.source_agent_ids);

  if (!agents || agents.length === 0) {
    console.error('createSimulation: no valid source agents found');
    return null;
  }

  // Create digital twins
  const twins: Array<{ id: string; source_agent_id: string }> = [];
  for (const agent of agents) {
    const twinId = crypto.randomUUID();
    const overrides = input.twin_overrides?.[agent.id as string] ?? {};
    const capabilities = (agent.capabilities as Array<{ id: string }>) ?? [];

    const behavior: TwinBehavior = {
      capabilities: overrides.capabilities ?? capabilities.map((c) => c.id),
      latency_mean_ms: overrides.latency_mean_ms ?? 200,
      latency_stddev_ms: overrides.latency_stddev_ms ?? 50,
      failure_rate: overrides.failure_rate ?? 0.02,
      failure_modes: overrides.failure_modes ?? { timeout: 0.5, error: 0.3, crash: 0.2 },
      cost_per_task: overrides.cost_per_task ?? 1,
      max_concurrency: overrides.max_concurrency ?? 10,
      response_templates: overrides.response_templates ?? {},
    };

    const { error: twinError } = await db
      .from('a2a_simulation_twins')
      .insert({
        id: twinId,
        source_agent_id: agent.id,
        label: `Twin of ${agent.name}`,
        behavior,
        status: 'ready',
        simulation_id: simulationId,
        created_at: now,
        updated_at: now,
      });

    if (twinError) {
      console.error('createSimulation twin insert error:', twinError);
      continue;
    }
    twins.push({ id: twinId, source_agent_id: agent.id as string });
  }

  if (twins.length === 0) {
    console.error('createSimulation: failed to create any twins');
    return null;
  }

  // Assign IDs to chaos events
  const chaosEvents = (input.chaos_events ?? []).map((e) => ({
    ...e,
    id: crypto.randomUUID(),
  }));

  // Assign IDs to playbook steps
  const playbook = {
    name: input.playbook.name,
    steps: input.playbook.steps.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
    })),
  };

  const config: SimulationConfig = {
    time_acceleration: input.config?.time_acceleration ?? 10,
    max_duration_seconds: input.config?.max_duration_seconds ?? 300,
    max_total_tasks: input.config?.max_total_tasks ?? 10000,
    max_total_cost: input.config?.max_total_cost ?? 10000,
    seed: input.config?.seed,
    capture_traces: input.config?.capture_traces ?? true,
    stop_on_critical_failure: input.config?.stop_on_critical_failure ?? false,
  };

  const { error: simError } = await db
    .from('a2a_simulations')
    .insert({
      id: simulationId,
      name: input.name,
      description: input.description,
      created_by: creator_id,
      status: 'ready',
      twin_ids: twins.map((t) => t.id),
      chaos_events: chaosEvents,
      playbook,
      config,
      tags: input.tags ?? [],
      created_at: now,
    });

  if (simError) {
    console.error('createSimulation insert error:', simError);
    return null;
  }

  return {
    simulation_id: simulationId,
    twin_ids: twins.map((t) => t.id),
    created_at: now,
  };
}

export async function getSimulation(id: string): Promise<SimulationEnvironment | null> {
  const db = getServiceDb();
  const { data, error } = await db
    .from('a2a_simulations')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapSimulationRow(data);
}

export async function getSimulationTwins(simulation_id: string): Promise<DigitalTwin[]> {
  const db = getServiceDb();
  const { data, error } = await db
    .from('a2a_simulation_twins')
    .select('*')
    .eq('simulation_id', simulation_id)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []).map(mapTwinRow);
}

export async function listSimulations(
  input: ListSimulationsInput,
): Promise<SimulationEnvironment[]> {
  const db = getServiceDb();
  let query = db.from('a2a_simulations').select('*');

  if (input.status) query = query.eq('status', input.status);
  if (input.tag) query = query.contains('tags', [input.tag]);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(input.limit);

  if (error) {
    console.error('listSimulations error:', error);
    return [];
  }
  return (data ?? []).map(mapSimulationRow);
}

// ──────────────────────────────────────────────
// Simulation Execution
// ──────────────────────────────────────────────

/**
 * Execute a simulation: run the playbook with chaos injection,
 * collect metrics, detect cascades, and produce a result.
 */
export async function runSimulation(simulation_id: string): Promise<SimulationResult | null> {
  const db = getServiceDb();
  const simulation = await getSimulation(simulation_id);
  if (!simulation || (simulation.status !== 'ready' && simulation.status !== 'draft')) {
    return null;
  }

  // Mark as running
  await db
    .from('a2a_simulations')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', simulation_id);

  // Fetch twins
  const twins = await getSimulationTwins(simulation_id);
  if (twins.length === 0) return null;

  // Mark twins as active
  for (const twin of twins) {
    await db
      .from('a2a_simulation_twins')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', twin.id);
  }

  const startTime = Date.now();
  const rng = seededRandom(simulation.config.seed ?? Date.now());

  // Initialize per-twin state
  const twinState = new Map<string, TwinSimState>();
  for (const twin of twins) {
    twinState.set(twin.id, {
      twin,
      tasksReceived: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      latencies: [],
      totalCost: 0,
      messagesSent: 0,
      messagesReceived: 0,
      isDown: false,
      downSince: 0,
      recoveryTime: undefined,
      chaosAffected: false,
    });
  }

  // Track interactions
  const interactions = new Map<string, InteractionEdge>();
  const assertionResults: AssertionResult[] = [];
  const chaosOutcomes: ChaosOutcome[] = [];
  const cascadeChains: CascadeChain[] = [];

  // Build a timeline of events (playbook steps + chaos events)
  const simulatedDuration = simulation.config.max_duration_seconds;
  const stepDuration = simulatedDuration / Math.max(simulation.playbook.steps.length, 1);

  // Execute playbook steps
  const sortedSteps = [...simulation.playbook.steps].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const currentSimTime = i * stepDuration;

    // Check for chaos events that should trigger at this time
    for (const chaos of simulation.chaos_events) {
      if (chaos.trigger_at_seconds <= currentSimTime &&
          chaos.trigger_at_seconds > (i > 0 ? (i - 1) * stepDuration : -1)) {
        const outcome = applyChaosEvent(chaos, twinState, rng);
        chaosOutcomes.push(outcome);

        // Detect cascade chains
        if (chaos.type === 'agent_failure' || chaos.type === 'cascade_trigger') {
          const chain = detectCascade(chaos, twinState, twins);
          if (chain.total_affected > 1) {
            cascadeChains.push(chain);
          }
        }
      }
    }

    // Execute the playbook step
    const result = executePlaybookStep(step, twinState, interactions, rng);
    if (result) {
      assertionResults.push(result);
    }

    // Check chaos recovery
    for (const chaos of simulation.chaos_events) {
      const chaosEnd = chaos.trigger_at_seconds + chaos.duration_seconds;
      if (chaos.duration_seconds > 0 && chaosEnd <= currentSimTime) {
        recoverFromChaos(chaos, twinState);
      }
    }
  }

  const wallClockMs = Date.now() - startTime;

  // Compute twin metrics
  const twinMetrics: TwinMetrics[] = [];
  for (const [, state] of twinState) {
    const sortedLatencies = [...state.latencies].sort((a, b) => a - b);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    twinMetrics.push({
      twin_id: state.twin.id,
      source_agent_id: state.twin.source_agent_id,
      label: state.twin.label,
      tasks_received: state.tasksReceived,
      tasks_completed: state.tasksCompleted,
      tasks_failed: state.tasksFailed,
      avg_latency_ms: state.latencies.length > 0
        ? state.latencies.reduce((s, v) => s + v, 0) / state.latencies.length
        : 0,
      p99_latency_ms: sortedLatencies[p99Index] ?? 0,
      total_cost_credits: state.totalCost,
      messages_sent: state.messagesSent,
      messages_received: state.messagesReceived,
      uptime_fraction: state.isDown ? 0.5 : 1.0,
      chaos_affected: state.chaosAffected,
      recovery_time_ms: state.recoveryTime,
    });
  }

  // Build interaction graph
  const interactionGraph = Array.from(interactions.values());

  // Compute ecosystem health score
  const healthScore = computeHealthScore(twinMetrics, assertionResults, cascadeChains);

  // Generate summary
  const summary = generateSummary(
    twinMetrics, chaosOutcomes, cascadeChains, assertionResults, healthScore,
  );

  const result: SimulationResult = {
    wall_clock_ms: wallClockMs,
    simulated_seconds: simulatedDuration,
    twin_metrics: twinMetrics,
    interaction_graph: interactionGraph,
    chaos_outcomes: chaosOutcomes,
    assertion_results: assertionResults,
    cascade_chains: cascadeChains,
    ecosystem_health_score: healthScore,
    summary,
  };

  // Update simulation
  await db
    .from('a2a_simulations')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', simulation_id);

  // Retire twins
  for (const twin of twins) {
    await db
      .from('a2a_simulation_twins')
      .update({ status: 'retired', updated_at: new Date().toISOString() })
      .eq('id', twin.id);
  }

  return result;
}

// ──────────────────────────────────────────────
// Chaos Event Application
// ──────────────────────────────────────────────

function applyChaosEvent(
  chaos: ChaosEvent,
  twinState: Map<string, TwinSimState>,
  rng: () => number,
): ChaosOutcome {
  let directCount = 0;
  let indirectCount = 0;

  for (const targetId of chaos.target_twin_ids) {
    const state = twinState.get(targetId);
    if (!state) continue;
    state.chaosAffected = true;
    directCount++;

    switch (chaos.type) {
      case 'agent_failure':
        state.isDown = true;
        state.downSince = chaos.trigger_at_seconds;
        break;

      case 'latency_spike':
        state.twin = {
          ...state.twin,
          behavior: {
            ...state.twin.behavior,
            latency_mean_ms: state.twin.behavior.latency_mean_ms +
              (chaos.parameters.latency_increase_ms ?? 5000),
          },
        };
        break;

      case 'resource_exhaustion':
        state.totalCost += state.twin.behavior.cost_per_task *
          (chaos.parameters.budget_consumed ?? 0.9) * 100;
        break;

      case 'byzantine_fault':
        state.twin = {
          ...state.twin,
          behavior: {
            ...state.twin.behavior,
            failure_rate: chaos.parameters.byzantine_probability ?? 0.5,
          },
        };
        break;

      case 'load_surge': {
        const multiplier = chaos.parameters.load_multiplier ?? 5;
        state.tasksReceived += Math.floor(multiplier * 10);
        const failures = Math.floor(multiplier * 10 * state.twin.behavior.failure_rate);
        state.tasksFailed += failures;
        state.tasksCompleted += Math.floor(multiplier * 10) - failures;
        break;
      }

      case 'cascade_trigger':
        state.isDown = true;
        state.downSince = chaos.trigger_at_seconds;
        // Cascade to dependent twins
        for (const cascadeId of (chaos.parameters.cascade_twin_ids ?? [])) {
          const cascadeState = twinState.get(cascadeId);
          if (cascadeState && !cascadeState.isDown) {
            cascadeState.isDown = true;
            cascadeState.chaosAffected = true;
            cascadeState.downSince = chaos.trigger_at_seconds;
            indirectCount++;
          }
        }
        break;

      case 'network_partition':
        // Mark affected communication paths (handled during step execution)
        break;

      case 'data_corruption':
        // Increase failure rate to simulate corrupted responses
        state.twin = {
          ...state.twin,
          behavior: {
            ...state.twin.behavior,
            failure_rate: Math.min(1, state.twin.behavior.failure_rate +
              (chaos.parameters.corruption_probability ?? 0.3)),
          },
        };
        break;
    }
  }

  const recoveryTimeMs = chaos.duration_seconds > 0
    ? chaos.duration_seconds * 1000
    : 0;

  return {
    chaos_event_id: chaos.id,
    type: chaos.type,
    impact_description: `${chaos.type} affecting ${directCount} twin(s)` +
      (indirectCount > 0 ? ` with ${indirectCount} cascade(s)` : ''),
    direct_impact_count: directCount,
    indirect_impact_count: indirectCount,
    recovery_time_ms: recoveryTimeMs,
    full_recovery: chaos.duration_seconds > 0,
  };
}

function recoverFromChaos(
  chaos: ChaosEvent,
  twinState: Map<string, TwinSimState>,
): void {
  for (const targetId of chaos.target_twin_ids) {
    const state = twinState.get(targetId);
    if (!state) continue;
    if (state.isDown) {
      state.isDown = false;
      state.recoveryTime = (chaos.duration_seconds * 1000);
    }
  }
  // Also recover cascade targets
  if (chaos.parameters.cascade_twin_ids) {
    for (const cascadeId of chaos.parameters.cascade_twin_ids) {
      const state = twinState.get(cascadeId);
      if (state && state.isDown) {
        state.isDown = false;
        state.recoveryTime = (chaos.duration_seconds * 1000) + 500;
      }
    }
  }
}

function detectCascade(
  chaos: ChaosEvent,
  twinState: Map<string, TwinSimState>,
  allTwins: DigitalTwin[],
): CascadeChain {
  const chain: CascadeChain['chain'] = [];
  const rootTwinId = chaos.target_twin_ids[0];

  // Direct cascade targets
  for (const cascadeId of (chaos.parameters.cascade_twin_ids ?? [])) {
    const state = twinState.get(cascadeId);
    if (state) {
      chain.push({
        twin_id: cascadeId,
        failure_type: 'dependency_failure',
        delay_ms: 100 + chain.length * 50,
      });
    }
  }

  return {
    root_twin_id: rootTwinId,
    root_cause: chaos.type,
    chain,
    total_affected: 1 + chain.length,
    total_cascade_time_ms: chain.length > 0
      ? chain[chain.length - 1].delay_ms
      : 0,
  };
}

// ──────────────────────────────────────────────
// Playbook Step Execution
// ──────────────────────────────────────────────

function executePlaybookStep(
  step: PlaybookStep,
  twinState: Map<string, TwinSimState>,
  interactions: Map<string, InteractionEdge>,
  rng: () => number,
): AssertionResult | null {
  const config = step.config;

  switch (step.type) {
    case 'submit_task': {
      if (!config.sender_twin_id || !config.target_twin_id) break;
      const sender = twinState.get(config.sender_twin_id);
      const target = twinState.get(config.target_twin_id);
      if (!sender || !target) break;

      simulateTaskSubmission(sender, target, interactions, rng);
      break;
    }

    case 'broadcast_task': {
      if (!config.sender_twin_id || !config.target_twin_ids) break;
      const sender = twinState.get(config.sender_twin_id);
      if (!sender) break;

      for (const targetId of config.target_twin_ids) {
        const target = twinState.get(targetId);
        if (target) {
          simulateTaskSubmission(sender, target, interactions, rng);
        }
      }
      break;
    }

    case 'send_message': {
      if (!config.sender_twin_id || !config.target_twin_id) break;
      const sender = twinState.get(config.sender_twin_id);
      const target = twinState.get(config.target_twin_id);
      if (!sender || !target) break;

      sender.messagesSent++;
      target.messagesReceived++;

      const edgeKey = `${config.sender_twin_id}→${config.target_twin_id}:message`;
      const existing = interactions.get(edgeKey);
      if (existing) {
        existing.count++;
      } else {
        interactions.set(edgeKey, {
          from_twin_id: config.sender_twin_id,
          to_twin_id: config.target_twin_id,
          interaction_type: 'message',
          count: 1,
          avg_latency_ms: 10,
          failure_rate: 0,
        });
      }
      break;
    }

    case 'assert': {
      if (!config.assertion) break;
      return evaluateAssertion(step, config.assertion, twinState);
    }

    case 'parallel_group': {
      if (!config.parallel_steps) break;
      for (const subStep of config.parallel_steps) {
        executePlaybookStep(subStep, twinState, interactions, rng);
      }
      break;
    }

    case 'wait':
      // No-op in simulation (time is virtual)
      break;
  }

  return null;
}

function simulateTaskSubmission(
  sender: TwinSimState,
  target: TwinSimState,
  interactions: Map<string, InteractionEdge>,
  rng: () => number,
): void {
  target.tasksReceived++;

  if (target.isDown) {
    target.tasksFailed++;
    updateInteraction(interactions, sender, target, 0, true);
    return;
  }

  // Simulate latency
  const latency = Math.max(0,
    target.twin.behavior.latency_mean_ms +
    (rng() - 0.5) * 2 * target.twin.behavior.latency_stddev_ms,
  );
  target.latencies.push(latency);

  // Simulate success/failure
  const failed = rng() < target.twin.behavior.failure_rate;
  if (failed) {
    target.tasksFailed++;
  } else {
    target.tasksCompleted++;
    target.totalCost += target.twin.behavior.cost_per_task;
  }

  updateInteraction(interactions, sender, target, latency, failed);
}

function updateInteraction(
  interactions: Map<string, InteractionEdge>,
  sender: TwinSimState,
  target: TwinSimState,
  latency: number,
  failed: boolean,
): void {
  const edgeKey = `${sender.twin.id}→${target.twin.id}:task`;
  const existing = interactions.get(edgeKey);
  if (existing) {
    existing.count++;
    existing.avg_latency_ms =
      (existing.avg_latency_ms * (existing.count - 1) + latency) / existing.count;
    const failCount = Math.round(existing.failure_rate * (existing.count - 1)) + (failed ? 1 : 0);
    existing.failure_rate = failCount / existing.count;
  } else {
    interactions.set(edgeKey, {
      from_twin_id: sender.twin.id,
      to_twin_id: target.twin.id,
      interaction_type: 'task',
      count: 1,
      avg_latency_ms: latency,
      failure_rate: failed ? 1 : 0,
    });
  }
}

function evaluateAssertion(
  step: PlaybookStep,
  assertion: NonNullable<PlaybookStep['config']['assertion']>,
  twinState: Map<string, TwinSimState>,
): AssertionResult {
  let actual: number | string = 0;

  if (assertion.twin_id) {
    const state = twinState.get(assertion.twin_id);
    if (!state) {
      return {
        step_id: step.id,
        description: step.description,
        passed: false,
        expected: `${assertion.target} ${assertion.op} ${assertion.value}`,
        actual: 'twin not found',
      };
    }

    switch (assertion.target) {
      case 'twin_status': actual = state.isDown ? 'down' : 'up'; break;
      case 'task_count': actual = state.tasksReceived; break;
      case 'failure_count': actual = state.tasksFailed; break;
      case 'total_cost': actual = state.totalCost; break;
      case 'message_count': actual = state.messagesSent + state.messagesReceived; break;
    }
  } else {
    // Aggregate across all twins
    let sum = 0;
    for (const [, state] of twinState) {
      switch (assertion.target) {
        case 'task_count': sum += state.tasksReceived; break;
        case 'failure_count': sum += state.tasksFailed; break;
        case 'total_cost': sum += state.totalCost; break;
        case 'message_count': sum += state.messagesSent + state.messagesReceived; break;
      }
    }
    actual = sum;
  }

  const expected = typeof assertion.value === 'number' ? assertion.value : assertion.value;
  const numActual = typeof actual === 'number' ? actual : NaN;
  const numExpected = typeof expected === 'number' ? expected : NaN;

  let passed = false;
  if (typeof actual === 'string' || typeof expected === 'string') {
    passed = assertion.op === 'eq'
      ? String(actual) === String(expected)
      : String(actual) !== String(expected);
  } else {
    switch (assertion.op) {
      case 'eq': passed = numActual === numExpected; break;
      case 'neq': passed = numActual !== numExpected; break;
      case 'lt': passed = numActual < numExpected; break;
      case 'lte': passed = numActual <= numExpected; break;
      case 'gt': passed = numActual > numExpected; break;
      case 'gte': passed = numActual >= numExpected; break;
    }
  }

  return {
    step_id: step.id,
    description: step.description,
    passed,
    expected: `${assertion.target} ${assertion.op} ${assertion.value}`,
    actual: String(actual),
  };
}

// ──────────────────────────────────────────────
// Comparison
// ──────────────────────────────────────────────

/**
 * Compare two completed simulations to produce A/B analysis.
 */
export async function compareSimulations(
  input: CompareSimulationsInput,
): Promise<SimulationComparison | null> {
  const db = getServiceDb();

  const baseline = await getSimulation(input.baseline_simulation_id);
  const candidate = await getSimulation(input.candidate_simulation_id);

  if (!baseline?.result || !candidate?.result) {
    return null;
  }

  const defaultThreshold = 20; // 20% change is acceptable by default
  const thresholds = input.thresholds ?? {};

  // Compare aggregate metrics
  const baselineAgg = aggregateMetrics(baseline.result.twin_metrics);
  const candidateAgg = aggregateMetrics(candidate.result.twin_metrics);

  const deltas: ComparisonDelta[] = [];
  const metricNames = [
    'avg_latency_ms', 'total_tasks', 'total_failures',
    'total_cost', 'ecosystem_health_score',
  ] as const;

  const baselineValues: Record<string, number> = {
    avg_latency_ms: baselineAgg.avgLatency,
    total_tasks: baselineAgg.totalTasks,
    total_failures: baselineAgg.totalFailures,
    total_cost: baselineAgg.totalCost,
    ecosystem_health_score: baseline.result.ecosystem_health_score,
  };

  const candidateValues: Record<string, number> = {
    avg_latency_ms: candidateAgg.avgLatency,
    total_tasks: candidateAgg.totalTasks,
    total_failures: candidateAgg.totalFailures,
    total_cost: candidateAgg.totalCost,
    ecosystem_health_score: candidate.result.ecosystem_health_score,
  };

  for (const metric of metricNames) {
    const bv = baselineValues[metric];
    const cv = candidateValues[metric];
    const changePct = bv !== 0 ? ((cv - bv) / bv) * 100 : cv !== 0 ? 100 : 0;
    const threshold = thresholds[metric] ?? defaultThreshold;

    deltas.push({
      metric,
      baseline_value: bv,
      candidate_value: cv,
      change_percent: Math.round(changePct * 100) / 100,
      acceptable: Math.abs(changePct) <= threshold,
      threshold_percent: threshold,
    });
  }

  // Determine verdict
  const improved = deltas.filter((d) => {
    // Lower is better for latency, failures, cost. Higher is better for health.
    const lowerIsBetter = ['avg_latency_ms', 'total_failures', 'total_cost'].includes(d.metric);
    return lowerIsBetter ? d.change_percent < -5 : d.change_percent > 5;
  }).length;

  const degraded = deltas.filter((d) => {
    const lowerIsBetter = ['avg_latency_ms', 'total_failures', 'total_cost'].includes(d.metric);
    return lowerIsBetter ? d.change_percent > 5 : d.change_percent < -5;
  }).length;

  let verdict: ComparisonVerdict;
  if (improved > degraded && degraded === 0) {
    verdict = 'improved';
  } else if (degraded > improved && improved === 0) {
    verdict = 'degraded';
  } else if (improved === 0 && degraded === 0) {
    verdict = 'equivalent';
  } else {
    verdict = 'mixed';
  }

  const comparison: SimulationComparison = {
    id: crypto.randomUUID(),
    baseline_simulation_id: input.baseline_simulation_id,
    candidate_simulation_id: input.candidate_simulation_id,
    deltas,
    verdict,
    created_at: new Date().toISOString(),
  };

  // Persist comparison
  await db.from('a2a_simulation_comparisons').insert({
    id: comparison.id,
    baseline_simulation_id: comparison.baseline_simulation_id,
    candidate_simulation_id: comparison.candidate_simulation_id,
    deltas: comparison.deltas,
    verdict: comparison.verdict,
    created_at: comparison.created_at,
  });

  return comparison;
}

// ──────────────────────────────────────────────
// Production Replay
// ──────────────────────────────────────────────

/**
 * Create a simulation from a production time window for incident replay.
 */
export async function replaySimulation(
  creator_id: string,
  input: ReplaySimulationInput,
): Promise<{ simulation_id: string; twin_ids: string[]; events_captured: number; created_at: string } | null> {
  const db = getServiceDb();

  // Query production tasks within the replay window
  const { data: tasks, error: taskError } = await db
    .from('a2a_tasks')
    .select('id, sender_agent_id, assignee_id, intent, input, status, created_at, updated_at')
    .in('sender_agent_id', input.source_agent_ids)
    .gte('created_at', input.replay_window.start)
    .lte('created_at', input.replay_window.end)
    .order('created_at', { ascending: true })
    .limit(1000);

  if (taskError) {
    console.error('replaySimulation task query error:', taskError);
  }

  const eventsCaptured = (tasks ?? []).length;

  // Build playbook from production events
  const steps: Array<{
    type: 'submit_task';
    description: string;
    order: number;
    config: {
      sender_twin_id?: string;
      target_twin_id?: string;
      intent?: string;
      input?: Record<string, unknown>;
    };
  }> = (tasks ?? []).map((task, i) => ({
    type: 'submit_task' as const,
    description: `Replay: ${task.intent} (${task.status})`,
    order: i,
    config: {
      sender_twin_id: task.sender_agent_id as string,
      target_twin_id: (task.assignee_id as string) ?? undefined,
      intent: task.intent as string,
      input: (task.input as Record<string, unknown>) ?? {},
    },
  }));

  // Create the simulation using the standard flow
  const result = await createSimulation(creator_id, {
    name: input.name,
    description: `Production replay: ${input.replay_window.start} to ${input.replay_window.end}`,
    source_agent_ids: input.source_agent_ids,
    twin_overrides: input.twin_overrides,
    chaos_events: input.additional_chaos,
    playbook: {
      name: `Replay: ${input.name}`,
      steps: steps.length > 0 ? steps : [{
        type: 'wait' as const,
        description: 'No production events found in window',
        order: 0,
        config: { wait_seconds: 1 },
      }],
    },
    tags: [...(input.tags ?? []), 'replay'],
  });

  if (!result) return null;

  return {
    simulation_id: result.simulation_id,
    twin_ids: result.twin_ids,
    events_captured: eventsCaptured,
    created_at: result.created_at,
  };
}

// ──────────────────────────────────────────────
// Health Score & Summary
// ──────────────────────────────────────────────

function computeHealthScore(
  metrics: TwinMetrics[],
  assertions: AssertionResult[],
  cascades: CascadeChain[],
): number {
  if (metrics.length === 0) return 0;

  // Uptime contribution (40%)
  const avgUptime = metrics.reduce((s, m) => s + m.uptime_fraction, 0) / metrics.length;
  const uptimeScore = avgUptime * 40;

  // Success rate contribution (30%)
  const totalTasks = metrics.reduce((s, m) => s + m.tasks_received, 0);
  const totalCompleted = metrics.reduce((s, m) => s + m.tasks_completed, 0);
  const successRate = totalTasks > 0 ? totalCompleted / totalTasks : 1;
  const successScore = successRate * 30;

  // Assertion pass rate (20%)
  const assertionPassRate = assertions.length > 0
    ? assertions.filter((a) => a.passed).length / assertions.length
    : 1;
  const assertionScore = assertionPassRate * 20;

  // Cascade penalty (10%)
  const cascadePenalty = Math.min(10, cascades.length * 3);
  const cascadeScore = 10 - cascadePenalty;

  return Math.round(uptimeScore + successScore + assertionScore + cascadeScore);
}

function generateSummary(
  metrics: TwinMetrics[],
  chaosOutcomes: ChaosOutcome[],
  cascades: CascadeChain[],
  assertions: AssertionResult[],
  healthScore: number,
): string {
  const totalTwins = metrics.length;
  const totalTasks = metrics.reduce((s, m) => s + m.tasks_received, 0);
  const totalFailed = metrics.reduce((s, m) => s + m.tasks_failed, 0);
  const chaosCount = chaosOutcomes.length;
  const assertionsPassed = assertions.filter((a) => a.passed).length;

  const parts = [
    `Simulation completed: ${totalTwins} digital twin(s), ${totalTasks} task(s) processed.`,
  ];

  if (totalFailed > 0) {
    parts.push(`${totalFailed} task failure(s) (${((totalFailed / Math.max(totalTasks, 1)) * 100).toFixed(1)}% failure rate).`);
  }

  if (chaosCount > 0) {
    const recovered = chaosOutcomes.filter((c) => c.full_recovery).length;
    parts.push(`${chaosCount} chaos event(s) injected, ${recovered} fully recovered.`);
  }

  if (cascades.length > 0) {
    const totalAffected = cascades.reduce((s, c) => s + c.total_affected, 0);
    parts.push(`${cascades.length} cascade chain(s) detected, affecting ${totalAffected} twin(s).`);
  }

  if (assertions.length > 0) {
    parts.push(`${assertionsPassed}/${assertions.length} playbook assertion(s) passed.`);
  }

  parts.push(`Ecosystem health score: ${healthScore}/100.`);

  return parts.join(' ');
}

function aggregateMetrics(metrics: TwinMetrics[]): {
  avgLatency: number;
  totalTasks: number;
  totalFailures: number;
  totalCost: number;
} {
  const totalTasks = metrics.reduce((s, m) => s + m.tasks_received, 0);
  const totalFailures = metrics.reduce((s, m) => s + m.tasks_failed, 0);
  const totalCost = metrics.reduce((s, m) => s + m.total_cost_credits, 0);
  const avgLatency = metrics.length > 0
    ? metrics.reduce((s, m) => s + m.avg_latency_ms, 0) / metrics.length
    : 0;
  return { avgLatency, totalTasks, totalFailures, totalCost };
}

// ──────────────────────────────────────────────
// Row Mappers
// ──────────────────────────────────────────────

function mapSimulationRow(row: Record<string, unknown>): SimulationEnvironment {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    created_by: row.created_by as string,
    status: row.status as SimulationEnvironment['status'],
    twin_ids: row.twin_ids as string[],
    chaos_events: row.chaos_events as ChaosEvent[],
    playbook: row.playbook as SimulationEnvironment['playbook'],
    config: row.config as SimulationConfig,
    result: row.result as SimulationResult | undefined,
    tags: row.tags as string[],
    created_at: row.created_at as string,
    started_at: row.started_at as string | undefined,
    completed_at: row.completed_at as string | undefined,
  };
}

function mapTwinRow(row: Record<string, unknown>): DigitalTwin {
  return {
    id: row.id as string,
    source_agent_id: row.source_agent_id as string,
    label: row.label as string,
    behavior: row.behavior as TwinBehavior,
    status: row.status as DigitalTwin['status'],
    simulation_id: row.simulation_id as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ──────────────────────────────────────────────
// Internal Types
// ──────────────────────────────────────────────

interface TwinSimState {
  twin: DigitalTwin;
  tasksReceived: number;
  tasksCompleted: number;
  tasksFailed: number;
  latencies: number[];
  totalCost: number;
  messagesSent: number;
  messagesReceived: number;
  isDown: boolean;
  downSince: number;
  recoveryTime?: number;
  chaosAffected: boolean;
}

// ──────────────────────────────────────────────
// Seeded PRNG (for deterministic replay)
// ──────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}
