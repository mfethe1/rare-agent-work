/**
 * Future Projection Engine
 *
 * Predicts future ecosystem states by propagating through causal graphs,
 * extrapolating temporal patterns, and running Monte Carlo simulations.
 * Enables agents to make decisions informed by probable futures.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  CausalGraph,
  CausalNode,
  FutureProjection,
  Prediction,
  SensitivityFactor,
  TemporalWindow,
  TemporalEvent,
  PeriodicPattern,
  ProjectionMethod,
  TemporalEngineConfig,
} from './types';
import { DEFAULT_TEMPORAL_CONFIG } from './types';
import { findCausalPaths, getCausalDescendants, computeCausalStrength } from './causal-graph';

// ---------------------------------------------------------------------------
// Causal propagation projection
// ---------------------------------------------------------------------------

/**
 * Project future states by forward-propagating through causal edges.
 * Starting from observed/changed nodes, follows causal links to predict
 * downstream effects with decaying confidence.
 */
export function projectByCausalPropagation(
  graph: CausalGraph,
  changedNodeIds: string[],
  horizon: TemporalWindow,
): FutureProjection {
  const predictions: Prediction[] = [];
  const now = new Date();
  const horizonEnd = new Date(horizon.end).getTime();

  for (const startId of changedNodeIds) {
    const descendants = getCausalDescendants(graph, startId);

    for (const descendant of descendants) {
      const paths = findCausalPaths(graph, startId, descendant.id, 8);
      if (paths.length === 0) continue;

      // Compute aggregate causal strength across all paths
      const strength = computeCausalStrength(graph, startId, descendant.id);
      if (strength < 0.1) continue; // too weak to predict

      // Estimate timing: sum of edge delays along shortest path
      const shortestPath = paths.reduce((a, b) => (a.length < b.length ? a : b));
      let totalDelay = 0;
      let totalVariance = 0;
      const sensitivityFactors: SensitivityFactor[] = [];

      for (let i = 0; i < shortestPath.length - 1; i++) {
        const edge = graph.edges.find(
          (e) => e.sourceId === shortestPath[i] && e.targetId === shortestPath[i + 1],
        );
        if (edge) {
          totalDelay += edge.delay;
          totalVariance += edge.delayVariance ** 2; // variance adds for independent delays
          sensitivityFactors.push({
            nodeId: shortestPath[i],
            edgeId: edge.id,
            impact: edge.strength * edge.confidence,
            description: `${edge.relation} link contributes ${(edge.strength * 100).toFixed(0)}% causal influence`,
          });
        }
      }

      const expectedTime = new Date(now.getTime() + totalDelay);
      if (expectedTime.getTime() > horizonEnd) continue; // beyond horizon

      predictions.push({
        nodeId: descendant.id,
        predictedState: { affected: true, causalOrigin: startId },
        probability: strength,
        confidenceInterval: {
          lower: Math.max(0, strength - 0.15),
          upper: Math.min(1, strength + 0.15),
        },
        expectedTime: expectedTime.toISOString(),
        timeUncertainty: Math.sqrt(totalVariance),
        causalChain: shortestPath,
        sensitivity: sensitivityFactors,
      });
    }
  }

  // Sort by probability descending
  predictions.sort((a, b) => b.probability - a.probability);

  return {
    id: uuidv4(),
    graphId: graph.id,
    method: 'causal_propagation',
    horizon,
    predictions,
    confidence: predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length
      : 0,
    computedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600_000).toISOString(), // 1 hour TTL
    assumptions: [
      'Causal relationships remain stable within projection horizon',
      'No external interventions modify the causal graph',
      'Edge delay estimates are approximately correct',
    ],
  };
}

// ---------------------------------------------------------------------------
// Pattern extrapolation projection
// ---------------------------------------------------------------------------

/**
 * Project future events by extrapolating observed periodic patterns.
 * Detects recurring temporal patterns and predicts when they'll recur.
 */
export function projectByPatternExtrapolation(
  events: TemporalEvent[],
  horizon: TemporalWindow,
): FutureProjection {
  const now = new Date();
  const horizonEnd = new Date(horizon.end).getTime();
  const predictions: Prediction[] = [];

  // Group events by type and agent
  const eventGroups = new Map<string, TemporalEvent[]>();
  for (const event of events) {
    const key = `${event.agentId}:${event.type}`;
    if (!eventGroups.has(key)) eventGroups.set(key, []);
    eventGroups.get(key)!.push(event);
  }

  for (const [groupKey, groupEvents] of eventGroups) {
    if (groupEvents.length < 3) continue; // need at least 3 observations for pattern

    // Sort by wall clock time
    const sorted = [...groupEvents].sort(
      (a, b) => new Date(a.timestamp.wallClock).getTime() - new Date(b.timestamp.wallClock).getTime(),
    );

    // Compute inter-event intervals
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const delta = new Date(sorted[i].timestamp.wallClock).getTime() -
        new Date(sorted[i - 1].timestamp.wallClock).getTime();
      intervals.push(delta);
    }

    // Detect periodicity: coefficient of variation < 0.5 suggests regularity
    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean;

    if (cv > 0.5 || mean <= 0) continue; // too irregular

    const confidence = Math.max(0, 1 - cv) * Math.min(1, groupEvents.length / 10);
    const lastTime = new Date(sorted[sorted.length - 1].timestamp.wallClock).getTime();

    // Project future occurrences within horizon
    let nextTime = lastTime + mean;
    let occurrenceCount = 0;
    while (nextTime <= horizonEnd && occurrenceCount < 100) {
      predictions.push({
        nodeId: `predicted:${groupKey}:${occurrenceCount}`,
        predictedState: {
          eventType: sorted[0].type,
          agentId: sorted[0].agentId,
          pattern: 'periodic',
          intervalMs: mean,
        },
        probability: confidence * Math.pow(0.98, occurrenceCount), // slight decay for further predictions
        confidenceInterval: {
          lower: Math.max(0, confidence - 0.2),
          upper: Math.min(1, confidence + 0.1),
        },
        expectedTime: new Date(nextTime).toISOString(),
        timeUncertainty: Math.sqrt(variance),
        causalChain: sorted.slice(-3).map((e) => e.id), // last 3 events as basis
        sensitivity: [],
      });

      nextTime += mean;
      occurrenceCount++;
    }
  }

  predictions.sort((a, b) => new Date(a.expectedTime).getTime() - new Date(b.expectedTime).getTime());

  return {
    id: uuidv4(),
    graphId: '',
    method: 'pattern_extrapolation',
    horizon,
    predictions,
    confidence: predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length
      : 0,
    computedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1800_000).toISOString(), // 30 min TTL
    assumptions: [
      'Observed periodic patterns will continue',
      'No external disruptions to event sources',
      'System load remains approximately constant',
    ],
  };
}

// ---------------------------------------------------------------------------
// Monte Carlo simulation
// ---------------------------------------------------------------------------

/**
 * Run Monte Carlo simulation over causal graph to estimate probability
 * distributions of future outcomes.
 */
export function projectByMonteCarlo(
  graph: CausalGraph,
  changedNodeIds: string[],
  horizon: TemporalWindow,
  numSimulations: number = 1000,
): FutureProjection {
  const now = new Date();
  const outcomeCountMap = new Map<string, { count: number; totalTime: number; states: unknown[] }>();
  const allDescendants = new Set<string>();

  for (const startId of changedNodeIds) {
    for (const desc of getCausalDescendants(graph, startId)) {
      allDescendants.add(desc.id);
    }
  }

  // Run simulations
  for (let sim = 0; sim < numSimulations; sim++) {
    // For each edge, probabilistically decide if causal effect fires
    const activated = new Set<string>(changedNodeIds);
    const activationTimes = new Map<string, number>();
    for (const id of changedNodeIds) activationTimes.set(id, 0);

    // BFS through graph with probabilistic activation
    const queue = [...changedNodeIds];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentTime = activationTimes.get(current) ?? 0;

      for (const edge of graph.edges) {
        if (edge.sourceId !== current) continue;
        if (activated.has(edge.targetId)) continue;

        // Probabilistic firing based on edge strength and confidence
        const fireProb = edge.strength * edge.confidence;
        if (Math.random() < fireProb) {
          // Add jittered delay
          const jitter = edge.delayVariance * (Math.random() * 2 - 1);
          const delay = Math.max(0, edge.delay + jitter);
          const arrivalTime = currentTime + delay;

          activated.add(edge.targetId);
          activationTimes.set(edge.targetId, arrivalTime);
          queue.push(edge.targetId);
        }
      }
    }

    // Record which descendants were activated
    for (const descId of allDescendants) {
      if (activated.has(descId)) {
        const entry = outcomeCountMap.get(descId) ?? { count: 0, totalTime: 0, states: [] };
        entry.count++;
        entry.totalTime += activationTimes.get(descId) ?? 0;
        outcomeCountMap.set(descId, entry);
      }
    }
  }

  // Convert simulation results to predictions
  const predictions: Prediction[] = [];
  for (const [nodeId, stats] of outcomeCountMap) {
    const probability = stats.count / numSimulations;
    if (probability < 0.05) continue; // filter noise

    const avgDelay = stats.totalTime / stats.count;
    const expectedTime = new Date(now.getTime() + avgDelay);

    // Find representative causal chain
    const originId = changedNodeIds[0]; // simplified: use first changed node
    const paths = findCausalPaths(graph, originId, nodeId, 6);
    const shortestPath = paths.length > 0 ? paths.reduce((a, b) => (a.length < b.length ? a : b)) : [originId, nodeId];

    predictions.push({
      nodeId,
      predictedState: { activated: true, simulationHits: stats.count, totalSimulations: numSimulations },
      probability,
      confidenceInterval: {
        // Wilson score interval approximation
        lower: Math.max(0, probability - 1.96 * Math.sqrt((probability * (1 - probability)) / numSimulations)),
        upper: Math.min(1, probability + 1.96 * Math.sqrt((probability * (1 - probability)) / numSimulations)),
      },
      expectedTime: expectedTime.toISOString(),
      timeUncertainty: avgDelay * 0.3, // rough estimate
      causalChain: shortestPath,
      sensitivity: [],
    });
  }

  predictions.sort((a, b) => b.probability - a.probability);

  return {
    id: uuidv4(),
    graphId: graph.id,
    method: 'monte_carlo',
    horizon,
    predictions,
    confidence: predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length
      : 0,
    computedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600_000).toISOString(),
    assumptions: [
      `Based on ${numSimulations} Monte Carlo simulations`,
      'Edge firing probabilities are independent',
      'Causal structure remains stable during projection window',
    ],
  };
}

// ---------------------------------------------------------------------------
// Ensemble projection (combines multiple methods)
// ---------------------------------------------------------------------------

export function projectByEnsemble(
  graph: CausalGraph,
  events: TemporalEvent[],
  changedNodeIds: string[],
  horizon: TemporalWindow,
  config: TemporalEngineConfig = DEFAULT_TEMPORAL_CONFIG,
): FutureProjection {
  const projections: FutureProjection[] = [];

  if (config.projectionMethods.includes('causal_propagation')) {
    projections.push(projectByCausalPropagation(graph, changedNodeIds, horizon));
  }
  if (config.projectionMethods.includes('pattern_extrapolation') && events.length > 0) {
    projections.push(projectByPatternExtrapolation(events, horizon));
  }
  if (config.projectionMethods.includes('monte_carlo')) {
    projections.push(projectByMonteCarlo(graph, changedNodeIds, horizon, 500));
  }

  // Merge predictions across methods — average probabilities for same nodes
  const mergedMap = new Map<string, { predictions: Prediction[]; methods: string[] }>();

  for (const proj of projections) {
    for (const pred of proj.predictions) {
      const entry = mergedMap.get(pred.nodeId) ?? { predictions: [], methods: [] };
      entry.predictions.push(pred);
      if (!entry.methods.includes(proj.method)) entry.methods.push(proj.method);
      mergedMap.set(pred.nodeId, entry);
    }
  }

  const ensemblePredictions: Prediction[] = [];

  for (const [nodeId, { predictions, methods }] of mergedMap) {
    // Weight by method: multi-method agreement increases confidence
    const methodBonus = Math.min(methods.length / projections.length, 1);
    const avgProbability = predictions.reduce((s, p) => s + p.probability, 0) / predictions.length;
    const boostedProbability = Math.min(1, avgProbability * (1 + methodBonus * 0.2));

    // Use earliest predicted time
    const earliestPred = predictions.reduce((a, b) =>
      new Date(a.expectedTime).getTime() < new Date(b.expectedTime).getTime() ? a : b,
    );

    ensemblePredictions.push({
      nodeId,
      predictedState: {
        ensemble: true,
        methodAgreement: methods,
        individualProbabilities: predictions.map((p) => p.probability),
      },
      probability: boostedProbability,
      confidenceInterval: {
        lower: Math.min(...predictions.map((p) => p.confidenceInterval.lower)),
        upper: Math.max(...predictions.map((p) => p.confidenceInterval.upper)),
      },
      expectedTime: earliestPred.expectedTime,
      timeUncertainty: Math.min(...predictions.map((p) => p.timeUncertainty)),
      causalChain: earliestPred.causalChain,
      sensitivity: earliestPred.sensitivity,
    });
  }

  ensemblePredictions.sort((a, b) => b.probability - a.probability);

  const now = new Date();
  return {
    id: uuidv4(),
    graphId: graph.id,
    method: 'ensemble',
    horizon,
    predictions: ensemblePredictions,
    confidence: ensemblePredictions.length > 0
      ? ensemblePredictions.reduce((sum, p) => sum + p.probability, 0) / ensemblePredictions.length
      : 0,
    computedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600_000).toISOString(),
    assumptions: [
      `Ensemble of ${projections.length} projection methods`,
      ...projections.flatMap((p) => p.assumptions),
    ],
  };
}
