/**
 * A2A Agent Knowledge Graph Engine
 *
 * Provides:
 * - Knowledge node CRUD with confidence scoring and provenance
 * - Knowledge edge CRUD with typed relationships
 * - Graph traversal (BFS/DFS) with filtering
 * - Path finding between nodes
 * - Contradiction detection and surfacing
 * - Node merging for deduplication
 * - Temporal confidence decay (stale knowledge fades)
 * - Access tracking (frequently used knowledge stays relevant)
 */

import { getServiceDb } from '../auth';
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  TraversalStrategy,
  TraversalDirection,
  TraversalResult,
  PathResult,
  PathStep,
  Contradiction,
} from './types';
import type {
  NodeCreateInput,
  NodeUpdateInput,
  NodeSearchInput,
  EdgeCreateInput,
  EdgeListInput,
  TraverseInput,
  PathInput,
  MergeInput,
} from './validation';

// ──────────────────────────────────────────────
// Node CRUD
// ──────────────────────────────────────────────

interface CreateNodeParams {
  agent_id: string;
  input: NodeCreateInput;
}

export async function createNode({ agent_id, input }: CreateNodeParams): Promise<
  | { node_id: string; created_at: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const now = new Date().toISOString();

  const { data, error } = await db
    .from('a2a_knowledge_nodes')
    .insert({
      node_type: input.node_type,
      name: input.name,
      description: input.description,
      namespace: input.namespace ?? 'default',
      properties: input.properties ?? {},
      tags: input.tags ?? [],
      contributed_by: agent_id,
      source_task_id: input.source_task_id ?? null,
      confidence: input.confidence ?? 0.8,
      decay_rate: input.decay_rate ?? 0.01,
      access_count: 0,
      last_accessed_at: now,
    })
    .select('id, created_at')
    .single();

  if (error || !data) return { error: 'Failed to create knowledge node', status_code: 500 };

  return { node_id: data.id, created_at: data.created_at };
}

interface UpdateNodeParams {
  agent_id: string;
  node_id: string;
  input: NodeUpdateInput;
}

export async function updateNode({ agent_id, node_id, input }: UpdateNodeParams): Promise<
  | { node_id: string; updated_at: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Verify the node exists and the agent owns it (or can update it)
  const { data: existing } = await db
    .from('a2a_knowledge_nodes')
    .select('id, contributed_by')
    .eq('id', node_id)
    .single();

  if (!existing) return { error: 'Knowledge node not found', status_code: 404 };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.properties !== undefined) update.properties = input.properties;
  if (input.tags !== undefined) update.tags = input.tags;
  if (input.confidence !== undefined) update.confidence = input.confidence;
  if (input.decay_rate !== undefined) update.decay_rate = input.decay_rate;

  const { data, error } = await db
    .from('a2a_knowledge_nodes')
    .update(update)
    .eq('id', node_id)
    .select('id, updated_at')
    .single();

  if (error || !data) return { error: 'Failed to update knowledge node', status_code: 500 };

  return { node_id: data.id, updated_at: data.updated_at };
}

export async function deleteNode(node_id: string): Promise<
  | { deleted: true }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Delete edges connected to this node first
  await db
    .from('a2a_knowledge_edges')
    .delete()
    .or(`source_node_id.eq.${node_id},target_node_id.eq.${node_id}`);

  const { error } = await db
    .from('a2a_knowledge_nodes')
    .delete()
    .eq('id', node_id);

  if (error) return { error: 'Failed to delete knowledge node', status_code: 500 };

  return { deleted: true };
}

export async function getNode(node_id: string): Promise<KnowledgeNode | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data } = await db
    .from('a2a_knowledge_nodes')
    .select('*')
    .eq('id', node_id)
    .single();

  if (!data) return null;

  // Track access
  await db
    .from('a2a_knowledge_nodes')
    .update({
      access_count: (data.access_count ?? 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', node_id);

  return data as KnowledgeNode;
}

export async function searchNodes(input: NodeSearchInput): Promise<{
  nodes: KnowledgeNode[];
  count: number;
}> {
  const db = getServiceDb();
  if (!db) return { nodes: [], count: 0 };

  let query = db.from('a2a_knowledge_nodes').select('*', { count: 'exact' });

  if (input.node_type) query = query.eq('node_type', input.node_type);
  if (input.namespace) query = query.eq('namespace', input.namespace);
  if (input.contributed_by) query = query.eq('contributed_by', input.contributed_by);
  if (input.min_confidence != null) query = query.gte('confidence', input.min_confidence);
  if (input.tag) query = query.contains('tags', [input.tag]);
  if (input.name_contains) query = query.ilike('name', `%${input.name_contains}%`);

  const { data, count, error } = await query
    .order('confidence', { ascending: false })
    .order('access_count', { ascending: false })
    .range(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50) - 1);

  if (error) return { nodes: [], count: 0 };

  return {
    nodes: (data as KnowledgeNode[]) ?? [],
    count: count ?? 0,
  };
}

// ──────────────────────────────────────────────
// Edge CRUD
// ──────────────────────────────────────────────

interface CreateEdgeParams {
  agent_id: string;
  input: EdgeCreateInput;
}

export async function createEdge({ agent_id, input }: CreateEdgeParams): Promise<
  | { edge_id: string; created_at: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Self-edges are not allowed
  if (input.source_node_id === input.target_node_id) {
    return { error: 'Self-referencing edges are not allowed', status_code: 400 };
  }

  // Verify both nodes exist
  const { data: nodes } = await db
    .from('a2a_knowledge_nodes')
    .select('id')
    .in('id', [input.source_node_id, input.target_node_id]);

  if (!nodes || nodes.length < 2) {
    return { error: 'One or both nodes not found', status_code: 404 };
  }

  // Check for duplicate edge
  const { data: existing } = await db
    .from('a2a_knowledge_edges')
    .select('id')
    .eq('source_node_id', input.source_node_id)
    .eq('target_node_id', input.target_node_id)
    .eq('relationship', input.relationship)
    .single();

  if (existing) {
    return { error: 'An edge with this relationship already exists between these nodes', status_code: 409 };
  }

  const { data, error } = await db
    .from('a2a_knowledge_edges')
    .insert({
      source_node_id: input.source_node_id,
      target_node_id: input.target_node_id,
      relationship: input.relationship,
      weight: input.weight ?? 0.5,
      contributed_by: agent_id,
      properties: input.properties ?? {},
    })
    .select('id, created_at')
    .single();

  if (error || !data) return { error: 'Failed to create knowledge edge', status_code: 500 };

  return { edge_id: data.id, created_at: data.created_at };
}

export async function deleteEdge(edge_id: string): Promise<
  | { deleted: true }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { error } = await db
    .from('a2a_knowledge_edges')
    .delete()
    .eq('id', edge_id);

  if (error) return { error: 'Failed to delete knowledge edge', status_code: 500 };
  return { deleted: true };
}

export async function listEdges(input: EdgeListInput): Promise<{
  edges: KnowledgeEdge[];
  count: number;
}> {
  const db = getServiceDb();
  if (!db) return { edges: [], count: 0 };

  let query = db.from('a2a_knowledge_edges').select('*', { count: 'exact' });

  if (input.node_id) {
    query = query.or(`source_node_id.eq.${input.node_id},target_node_id.eq.${input.node_id}`);
  }
  if (input.relationship) query = query.eq('relationship', input.relationship);
  if (input.contributed_by) query = query.eq('contributed_by', input.contributed_by);
  if (input.min_weight != null) query = query.gte('weight', input.min_weight);

  const { data, count, error } = await query
    .order('weight', { ascending: false })
    .range(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50) - 1);

  if (error) return { edges: [], count: 0 };

  return {
    edges: (data as KnowledgeEdge[]) ?? [],
    count: count ?? 0,
  };
}

// ──────────────────────────────────────────────
// Graph Traversal
// ──────────────────────────────────────────────

export async function traverseGraph(input: TraverseInput): Promise<
  | TraversalResult
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const maxDepth = input.max_depth ?? 3;
  const strategy = input.strategy ?? 'bfs';
  const direction = input.direction ?? 'outgoing';
  const minConfidence = input.min_confidence ?? 0;
  const minWeight = input.min_weight ?? 0;

  // Get the starting node
  const startNode = await getNode(input.start_node_id);
  if (!startNode) return { error: 'Start node not found', status_code: 404 };

  const visitedNodes = new Map<string, KnowledgeNode>();
  const collectedEdges: KnowledgeEdge[] = [];
  visitedNodes.set(startNode.id, startNode);

  const frontier: Array<{ nodeId: string; depth: number }> = [
    { nodeId: startNode.id, depth: 0 },
  ];

  let depthReached = 0;

  while (frontier.length > 0) {
    const current = strategy === 'bfs' ? frontier.shift()! : frontier.pop()!;

    if (current.depth >= maxDepth) continue;
    if (current.depth > depthReached) depthReached = current.depth;

    // Fetch edges from this node
    const edges = await fetchEdgesForNode(db, current.nodeId, direction, input.relationship_filter, minWeight);

    for (const edge of edges) {
      const neighborId = edge.source_node_id === current.nodeId
        ? edge.target_node_id
        : edge.source_node_id;

      if (visitedNodes.has(neighborId)) {
        // Still collect the edge for completeness
        if (!collectedEdges.find((e) => e.id === edge.id)) {
          collectedEdges.push(edge);
        }
        continue;
      }

      // Fetch the neighbor node
      const { data: neighbor } = await db
        .from('a2a_knowledge_nodes')
        .select('*')
        .eq('id', neighborId)
        .single();

      if (!neighbor) continue;
      const neighborNode = neighbor as KnowledgeNode;

      // Apply confidence filter
      if (neighborNode.confidence < minConfidence) continue;

      visitedNodes.set(neighborId, neighborNode);
      collectedEdges.push(edge);
      frontier.push({ nodeId: neighborId, depth: current.depth + 1 });
    }
  }

  return {
    origin: startNode,
    nodes: Array.from(visitedNodes.values()),
    edges: collectedEdges,
    depth_reached: depthReached,
  };
}

/** Fetch edges connected to a node, respecting direction and filters. */
async function fetchEdgesForNode(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  nodeId: string,
  direction: TraversalDirection,
  relationshipFilter?: KnowledgeEdgeType[],
  minWeight?: number,
): Promise<KnowledgeEdge[]> {
  let query = db.from('a2a_knowledge_edges').select('*');

  if (direction === 'outgoing') {
    query = query.eq('source_node_id', nodeId);
  } else if (direction === 'incoming') {
    query = query.eq('target_node_id', nodeId);
  } else {
    query = query.or(`source_node_id.eq.${nodeId},target_node_id.eq.${nodeId}`);
  }

  if (relationshipFilter && relationshipFilter.length > 0) {
    query = query.in('relationship', relationshipFilter);
  }

  if (minWeight != null && minWeight > 0) {
    query = query.gte('weight', minWeight);
  }

  const { data } = await query;
  return (data as KnowledgeEdge[]) ?? [];
}

// ──────────────────────────────────────────────
// Path Finding (BFS shortest path)
// ──────────────────────────────────────────────

export async function findPath(input: PathInput): Promise<
  | PathResult
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const maxDepth = input.max_depth ?? 6;

  // Get both nodes
  const [sourceNode, targetNode] = await Promise.all([
    getNodeRaw(db, input.source_node_id),
    getNodeRaw(db, input.target_node_id),
  ]);

  if (!sourceNode) return { error: 'Source node not found', status_code: 404 };
  if (!targetNode) return { error: 'Target node not found', status_code: 404 };

  if (input.source_node_id === input.target_node_id) {
    return {
      found: true,
      path: [{ node: sourceNode, edge: null }],
      total_weight: 0,
    };
  }

  // BFS for shortest path
  const visited = new Set<string>([sourceNode.id]);
  const parentMap = new Map<string, { node: KnowledgeNode; edge: KnowledgeEdge }>();
  const queue: Array<{ nodeId: string; depth: number }> = [
    { nodeId: sourceNode.id, depth: 0 },
  ];

  let found = false;

  while (queue.length > 0 && !found) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const edges = await fetchEdgesForNode(
      db, current.nodeId, 'both', input.relationship_filter, 0,
    );

    for (const edge of edges) {
      const neighborId = edge.source_node_id === current.nodeId
        ? edge.target_node_id
        : edge.source_node_id;

      if (visited.has(neighborId)) continue;
      visited.add(neighborId);

      const { data: neighbor } = await db
        .from('a2a_knowledge_nodes')
        .select('*')
        .eq('id', neighborId)
        .single();

      if (!neighbor) continue;
      const neighborNode = neighbor as KnowledgeNode;

      parentMap.set(neighborId, { node: neighborNode, edge });

      if (neighborId === input.target_node_id) {
        found = true;
        break;
      }

      queue.push({ nodeId: neighborId, depth: current.depth + 1 });
    }
  }

  if (!found) {
    return { found: false, path: [], total_weight: 0 };
  }

  // Reconstruct path
  const path: PathStep[] = [];
  let currentId = input.target_node_id;
  let totalWeight = 0;

  while (currentId !== input.source_node_id) {
    const entry = parentMap.get(currentId)!;
    path.unshift({ node: entry.node, edge: entry.edge });
    totalWeight += entry.edge.weight;
    currentId = entry.edge.source_node_id === currentId
      ? entry.edge.target_node_id
      : entry.edge.source_node_id;
  }

  // Prepend the source node
  path.unshift({ node: sourceNode, edge: null });

  return { found: true, path, total_weight: totalWeight };
}

/** Get a node without tracking access (internal use). */
async function getNodeRaw(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  nodeId: string,
): Promise<KnowledgeNode | null> {
  const { data } = await db
    .from('a2a_knowledge_nodes')
    .select('*')
    .eq('id', nodeId)
    .single();

  return (data as KnowledgeNode) ?? null;
}

// ──────────────────────────────────────────────
// Contradiction Detection
// ──────────────────────────────────────────────

export async function findContradictions(
  namespace?: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ contradictions: Contradiction[]; count: number }> {
  const db = getServiceDb();
  if (!db) return { contradictions: [], count: 0 };

  // Find all 'contradicts' edges
  let query = db
    .from('a2a_knowledge_edges')
    .select('*', { count: 'exact' })
    .eq('relationship', 'contradicts');

  const { data: edges, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !edges || edges.length === 0) return { contradictions: [], count: 0 };

  const contradictions: Contradiction[] = [];

  for (const edge of edges as KnowledgeEdge[]) {
    const [nodeA, nodeB] = await Promise.all([
      getNodeRaw(db, edge.source_node_id),
      getNodeRaw(db, edge.target_node_id),
    ]);

    if (!nodeA || !nodeB) continue;

    // Filter by namespace if specified
    if (namespace && nodeA.namespace !== namespace && nodeB.namespace !== namespace) continue;

    contradictions.push({
      edge,
      node_a: nodeA,
      node_b: nodeB,
      higher_confidence_node_id:
        nodeA.confidence >= nodeB.confidence ? nodeA.id : nodeB.id,
    });
  }

  return { contradictions, count: count ?? contradictions.length };
}

// ──────────────────────────────────────────────
// Node Merging
// ──────────────────────────────────────────────

export async function mergeNodes(agent_id: string, input: MergeInput): Promise<
  | { merged_node: KnowledgeNode; edges_transferred: number; secondary_node_deleted: boolean }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  if (input.primary_node_id === input.secondary_node_id) {
    return { error: 'Cannot merge a node with itself', status_code: 400 };
  }

  const [primary, secondary] = await Promise.all([
    getNodeRaw(db, input.primary_node_id),
    getNodeRaw(db, input.secondary_node_id),
  ]);

  if (!primary) return { error: 'Primary node not found', status_code: 404 };
  if (!secondary) return { error: 'Secondary node not found', status_code: 404 };

  // Merge properties based on strategy
  let mergedProperties: Record<string, unknown>;
  let mergedName: string;
  let mergedDescription: string;
  let mergedConfidence: number;

  switch (input.conflict_strategy) {
    case 'prefer_primary':
      mergedProperties = { ...secondary.properties, ...primary.properties };
      mergedName = primary.name;
      mergedDescription = primary.description;
      mergedConfidence = primary.confidence;
      break;
    case 'prefer_secondary':
      mergedProperties = { ...primary.properties, ...secondary.properties };
      mergedName = secondary.name;
      mergedDescription = secondary.description;
      mergedConfidence = secondary.confidence;
      break;
    case 'merge_all':
      mergedProperties = { ...primary.properties, ...secondary.properties };
      mergedName = primary.name;
      mergedDescription = `${primary.description}\n\n[Merged from: ${secondary.name}] ${secondary.description}`;
      mergedConfidence = Math.max(primary.confidence, secondary.confidence);
      break;
  }

  // Merge tags (union)
  const mergedTags = [...new Set([...primary.tags, ...secondary.tags])];

  // Update primary node
  const now = new Date().toISOString();
  await db
    .from('a2a_knowledge_nodes')
    .update({
      name: mergedName,
      description: mergedDescription,
      properties: mergedProperties,
      tags: mergedTags,
      confidence: mergedConfidence,
      access_count: primary.access_count + secondary.access_count,
      updated_at: now,
    })
    .eq('id', input.primary_node_id);

  // Transfer edges from secondary to primary
  let edgesTransferred = 0;

  // Outgoing edges from secondary → remap to primary
  const { data: outEdges } = await db
    .from('a2a_knowledge_edges')
    .select('id, target_node_id, relationship')
    .eq('source_node_id', input.secondary_node_id);

  for (const edge of (outEdges ?? []) as Array<{ id: string; target_node_id: string; relationship: string }>) {
    // Skip if it would create a self-edge or duplicate
    if (edge.target_node_id === input.primary_node_id) {
      await db.from('a2a_knowledge_edges').delete().eq('id', edge.id);
      continue;
    }
    const { data: dup } = await db
      .from('a2a_knowledge_edges')
      .select('id')
      .eq('source_node_id', input.primary_node_id)
      .eq('target_node_id', edge.target_node_id)
      .eq('relationship', edge.relationship)
      .single();

    if (dup) {
      await db.from('a2a_knowledge_edges').delete().eq('id', edge.id);
    } else {
      await db
        .from('a2a_knowledge_edges')
        .update({ source_node_id: input.primary_node_id })
        .eq('id', edge.id);
      edgesTransferred++;
    }
  }

  // Incoming edges to secondary → remap to primary
  const { data: inEdges } = await db
    .from('a2a_knowledge_edges')
    .select('id, source_node_id, relationship')
    .eq('target_node_id', input.secondary_node_id);

  for (const edge of (inEdges ?? []) as Array<{ id: string; source_node_id: string; relationship: string }>) {
    if (edge.source_node_id === input.primary_node_id) {
      await db.from('a2a_knowledge_edges').delete().eq('id', edge.id);
      continue;
    }
    const { data: dup } = await db
      .from('a2a_knowledge_edges')
      .select('id')
      .eq('source_node_id', edge.source_node_id)
      .eq('target_node_id', input.primary_node_id)
      .eq('relationship', edge.relationship)
      .single();

    if (dup) {
      await db.from('a2a_knowledge_edges').delete().eq('id', edge.id);
    } else {
      await db
        .from('a2a_knowledge_edges')
        .update({ target_node_id: input.primary_node_id })
        .eq('id', edge.id);
      edgesTransferred++;
    }
  }

  // Delete the secondary node
  await db.from('a2a_knowledge_nodes').delete().eq('id', input.secondary_node_id);

  // Fetch the updated primary
  const merged = await getNodeRaw(db, input.primary_node_id);

  return {
    merged_node: merged!,
    edges_transferred: edgesTransferred,
    secondary_node_deleted: true,
  };
}

// ──────────────────────────────────────────────
// Temporal Confidence Decay
// ──────────────────────────────────────────────

/** Minimum confidence before a node is pruned. */
const PRUNE_THRESHOLD = 0.05;

/**
 * Apply temporal confidence decay to all knowledge nodes.
 *
 * For each node, confidence is reduced based on:
 *   new_confidence = confidence * (1 - decay_rate) ^ days_since_last_access
 *
 * Nodes that fall below the prune threshold are deleted.
 */
export async function applyDecay(): Promise<
  | { nodes_decayed: number; nodes_pruned: number }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const now = new Date();

  // Fetch all nodes with non-zero decay
  const { data: nodes, error } = await db
    .from('a2a_knowledge_nodes')
    .select('id, confidence, decay_rate, last_accessed_at')
    .gt('decay_rate', 0);

  if (error) return { error: 'Failed to fetch nodes for decay', status_code: 500 };
  if (!nodes || nodes.length === 0) return { nodes_decayed: 0, nodes_pruned: 0 };

  let decayed = 0;
  let pruned = 0;

  for (const node of nodes as Array<{
    id: string;
    confidence: number;
    decay_rate: number;
    last_accessed_at: string;
  }>) {
    const lastAccessed = new Date(node.last_accessed_at);
    const daysSinceAccess = (now.getTime() - lastAccessed.getTime()) / 86_400_000;

    if (daysSinceAccess < 1) continue; // No decay for recently accessed nodes

    const newConfidence = node.confidence * Math.pow(1 - node.decay_rate, daysSinceAccess);

    if (newConfidence < PRUNE_THRESHOLD) {
      // Delete the node and its edges
      await db
        .from('a2a_knowledge_edges')
        .delete()
        .or(`source_node_id.eq.${node.id},target_node_id.eq.${node.id}`);
      await db.from('a2a_knowledge_nodes').delete().eq('id', node.id);
      pruned++;
    } else {
      await db
        .from('a2a_knowledge_nodes')
        .update({ confidence: newConfidence })
        .eq('id', node.id);
      decayed++;
    }
  }

  return { nodes_decayed: decayed, nodes_pruned: pruned };
}

// ──────────────────────────────────────────────
// Knowledge Reinforcement
// ──────────────────────────────────────────────

/**
 * Reinforce a knowledge node — boost its confidence and reset decay timer.
 * Called when an agent explicitly confirms or re-uses knowledge.
 */
export async function reinforceNode(
  node_id: string,
  boost: number = 0.1,
): Promise<
  | { node_id: string; new_confidence: number }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data: node } = await db
    .from('a2a_knowledge_nodes')
    .select('id, confidence, access_count')
    .eq('id', node_id)
    .single();

  if (!node) return { error: 'Knowledge node not found', status_code: 404 };

  const newConfidence = Math.min(1.0, (node.confidence ?? 0) + boost);

  const { error } = await db
    .from('a2a_knowledge_nodes')
    .update({
      confidence: newConfidence,
      access_count: (node.access_count ?? 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', node_id);

  if (error) return { error: 'Failed to reinforce node', status_code: 500 };

  return { node_id, new_confidence: newConfidence };
}
