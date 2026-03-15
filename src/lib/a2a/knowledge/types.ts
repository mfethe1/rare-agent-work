/**
 * A2A Agent Knowledge Graph — Types
 *
 * A shared semantic knowledge graph that enables agents to collectively
 * accumulate, share, and reason over structured knowledge. Unlike the
 * simple key-value context store, the knowledge graph captures typed
 * entities, rich relationships, provenance, confidence scoring, and
 * supports graph traversal queries.
 *
 * In a 2028 agent-first world, agents that can't build shared understanding
 * are just sophisticated RPC endpoints. The knowledge graph is the
 * collective memory layer that transforms isolated agents into an
 * intelligent ecosystem.
 *
 * Core concepts:
 *   - KnowledgeNode: A typed entity (concept, fact, skill, pattern, etc.)
 *     with confidence scoring, provenance, and temporal decay
 *   - KnowledgeEdge: A typed, weighted relationship between nodes
 *     (depends_on, contradicts, supersedes, derived_from, etc.)
 *   - Provenance: Every piece of knowledge tracks who contributed it,
 *     what task produced it, and how confident the contributor is
 *   - Decay: Knowledge loses confidence over time if not accessed or
 *     reinforced, preventing stale knowledge from polluting decisions
 *   - Contradiction Detection: Edges of type 'contradicts' enable
 *     agents to surface conflicting knowledge for resolution
 *   - Graph Traversal: BFS/DFS queries let agents explore knowledge
 *     neighborhoods, find paths, and reason over relationships
 *
 * Database tables:
 *   - a2a_knowledge_nodes
 *   - a2a_knowledge_edges
 */

// ──────────────────────────────────────────────
// Knowledge Node
// ──────────────────────────────────────────────

/** Categories of knowledge that nodes can represent. */
export type KnowledgeNodeType =
  | 'concept'       // Abstract idea or domain concept
  | 'fact'          // Verified statement about the world
  | 'skill'         // A capability or technique an agent has learned
  | 'pattern'       // A recurring pattern observed across tasks
  | 'inference'     // Knowledge derived from reasoning over other nodes
  | 'observation'   // Raw observation from task execution
  | 'decision'      // A decision made and its rationale
  | 'entity';       // A named entity (person, system, service, etc.)

/** A node in the knowledge graph. */
export interface KnowledgeNode {
  /** Platform-assigned node ID (UUID). */
  id: string;
  /** The type/category of this knowledge. */
  node_type: KnowledgeNodeType;
  /** Short, descriptive name. */
  name: string;
  /** Longer description of what this knowledge represents. */
  description: string;
  /** Namespace for organizing knowledge (e.g., "finance", "security"). */
  namespace: string;
  /** Arbitrary structured properties. */
  properties: Record<string, unknown>;
  /** Tags for classification and search. */
  tags: string[];
  /** Agent that contributed this knowledge. */
  contributed_by: string;
  /** Task that produced this knowledge (if any). */
  source_task_id: string | null;
  /** Confidence score (0.0 – 1.0). Decays over time. */
  confidence: number;
  /** Rate at which confidence decays per day (0.0 – 1.0). 0 = no decay. */
  decay_rate: number;
  /** Number of times this node has been accessed/referenced. */
  access_count: number;
  /** Last time this node was accessed or reinforced. */
  last_accessed_at: string;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Knowledge Edge
// ──────────────────────────────────────────────

/** Types of relationships between knowledge nodes. */
export type KnowledgeEdgeType =
  | 'related_to'      // General association
  | 'depends_on'      // Source depends on target
  | 'contradicts'     // Source contradicts target (conflict)
  | 'supersedes'      // Source replaces/updates target
  | 'derived_from'    // Source was inferred from target
  | 'part_of'         // Source is a component of target
  | 'causes'          // Source causes target
  | 'enables'         // Source enables target
  | 'requires'        // Source requires target
  | 'similar_to';     // Source is semantically similar to target

/** A directed, typed, weighted edge in the knowledge graph. */
export interface KnowledgeEdge {
  /** Platform-assigned edge ID (UUID). */
  id: string;
  /** Source node ID. */
  source_node_id: string;
  /** Target node ID. */
  target_node_id: string;
  /** Type of relationship. */
  relationship: KnowledgeEdgeType;
  /** Strength/confidence of the relationship (0.0 – 1.0). */
  weight: number;
  /** Agent that asserted this relationship. */
  contributed_by: string;
  /** Arbitrary structured properties on the edge. */
  properties: Record<string, unknown>;
  /** ISO-8601 timestamps. */
  created_at: string;
}

// ──────────────────────────────────────────────
// Graph Traversal
// ──────────────────────────────────────────────

/** Traversal strategy for graph queries. */
export type TraversalStrategy = 'bfs' | 'dfs';

/** Direction for traversal from a given node. */
export type TraversalDirection = 'outgoing' | 'incoming' | 'both';

/** A single step in a graph path. */
export interface PathStep {
  node: KnowledgeNode;
  edge: KnowledgeEdge | null; // null for the starting node
}

/** Result of a graph traversal query. */
export interface TraversalResult {
  /** Starting node. */
  origin: KnowledgeNode;
  /** All nodes discovered during traversal. */
  nodes: KnowledgeNode[];
  /** All edges traversed. */
  edges: KnowledgeEdge[];
  /** Depth reached. */
  depth_reached: number;
}

/** Result of a path-finding query between two nodes. */
export interface PathResult {
  /** Whether a path was found. */
  found: boolean;
  /** The path (sequence of steps from source to target). */
  path: PathStep[];
  /** Total weight of the path (sum of edge weights). */
  total_weight: number;
}

// ──────────────────────────────────────────────
// Contradiction
// ──────────────────────────────────────────────

/** A detected contradiction between two knowledge nodes. */
export interface Contradiction {
  /** The edge asserting the contradiction. */
  edge: KnowledgeEdge;
  /** The two nodes that contradict each other. */
  node_a: KnowledgeNode;
  node_b: KnowledgeNode;
  /** Which node has higher confidence. */
  higher_confidence_node_id: string;
}

// ──────────────────────────────────────────────
// API Request / Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/knowledge/nodes — create a knowledge node. */
export interface NodeCreateRequest {
  node_type: KnowledgeNodeType;
  name: string;
  description: string;
  namespace?: string;
  properties?: Record<string, unknown>;
  tags?: string[];
  source_task_id?: string;
  confidence?: number;
  decay_rate?: number;
}

export interface NodeCreateResponse {
  node_id: string;
  created_at: string;
}

/** PATCH /api/a2a/knowledge/nodes/:id — update a knowledge node. */
export interface NodeUpdateRequest {
  name?: string;
  description?: string;
  properties?: Record<string, unknown>;
  tags?: string[];
  confidence?: number;
  decay_rate?: number;
}

export interface NodeUpdateResponse {
  node_id: string;
  updated_at: string;
}

/** GET /api/a2a/knowledge/nodes — search/list nodes. */
export interface NodeSearchResponse {
  nodes: KnowledgeNode[];
  count: number;
}

/** POST /api/a2a/knowledge/edges — create an edge. */
export interface EdgeCreateRequest {
  source_node_id: string;
  target_node_id: string;
  relationship: KnowledgeEdgeType;
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface EdgeCreateResponse {
  edge_id: string;
  created_at: string;
}

/** GET /api/a2a/knowledge/edges — list edges. */
export interface EdgeListResponse {
  edges: KnowledgeEdge[];
  count: number;
}

/** POST /api/a2a/knowledge/traverse — graph traversal. */
export interface TraverseRequest {
  start_node_id: string;
  max_depth?: number;
  strategy?: TraversalStrategy;
  direction?: TraversalDirection;
  relationship_filter?: KnowledgeEdgeType[];
  min_confidence?: number;
  min_weight?: number;
}

export interface TraverseResponse {
  result: TraversalResult;
}

/** POST /api/a2a/knowledge/path — find path between two nodes. */
export interface PathRequest {
  source_node_id: string;
  target_node_id: string;
  max_depth?: number;
  relationship_filter?: KnowledgeEdgeType[];
}

export interface PathResponse {
  result: PathResult;
}

/** GET /api/a2a/knowledge/contradictions — list contradictions. */
export interface ContradictionsResponse {
  contradictions: Contradiction[];
  count: number;
}

/** POST /api/a2a/knowledge/merge — merge duplicate nodes. */
export interface MergeRequest {
  /** The node that survives (absorbs the other). */
  primary_node_id: string;
  /** The node that gets merged into the primary (deleted). */
  secondary_node_id: string;
  /** Strategy for property conflicts. */
  conflict_strategy: 'prefer_primary' | 'prefer_secondary' | 'merge_all';
}

export interface MergeResponse {
  merged_node: KnowledgeNode;
  edges_transferred: number;
  secondary_node_deleted: boolean;
}

/** POST /api/a2a/knowledge/decay — trigger confidence decay. */
export interface DecayResponse {
  nodes_decayed: number;
  nodes_pruned: number;
}
