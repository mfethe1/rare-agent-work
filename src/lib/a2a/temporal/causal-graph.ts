/**
 * Causal Graph Engine
 *
 * Builds, maintains, and queries causal models of agent interactions.
 * Supports interventional reasoning (do-calculus), d-separation tests,
 * and topological causal ordering.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  CausalGraph,
  CausalNode,
  CausalEdge,
  CausalEvidence,
  CausalRelation,
  TemporalCoordinate,
  TemporalEngineConfig,
  TemporalAnomaly,
} from './types';
import { DEFAULT_TEMPORAL_CONFIG } from './types';

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

export function createCausalGraph(params: {
  name: string;
  owner: string;
  collaborators?: string[];
}): CausalGraph {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: params.name,
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
    owner: params.owner,
    collaborators: params.collaborators ?? [],
    version: 1,
    confounders: [],
    interventionTargets: [],
    rootCauses: [],
    terminalOutcomes: [],
  };
}

export function addNode(
  graph: CausalGraph,
  params: Omit<CausalNode, 'id'>,
): { graph: CausalGraph; node: CausalNode } {
  const node: CausalNode = { id: uuidv4(), ...params };
  const updatedGraph = {
    ...graph,
    nodes: [...graph.nodes, node],
    updatedAt: new Date().toISOString(),
    version: graph.version + 1,
  };
  return { graph: recomputeStructuralMetadata(updatedGraph), node };
}

export function addEdge(
  graph: CausalGraph,
  params: Omit<CausalEdge, 'id'>,
  config: TemporalEngineConfig = DEFAULT_TEMPORAL_CONFIG,
): { graph: CausalGraph; edge: CausalEdge } | { error: string } {
  // Validate nodes exist
  const sourceExists = graph.nodes.some((n) => n.id === params.sourceId);
  const targetExists = graph.nodes.some((n) => n.id === params.targetId);
  if (!sourceExists || !targetExists) {
    return { error: `Source or target node not found in graph` };
  }

  // Check confidence threshold
  if (params.confidence < config.causalConfidenceThreshold) {
    return { error: `Edge confidence ${params.confidence} below threshold ${config.causalConfidenceThreshold}` };
  }

  // Check for causal loops
  if (wouldCreateCycle(graph, params.sourceId, params.targetId)) {
    return { error: `Adding edge ${params.sourceId} → ${params.targetId} would create a causal loop` };
  }

  // Check graph limits
  if (graph.edges.length >= config.maxGraphEdges) {
    return { error: `Graph has reached maximum edge count (${config.maxGraphEdges})` };
  }

  const edge: CausalEdge = { id: uuidv4(), ...params };
  const updatedGraph = {
    ...graph,
    edges: [...graph.edges, edge],
    updatedAt: new Date().toISOString(),
    version: graph.version + 1,
  };
  return { graph: recomputeStructuralMetadata(updatedGraph), edge };
}

export function removeNode(graph: CausalGraph, nodeId: string): CausalGraph {
  return recomputeStructuralMetadata({
    ...graph,
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    edges: graph.edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId),
    confounders: graph.confounders.filter((id) => id !== nodeId),
    interventionTargets: graph.interventionTargets.filter((id) => id !== nodeId),
    updatedAt: new Date().toISOString(),
    version: graph.version + 1,
  });
}

export function removeEdge(graph: CausalGraph, edgeId: string): CausalGraph {
  return recomputeStructuralMetadata({
    ...graph,
    edges: graph.edges.filter((e) => e.id !== edgeId),
    updatedAt: new Date().toISOString(),
    version: graph.version + 1,
  });
}

// ---------------------------------------------------------------------------
// Structural analysis
// ---------------------------------------------------------------------------

function recomputeStructuralMetadata(graph: CausalGraph): CausalGraph {
  const incomingCausal = new Set<string>();
  const outgoingCausal = new Set<string>();
  const causalRelations: CausalRelation[] = ['causes', 'enables', 'triggers'];

  for (const edge of graph.edges) {
    if (causalRelations.includes(edge.relation)) {
      incomingCausal.add(edge.targetId);
      outgoingCausal.add(edge.sourceId);
    }
  }

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  return {
    ...graph,
    rootCauses: [...nodeIds].filter((id) => !incomingCausal.has(id) && outgoingCausal.has(id)),
    terminalOutcomes: [...nodeIds].filter((id) => incomingCausal.has(id) && !outgoingCausal.has(id)),
  };
}

/** BFS cycle detection: would adding source→target create a cycle? */
function wouldCreateCycle(graph: CausalGraph, sourceId: string, targetId: string): boolean {
  // If there's already a path from target to source, adding source→target creates a cycle
  const visited = new Set<string>();
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edge of graph.edges) {
      if (edge.sourceId === current && !visited.has(edge.targetId)) {
        queue.push(edge.targetId);
      }
    }
  }
  return false;
}

/** Topological sort — returns nodes in causal order or null if cycle exists */
export function topologicalSort(graph: CausalGraph): CausalNode[] | null {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1);
    adjacency.get(edge.sourceId)?.push(edge.targetId);
  }

  const queue = graph.nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== graph.nodes.length) return null; // cycle detected

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  return sorted.map((id) => nodeMap.get(id)!);
}

// ---------------------------------------------------------------------------
// Causal queries
// ---------------------------------------------------------------------------

/** Find all causal paths between two nodes using DFS */
export function findCausalPaths(
  graph: CausalGraph,
  fromNodeId: string,
  toNodeId: string,
  maxDepth: number = 10,
): string[][] {
  const paths: string[][] = [];

  function dfs(current: string, path: string[], depth: number) {
    if (depth > maxDepth) return;
    if (current === toNodeId) {
      paths.push([...path]);
      return;
    }

    for (const edge of graph.edges) {
      if (edge.sourceId === current && !path.includes(edge.targetId)) {
        path.push(edge.targetId);
        dfs(edge.targetId, path, depth + 1);
        path.pop();
      }
    }
  }

  dfs(fromNodeId, [fromNodeId], 0);
  return paths;
}

/** Get the causal ancestors of a node (all nodes that causally influence it) */
export function getCausalAncestors(graph: CausalGraph, nodeId: string): CausalNode[] {
  const ancestors = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.targetId === current && !ancestors.has(edge.sourceId)) {
        ancestors.add(edge.sourceId);
        queue.push(edge.sourceId);
      }
    }
  }

  return graph.nodes.filter((n) => ancestors.has(n.id));
}

/** Get the causal descendants of a node (all nodes it causally influences) */
export function getCausalDescendants(graph: CausalGraph, nodeId: string): CausalNode[] {
  const descendants = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.sourceId === current && !descendants.has(edge.targetId)) {
        descendants.add(edge.targetId);
        queue.push(edge.targetId);
      }
    }
  }

  return graph.nodes.filter((n) => descendants.has(n.id));
}

/**
 * D-separation test: Are nodes X and Y conditionally independent given Z?
 * Uses the Bayes-Ball algorithm for efficiency.
 */
export function isDSeparated(
  graph: CausalGraph,
  xNodeIds: string[],
  yNodeIds: string[],
  givenNodeIds: string[],
): boolean {
  const given = new Set(givenNodeIds);
  const xSet = new Set(xNodeIds);
  const ySet = new Set(yNodeIds);

  // Build parent/child maps
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const node of graph.nodes) {
    parents.set(node.id, []);
    children.set(node.id, []);
  }
  for (const edge of graph.edges) {
    parents.get(edge.targetId)?.push(edge.sourceId);
    children.get(edge.sourceId)?.push(edge.targetId);
  }

  // Bayes-Ball: find all nodes reachable from X
  type Direction = 'up' | 'down';
  const visited = new Set<string>();
  const reachable = new Set<string>();
  const queue: Array<{ node: string; direction: Direction }> = [];

  for (const x of xNodeIds) {
    queue.push({ node: x, direction: 'up' });
    queue.push({ node: x, direction: 'down' });
  }

  while (queue.length > 0) {
    const { node, direction } = queue.shift()!;
    const key = `${node}:${direction}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (!xSet.has(node)) reachable.add(node);

    const isGiven = given.has(node);

    if (direction === 'up' && !isGiven) {
      // Pass through non-given nodes going up
      for (const parent of parents.get(node) ?? []) {
        queue.push({ node: parent, direction: 'up' });
      }
      for (const child of children.get(node) ?? []) {
        queue.push({ node: child, direction: 'down' });
      }
    } else if (direction === 'down') {
      if (!isGiven) {
        // Pass through non-given nodes going down
        for (const child of children.get(node) ?? []) {
          queue.push({ node: child, direction: 'down' });
        }
      }
      // Collider case: if given, pass up
      if (isGiven) {
        for (const parent of parents.get(node) ?? []) {
          queue.push({ node: parent, direction: 'up' });
        }
      }
    }
  }

  // X and Y are d-separated if no Y node is reachable
  return !yNodeIds.some((y) => reachable.has(y));
}

/**
 * Compute the causal effect strength from source to target,
 * considering all paths and their edge strengths.
 */
export function computeCausalStrength(
  graph: CausalGraph,
  sourceId: string,
  targetId: string,
): number {
  const paths = findCausalPaths(graph, sourceId, targetId);
  if (paths.length === 0) return 0;

  // Each path's strength = product of edge strengths along the path
  // Total causal effect = 1 - product of (1 - pathStrength) for all paths
  // (probability union assuming independence between paths)
  let complementProduct = 1;

  for (const path of paths) {
    let pathStrength = 1;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.edges.find(
        (e) => e.sourceId === path[i] && e.targetId === path[i + 1],
      );
      if (edge) {
        const directionMultiplier = ['prevents', 'inhibits', 'attenuates'].includes(edge.relation)
          ? -1
          : 1;
        pathStrength *= edge.strength * edge.confidence * directionMultiplier;
      } else {
        pathStrength = 0;
        break;
      }
    }
    complementProduct *= 1 - Math.abs(pathStrength);
  }

  return 1 - complementProduct;
}

// ---------------------------------------------------------------------------
// Anomaly detection on causal structure
// ---------------------------------------------------------------------------

/** Detect temporal anomalies in the causal graph */
export function detectCausalAnomalies(graph: CausalGraph): TemporalAnomaly[] {
  const anomalies: TemporalAnomaly[] = [];
  const now = new Date().toISOString();

  // Check for causality violations (effect timestamped before cause)
  for (const edge of graph.edges) {
    const source = graph.nodes.find((n) => n.id === edge.sourceId);
    const target = graph.nodes.find((n) => n.id === edge.targetId);
    if (!source || !target) continue;

    if (
      ['causes', 'enables', 'triggers'].includes(edge.relation) &&
      target.timestamp.logicalClock < source.timestamp.logicalClock
    ) {
      anomalies.push({
        id: uuidv4(),
        type: 'causality_violation',
        severity: 'critical',
        description: `Effect "${target.label}" (clock=${target.timestamp.logicalClock}) precedes cause "${source.label}" (clock=${source.timestamp.logicalClock})`,
        affectedNodes: [source.id, target.id],
        affectedEdges: [edge.id],
        detectedAt: now,
        evidence: [
          {
            type: 'observation',
            source: 'causal_graph_engine',
            timestamp: now,
            weight: 1,
            description: 'Logical clock ordering violation detected',
          },
        ],
        suggestedAction: 'Review causal relationship direction or correct timestamps',
        autoResolvable: false,
      });
    }
  }

  // Check for orphaned effects (nodes with incoming causal edges but no observed cause)
  for (const node of graph.nodes) {
    if (!node.observed) {
      const incomingEdges = graph.edges.filter((e) => e.targetId === node.id);
      const allCausesUnobserved = incomingEdges.every((e) => {
        const source = graph.nodes.find((n) => n.id === e.sourceId);
        return source && !source.observed;
      });

      if (incomingEdges.length > 0 && allCausesUnobserved) {
        anomalies.push({
          id: uuidv4(),
          type: 'phantom_cause',
          severity: 'warning',
          description: `Node "${node.label}" has only unobserved causal ancestors — inferred chain may be spurious`,
          affectedNodes: [node.id],
          affectedEdges: incomingEdges.map((e) => e.id),
          detectedAt: now,
          evidence: [],
          suggestedAction: 'Seek direct observation or additional evidence for causal chain',
          autoResolvable: false,
        });
      }
    }
  }

  // Check for suspiciously strong correlations without causal mechanism
  for (const edge of graph.edges) {
    if (edge.relation === 'correlates' && edge.strength > 0.8 && edge.confidence > 0.7) {
      const hasCausalPath = findCausalPaths(graph, edge.sourceId, edge.targetId, 5).length > 0 ||
        findCausalPaths(graph, edge.targetId, edge.sourceId, 5).length > 0;

      if (!hasCausalPath) {
        anomalies.push({
          id: uuidv4(),
          type: 'unexpected_effect',
          severity: 'info',
          description: `Strong correlation (${edge.strength}) between nodes without known causal mechanism — possible hidden confounder`,
          affectedNodes: [edge.sourceId, edge.targetId],
          affectedEdges: [edge.id],
          detectedAt: now,
          evidence: edge.evidence,
          suggestedAction: 'Investigate potential confounding variables or hidden causal paths',
          autoResolvable: false,
        });
      }
    }
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// Graph merge (for collaborative causal modeling)
// ---------------------------------------------------------------------------

/** Merge two causal graphs, resolving conflicts by confidence scores */
export function mergeCausalGraphs(
  primary: CausalGraph,
  secondary: CausalGraph,
): CausalGraph {
  const nodeMap = new Map<string, CausalNode>();
  const edgeMap = new Map<string, CausalEdge>();

  // Primary nodes take precedence
  for (const node of primary.nodes) nodeMap.set(node.id, node);
  for (const node of secondary.nodes) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    } else {
      // Keep higher confidence version
      const existing = nodeMap.get(node.id)!;
      if (node.confidence > existing.confidence) {
        nodeMap.set(node.id, node);
      }
    }
  }

  // Merge edges — combine evidence for duplicates
  for (const edge of [...primary.edges, ...secondary.edges]) {
    const key = `${edge.sourceId}→${edge.targetId}:${edge.relation}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, edge);
    } else {
      const existing = edgeMap.get(key)!;
      edgeMap.set(key, {
        ...existing,
        confidence: Math.max(existing.confidence, edge.confidence),
        strength: (existing.strength + edge.strength) / 2,
        evidence: [...existing.evidence, ...edge.evidence],
      });
    }
  }

  const merged: CausalGraph = {
    id: uuidv4(),
    name: `${primary.name} ∪ ${secondary.name}`,
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: primary.owner,
    collaborators: [...new Set([...primary.collaborators, ...secondary.collaborators, secondary.owner])],
    version: 1,
    confounders: [...new Set([...primary.confounders, ...secondary.confounders])],
    interventionTargets: [...new Set([...primary.interventionTargets, ...secondary.interventionTargets])],
    rootCauses: [],
    terminalOutcomes: [],
  };

  return recomputeStructuralMetadata(merged);
}
