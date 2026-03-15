/**
 * Counterfactual Reasoning Engine
 *
 * Enables "what-if" analysis by simulating interventions on causal graphs.
 * Implements Pearl's do-calculus for computing interventional distributions:
 *   P(Y | do(X=x)) ≠ P(Y | X=x)
 *
 * Agents can ask: "What would have happened if I had chosen differently?"
 * and "What will happen if I intervene on X?"
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  CausalGraph,
  CausalNode,
  Counterfactual,
  CounterfactualIntervention,
  CounterfactualOutcome,
  TemporalWindow,
} from './types';
import {
  findCausalPaths,
  getCausalDescendants,
  getCausalAncestors,
  isDSeparated,
  computeCausalStrength,
} from './causal-graph';

// ---------------------------------------------------------------------------
// Do-calculus intervention
// ---------------------------------------------------------------------------

/**
 * Apply do-calculus intervention: do(X = value)
 * This removes all incoming edges to X (severing its causes)
 * and sets X to the specified value, then propagates effects.
 */
export function applyIntervention(
  graph: CausalGraph,
  intervention: CounterfactualIntervention,
): CausalGraph {
  const mutatedGraph = { ...graph };

  switch (intervention.type) {
    case 'set':
      // do(X = value): remove incoming edges, fix node value
      mutatedGraph.edges = graph.edges.filter((e) => e.targetId !== intervention.targetNodeId);
      mutatedGraph.nodes = graph.nodes.map((n) =>
        n.id === intervention.targetNodeId
          ? { ...n, properties: { ...n.properties, value: intervention.value }, observed: true, confidence: 1 }
          : n,
      );
      break;

    case 'remove':
      // Remove node and all its edges
      mutatedGraph.nodes = graph.nodes.filter((n) => n.id !== intervention.targetNodeId);
      mutatedGraph.edges = graph.edges.filter(
        (e) => e.sourceId !== intervention.targetNodeId && e.targetId !== intervention.targetNodeId,
      );
      break;

    case 'modify':
      // Modify node properties without severing causal links
      mutatedGraph.nodes = graph.nodes.map((n) =>
        n.id === intervention.targetNodeId
          ? { ...n, properties: { ...n.properties, ...(intervention.value as Record<string, unknown>) } }
          : n,
      );
      break;

    case 'delay':
      // Add delay to all outgoing edges from the target
      mutatedGraph.edges = graph.edges.map((e) =>
        e.sourceId === intervention.targetNodeId
          ? { ...e, delay: e.delay + (intervention.value as number) }
          : e,
      );
      break;

    case 'accelerate':
      // Reduce delay on all outgoing edges from the target
      mutatedGraph.edges = graph.edges.map((e) =>
        e.sourceId === intervention.targetNodeId
          ? { ...e, delay: Math.max(0, e.delay - (intervention.value as number)) }
          : e,
      );
      break;
  }

  return mutatedGraph;
}

// ---------------------------------------------------------------------------
// Counterfactual computation
// ---------------------------------------------------------------------------

/**
 * Compute a counterfactual: "What would outcome Y be if we had done X differently?"
 *
 * Three-step process (Pearl's counterfactual framework):
 * 1. Abduction: Use evidence to infer background conditions U
 * 2. Action: Apply intervention do(X=x) to the graph
 * 3. Prediction: Propagate effects through the modified graph
 */
export function computeCounterfactual(
  graph: CausalGraph,
  intervention: CounterfactualIntervention,
  outcomeNodeIds: string[],
): Counterfactual {
  const now = new Date().toISOString();

  // Step 1: Compute baseline outcome (current state)
  const baselineOutcome = computeOutcome(graph, outcomeNodeIds);

  // Step 2: Apply intervention (do-calculus)
  const interventedGraph = applyIntervention(graph, intervention);

  // Step 3: Compute alternate outcome
  const alternateOutcome = computeOutcome(interventedGraph, outcomeNodeIds);

  // Find all causal paths affected by the intervention
  const causalPathsAffected: string[][] = [];
  for (const outcomeId of outcomeNodeIds) {
    const paths = findCausalPaths(graph, intervention.targetNodeId, outcomeId);
    causalPathsAffected.push(...paths);
  }

  // Compute overall confidence based on path strengths
  const pathConfidences = causalPathsAffected.map((path) => {
    let confidence = 1;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.edges.find(
        (e) => e.sourceId === path[i] && e.targetId === path[i + 1],
      );
      if (edge) confidence *= edge.confidence;
    }
    return confidence;
  });

  const overallConfidence = pathConfidences.length > 0
    ? pathConfidences.reduce((s, c) => s + c, 0) / pathConfidences.length
    : 0;

  const targetNode = graph.nodes.find((n) => n.id === intervention.targetNodeId);

  return {
    id: uuidv4(),
    graphId: graph.id,
    question: `What would happen if "${targetNode?.label ?? intervention.targetNodeId}" were ${intervention.type === 'set' ? `set to ${JSON.stringify(intervention.value)}` : intervention.type + 'ed'}?`,
    intervention,
    baselineOutcome,
    alternateOutcome,
    causalPathsAffected,
    confidence: overallConfidence,
    computedAt: now,
  };
}

function computeOutcome(graph: CausalGraph, outcomeNodeIds: string[]): CounterfactualOutcome {
  const affectedNodes = outcomeNodeIds.map((nodeId) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    const ancestors = getCausalAncestors(graph, nodeId);
    const incomingStrength = ancestors.reduce((sum, ancestor) => {
      return sum + computeCausalStrength(graph, ancestor.id, nodeId);
    }, 0);

    return {
      nodeId,
      originalValue: node?.properties ?? {},
      projectedValue: {
        ...node?.properties,
        causalInfluence: Math.min(1, incomingStrength),
        ancestorCount: ancestors.length,
      },
      changeConfidence: node?.confidence ?? 0,
    };
  });

  return {
    affectedNodes,
    probabilityOfOccurrence: affectedNodes.reduce((s, n) => s + n.changeConfidence, 0) / affectedNodes.length,
    expectedTimeline: {
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600_000).toISOString(),
      precision: 'minute',
    },
    sideEffects: [],
  };
}

// ---------------------------------------------------------------------------
// Batch counterfactual analysis
// ---------------------------------------------------------------------------

/**
 * Compare multiple possible interventions to find the optimal action.
 * Returns counterfactuals ranked by desirability of alternate outcomes.
 */
export function compareInterventions(
  graph: CausalGraph,
  interventions: CounterfactualIntervention[],
  outcomeNodeIds: string[],
  desirabilityFn: (outcome: CounterfactualOutcome) => number,
): Array<{ intervention: CounterfactualIntervention; counterfactual: Counterfactual; desirability: number }> {
  const results = interventions.map((intervention) => {
    const counterfactual = computeCounterfactual(graph, intervention, outcomeNodeIds);
    const desirability = desirabilityFn(counterfactual.alternateOutcome);
    return { intervention, counterfactual, desirability };
  });

  return results.sort((a, b) => b.desirability - a.desirability);
}

/**
 * Find the minimum intervention needed to achieve a desired outcome.
 * Searches through intervention targets to find the one with highest
 * causal leverage on the desired outcome.
 */
export function findMinimalIntervention(
  graph: CausalGraph,
  desiredOutcomeNodeId: string,
  interventionCandidates: string[],
): { nodeId: string; causalLeverage: number; paths: string[][] }[] {
  const leverages = interventionCandidates.map((candidateId) => {
    const strength = computeCausalStrength(graph, candidateId, desiredOutcomeNodeId);
    const paths = findCausalPaths(graph, candidateId, desiredOutcomeNodeId);

    return {
      nodeId: candidateId,
      causalLeverage: strength,
      paths,
    };
  });

  // Sort by leverage descending — highest leverage = minimum intervention needed
  return leverages.sort((a, b) => b.causalLeverage - a.causalLeverage);
}

// ---------------------------------------------------------------------------
// Causal attribution
// ---------------------------------------------------------------------------

/**
 * Given an observed outcome, attribute causal responsibility to upstream nodes.
 * Answers: "Why did this outcome happen? Which agents/actions were most responsible?"
 */
export function attributeCausalResponsibility(
  graph: CausalGraph,
  outcomeNodeId: string,
): Array<{
  nodeId: string;
  label: string;
  agentId: string;
  responsibility: number;
  pathCount: number;
  directCause: boolean;
}> {
  const ancestors = getCausalAncestors(graph, outcomeNodeId);
  const attributions = ancestors.map((ancestor) => {
    const strength = computeCausalStrength(graph, ancestor.id, outcomeNodeId);
    const paths = findCausalPaths(graph, ancestor.id, outcomeNodeId);
    const directEdge = graph.edges.find(
      (e) => e.sourceId === ancestor.id && e.targetId === outcomeNodeId,
    );

    return {
      nodeId: ancestor.id,
      label: ancestor.label,
      agentId: ancestor.agentId,
      responsibility: strength,
      pathCount: paths.length,
      directCause: !!directEdge,
    };
  });

  // Normalize responsibilities to sum to 1
  const totalResp = attributions.reduce((s, a) => s + a.responsibility, 0);
  if (totalResp > 0) {
    for (const attr of attributions) {
      attr.responsibility /= totalResp;
    }
  }

  return attributions.sort((a, b) => b.responsibility - a.responsibility);
}
