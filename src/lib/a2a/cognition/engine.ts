/**
 * Collective Cognition Protocol — Core Engine
 *
 * Enables agents to form shared thinking spaces (cognitive meshes) where they
 * stream reasoning chains in real-time, build on each other's thoughts, and
 * produce emergent insights through genuine collaborative cognition.
 *
 * Loop 30: The "prefrontal cortex" of the A2A ecosystem — not just
 * coordination (swarm), not just voting (consensus), but thinking together.
 *
 * Key algorithms:
 * - Resonance detection via semantic convergence scoring across branches
 * - Dissonance detection via contradiction analysis between thought pairs
 * - Attention allocation via weighted scoring of branch activity + resonance
 * - Insight synthesis via lineage tracing and cross-branch composition
 * - Cognitive diversity optimization via strength-based thinker distribution
 */

import { randomUUID } from 'crypto';
import type {
  AttentionFocus,
  AttentionReason,
  CognitiveMesh,
  CognitiveMeshStatus,
  CognitiveStrength,
  ContributeThoughtRequest,
  ContributeThoughtResponse,
  CreateMeshRequest,
  CreateMeshResponse,
  CrystallizeResponse,
  DissonanceEvent,
  EmergentInsight,
  EndorseInsightResponse,
  GetLineageResponse,
  GetMeshResponse,
  InsightLineage,
  JoinMeshResponse,
  ListMeshesResponse,
  MeshConfig,
  MeshCrystallization,
  MeshStats,
  MeshThinker,
  ReasoningBranch,
  ResonanceEvent,
  ShiftAttentionResponse,
  SynthesisMethod,
  SynthesizeResponse,
  Thought,
  ThoughtRelation,
  ThoughtType,
} from './types';

// ── In-Memory Stores (production: Supabase tables) ──────────────────────────

const meshes = new Map<string, CognitiveMesh>();
const thoughts = new Map<string, Thought>();
const branches = new Map<string, ReasoningBranch>();
const thinkers = new Map<string, MeshThinker>(); // key: `${mesh_id}:${agent_id}`
const resonanceEvents = new Map<string, ResonanceEvent>();
const dissonanceEvents = new Map<string, DissonanceEvent>();
const insights = new Map<string, EmergentInsight>();

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: MeshConfig = {
  max_agents: 20,
  min_agents_for_synthesis: 2,
  max_depth: 30,
  resonance_threshold: 0.6,
  dissonance_threshold: 0.7,
  idle_timeout_seconds: 3600,
  auto_synthesize: true,
  min_confidence_for_resonance: 0.5,
  attention_decay_rate: 0.05,
  allow_meta_cognition: true,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function getMeshThoughts(meshId: string): Thought[] {
  return Array.from(thoughts.values()).filter((t) => t.mesh_id === meshId);
}

function getMeshBranches(meshId: string): ReasoningBranch[] {
  return Array.from(branches.values()).filter((b) => b.mesh_id === meshId);
}

function getMeshThinkers(meshId: string): MeshThinker[] {
  return Array.from(thinkers.values()).filter((t) => t.mesh_id === meshId);
}

function getMeshInsights(meshId: string): EmergentInsight[] {
  return Array.from(insights.values()).filter((i) => i.mesh_id === meshId);
}

function getMeshResonance(meshId: string): ResonanceEvent[] {
  return Array.from(resonanceEvents.values()).filter((r) => r.mesh_id === meshId);
}

function getMeshDissonance(meshId: string): DissonanceEvent[] {
  return Array.from(dissonanceEvents.values()).filter((d) => d.mesh_id === meshId);
}

function getBranchThoughts(branchId: string): Thought[] {
  return Array.from(thoughts.values()).filter((t) => t.branch_id === branchId);
}

function getChildThoughts(parentId: string): Thought[] {
  return Array.from(thoughts.values()).filter((t) => t.parent_id === parentId);
}

function thinkerKey(meshId: string, agentId: string): string {
  return `${meshId}:${agentId}`;
}

// ── Semantic Similarity (simplified — production uses embeddings) ────────────

/**
 * Compute a rough semantic similarity between two text strings.
 * In production this would call an embedding model. Here we use
 * token overlap (Jaccard similarity) as a reasonable approximation.
 */
function semanticSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (let i = 0; i < tokensA.length; i++) {
    if (setB.has(tokensA[i])) intersection++;
  }
  // Deduplicate intersection count
  const intersectionTokens = tokensA.filter((t) => setB.has(t));
  const uniqueIntersection = new Set(intersectionTokens).size;
  return uniqueIntersection / (setA.size + setB.size - uniqueIntersection);
}

// ── Resonance Detection ─────────────────────────────────────────────────────

/**
 * Detect resonance between a new thought and thoughts in other branches.
 * Resonance occurs when independent reasoning chains converge on similar
 * conclusions through different paths.
 */
function detectResonance(
  mesh: CognitiveMesh,
  newThought: Thought,
): ResonanceEvent[] {
  const events: ResonanceEvent[] = [];
  const meshBranches = getMeshBranches(mesh.id);

  // Only check against other branches
  const otherBranches = meshBranches.filter((b) => b.id !== newThought.branch_id);

  for (const branch of otherBranches) {
    const branchThoughts = getBranchThoughts(branch.id);

    // Find thoughts in this branch with high semantic similarity
    for (const existing of branchThoughts) {
      // Skip low-confidence thoughts
      if (existing.confidence < mesh.config.min_confidence_for_resonance) continue;
      if (newThought.confidence < mesh.config.min_confidence_for_resonance) continue;

      const similarity = semanticSimilarity(newThought.content, existing.content);

      if (similarity >= mesh.config.resonance_threshold) {
        // Check if these are genuinely independent (different root thinkers)
        const newRoot = getRootThought(newThought);
        const existingRoot = getRootThought(existing);
        const isIndependent = newRoot?.agent_id !== existingRoot?.agent_id;

        const event: ResonanceEvent = {
          id: randomUUID(),
          mesh_id: mesh.id,
          branch_ids: [newThought.branch_id, branch.id],
          thought_ids: [newThought.id, existing.id],
          converging_conclusion: newThought.content,
          strength: similarity,
          independent_paths: isIndependent ? 2 : 1,
          methodological_diversity: newThought.type !== existing.type,
          detected_at: now(),
        };

        resonanceEvents.set(event.id, event);
        events.push(event);
      }
    }
  }

  return events;
}

function getRootThought(thought: Thought): Thought | null {
  let current = thought;
  while (current.parent_id) {
    const parent = thoughts.get(current.parent_id);
    if (!parent) break;
    current = parent;
  }
  return current;
}

// ── Dissonance Detection ────────────────────────────────────────────────────

/**
 * Detect dissonance (contradiction) between a new thought and existing thoughts.
 * Particularly relevant for 'objection' and 'challenges' relation types.
 */
function detectDissonance(
  mesh: CognitiveMesh,
  newThought: Thought,
): DissonanceEvent[] {
  const events: DissonanceEvent[] = [];

  // Thoughts that explicitly challenge are automatic dissonance
  if (newThought.relation === 'challenges' && newThought.parent_id) {
    const parent = thoughts.get(newThought.parent_id);
    if (parent && parent.branch_id !== newThought.branch_id) {
      const event: DissonanceEvent = {
        id: randomUUID(),
        mesh_id: mesh.id,
        branch_ids: [newThought.branch_id, parent.branch_id],
        thought_ids: [newThought.id, parent.id],
        conflict_description: `Challenge: "${newThought.content}" vs "${parent.content}"`,
        severity: newThought.confidence > 0.8 && parent.confidence > 0.8
          ? 'high' : 'medium',
        resolved: false,
        resolution_thought_id: null,
        detected_at: now(),
        resolved_at: null,
      };
      dissonanceEvents.set(event.id, event);
      events.push(event);
    }
  }

  // Also check for objection-type thoughts
  if (newThought.type === 'objection') {
    const meshThoughts = getMeshThoughts(mesh.id);
    for (const existing of meshThoughts) {
      if (existing.id === newThought.id) continue;
      if (existing.branch_id === newThought.branch_id) continue;

      // Check if this objection targets an existing hypothesis/inference
      if (
        (existing.type === 'hypothesis' || existing.type === 'inference') &&
        semanticSimilarity(newThought.content, existing.content) > 0.3
      ) {
        const event: DissonanceEvent = {
          id: randomUUID(),
          mesh_id: mesh.id,
          branch_ids: [newThought.branch_id, existing.branch_id],
          thought_ids: [newThought.id, existing.id],
          conflict_description: `Objection to ${existing.type}: "${newThought.content}"`,
          severity: 'medium',
          resolved: false,
          resolution_thought_id: null,
          detected_at: now(),
          resolved_at: null,
        };
        dissonanceEvents.set(event.id, event);
        events.push(event);
      }
    }
  }

  return events;
}

// ── Attention Allocation ────────────────────────────────────────────────────

/**
 * Recompute the mesh's attention focus based on current state.
 * Attention flows toward: high resonance, unresolved dissonance,
 * novel insights, and deep reasoning chains.
 */
function recomputeAttention(mesh: CognitiveMesh): AttentionFocus | null {
  const meshBranches = getMeshBranches(mesh.id);
  if (meshBranches.length === 0) return null;

  const distribution: Record<string, number> = {};
  let maxScore = -1;
  let primaryBranchId = meshBranches[0].id;
  let primaryReason: AttentionReason = 'deep_reasoning';

  for (const branch of meshBranches) {
    if (branch.status === 'abandoned') {
      distribution[branch.id] = 0;
      continue;
    }

    // Score components
    const resonanceBoost = branch.cross_branch_resonance * 3;
    const depthBoost = Math.min(branch.max_depth / 10, 1) * 2;
    const activityBoost = branch.thought_count > 0 ? 1 : 0;
    const diversityBoost = branch.contributor_count > 1 ? 1.5 : 0;

    // Check for unresolved dissonance on this branch
    const branchDissonance = getMeshDissonance(mesh.id).filter(
      (d) => !d.resolved && d.branch_ids.includes(branch.id),
    );
    const dissonanceBoost = branchDissonance.length * 2;

    const score = resonanceBoost + depthBoost + activityBoost +
      diversityBoost + dissonanceBoost;
    distribution[branch.id] = score;

    if (score > maxScore) {
      maxScore = score;
      primaryBranchId = branch.id;
      if (dissonanceBoost > resonanceBoost) {
        primaryReason = 'high_dissonance';
      } else if (resonanceBoost > 2) {
        primaryReason = 'high_resonance';
      } else if (depthBoost > 1.5) {
        primaryReason = 'deep_reasoning';
      }
    }
  }

  // Normalize distribution
  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const key of Object.keys(distribution)) {
      distribution[key] = Math.round((distribution[key] / total) * 1000) / 1000;
    }
  }

  const focus: AttentionFocus = {
    primary_branch_id: primaryBranchId,
    reason: primaryReason,
    distribution,
    triggered_by: null,
    updated_at: now(),
  };

  return focus;
}

// ── Mesh-Level Metrics ──────────────────────────────────────────────────────

function computeResonanceLevel(meshId: string): number {
  const events = getMeshResonance(meshId);
  if (events.length === 0) return 0;
  const avgStrength = events.reduce((s, e) => s + e.strength, 0) / events.length;
  const branchCount = getMeshBranches(meshId).length;
  // More resonance events across more branches = higher level
  const coverage = Math.min(events.length / Math.max(branchCount, 1), 1);
  return Math.round(avgStrength * coverage * 1000) / 1000;
}

function computeDissonanceLevel(meshId: string): number {
  const events = getMeshDissonance(meshId);
  const unresolved = events.filter((d) => !d.resolved);
  if (unresolved.length === 0) return 0;
  const severityWeights: Record<string, number> = {
    low: 0.25, medium: 0.5, high: 0.75, fundamental: 1.0,
  };
  const weightedSum = unresolved.reduce(
    (s, d) => s + (severityWeights[d.severity] ?? 0.5), 0,
  );
  return Math.min(Math.round((weightedSum / Math.max(events.length, 1)) * 1000) / 1000, 1);
}

function shouldTransitionToConverging(mesh: CognitiveMesh): boolean {
  return (
    mesh.status === 'ideating' &&
    mesh.resonance_level >= mesh.config.resonance_threshold &&
    mesh.thought_count >= mesh.config.min_agents_for_synthesis * 2
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new cognitive mesh — a shared thinking space for agents.
 */
export function createMesh(
  agentId: string,
  req: CreateMeshRequest,
): CreateMeshResponse {
  const config: MeshConfig = { ...DEFAULT_CONFIG, ...req.config };
  const meshId = randomUUID();

  const mesh: CognitiveMesh = {
    id: meshId,
    name: req.name,
    problem_statement: req.problem_statement,
    context: req.context ?? null,
    creator_agent_id: agentId,
    status: 'forming',
    config,
    thought_count: 0,
    branch_count: 0,
    agent_count: 1,
    insight_count: 0,
    resonance_level: 0,
    dissonance_level: 0,
    attention_focus: null,
    created_at: now(),
    updated_at: now(),
    crystallized_at: null,
  };

  meshes.set(meshId, mesh);

  const thinker: MeshThinker = {
    mesh_id: meshId,
    agent_id: agentId,
    status: 'active',
    strengths: [],
    thoughts_contributed: 0,
    resonance_triggers: 0,
    avg_confidence: 0,
    branches_touched: [],
    joined_at: now(),
    last_active_at: now(),
  };

  thinkers.set(thinkerKey(meshId, agentId), thinker);

  return { mesh, thinker };
}

/**
 * Join an existing cognitive mesh as a thinker.
 */
export function joinMesh(
  meshId: string,
  agentId: string,
  strengths: CognitiveStrength[] = [],
): JoinMeshResponse {
  const mesh = meshes.get(meshId);
  if (!mesh) throw new Error(`Mesh ${meshId} not found`);
  if (mesh.status === 'dissolved' || mesh.status === 'crystallized') {
    throw new Error(`Mesh ${meshId} is ${mesh.status} and cannot accept new thinkers`);
  }
  if (mesh.agent_count >= mesh.config.max_agents) {
    throw new Error(`Mesh ${meshId} is at capacity (${mesh.config.max_agents} agents)`);
  }

  const key = thinkerKey(meshId, agentId);
  if (thinkers.has(key)) {
    throw new Error(`Agent ${agentId} is already in mesh ${meshId}`);
  }

  const thinker: MeshThinker = {
    mesh_id: meshId,
    agent_id: agentId,
    status: 'active',
    strengths,
    thoughts_contributed: 0,
    resonance_triggers: 0,
    avg_confidence: 0,
    branches_touched: [],
    joined_at: now(),
    last_active_at: now(),
  };

  thinkers.set(key, thinker);
  mesh.agent_count++;
  mesh.updated_at = now();

  // Transition to ideating if we have enough agents
  if (mesh.status === 'forming' && mesh.agent_count >= mesh.config.min_agents_for_synthesis) {
    mesh.status = 'ideating';
  }

  const recentThoughts = getMeshThoughts(meshId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);

  const activeBranches = getMeshBranches(meshId)
    .filter((b) => b.status === 'active');

  return { thinker, mesh, recent_thoughts: recentThoughts, active_branches: activeBranches };
}

/**
 * Contribute a thought to the cognitive mesh.
 * This is the core operation — an agent adds a reasoning step.
 */
export function contributeThought(
  meshId: string,
  agentId: string,
  req: ContributeThoughtRequest,
): ContributeThoughtResponse {
  const mesh = meshes.get(meshId);
  if (!mesh) throw new Error(`Mesh ${meshId} not found`);
  if (mesh.status === 'crystallized' || mesh.status === 'dissolved') {
    throw new Error(`Mesh ${meshId} is ${mesh.status} — no new thoughts accepted`);
  }

  // Validate meta-cognition permission
  if (req.type === 'meta' && !mesh.config.allow_meta_cognition) {
    throw new Error('Meta-cognitive thoughts are not allowed in this mesh');
  }

  const key = thinkerKey(meshId, agentId);
  const thinker = thinkers.get(key);
  if (!thinker || thinker.status !== 'active') {
    throw new Error(`Agent ${agentId} is not an active thinker in mesh ${meshId}`);
  }

  // Resolve branch
  let branchId: string;
  let branch: ReasoningBranch;

  if (req.new_branch) {
    // Create a new reasoning branch
    branchId = randomUUID();
    branch = {
      id: branchId,
      mesh_id: meshId,
      label: req.branch_label ?? 'Unnamed branch',
      initiator_agent_id: agentId,
      root_thought_id: '', // Will be set after thought creation
      thought_count: 0,
      max_depth: 0,
      contributor_count: 1,
      avg_confidence: 0,
      attention_weight: 0,
      cross_branch_resonance: 0,
      status: 'active',
      created_at: now(),
      updated_at: now(),
    };
    branches.set(branchId, branch);
    mesh.branch_count++;
  } else if (req.parent_id) {
    // Inherit parent's branch
    const parent = thoughts.get(req.parent_id);
    if (!parent) throw new Error(`Parent thought ${req.parent_id} not found`);
    if (parent.mesh_id !== meshId) throw new Error('Parent thought belongs to a different mesh');
    branchId = parent.branch_id;
    branch = branches.get(branchId)!;
    if (!branch) throw new Error(`Branch ${branchId} not found`);
  } else {
    // Root thought without explicit new_branch — create one implicitly
    branchId = randomUUID();
    branch = {
      id: branchId,
      mesh_id: meshId,
      label: req.content.slice(0, 80),
      initiator_agent_id: agentId,
      root_thought_id: '',
      thought_count: 0,
      max_depth: 0,
      contributor_count: 1,
      avg_confidence: 0,
      attention_weight: 0,
      cross_branch_resonance: 0,
      status: 'active',
      created_at: now(),
      updated_at: now(),
    };
    branches.set(branchId, branch);
    mesh.branch_count++;
  }

  // Compute depth
  let depth = 0;
  if (req.parent_id) {
    const parent = thoughts.get(req.parent_id);
    depth = parent ? parent.depth + 1 : 0;
  }

  if (depth >= mesh.config.max_depth) {
    throw new Error(
      `Maximum reasoning depth (${mesh.config.max_depth}) reached on this branch. ` +
      'Consider synthesizing existing thoughts or starting a new branch.',
    );
  }

  const confidence = req.confidence ?? 0.7;
  const thoughtId = randomUUID();

  const thought: Thought = {
    id: thoughtId,
    mesh_id: meshId,
    agent_id: agentId,
    type: req.type,
    content: req.content,
    evidence: req.evidence ?? null,
    parent_id: req.parent_id ?? null,
    relation: req.relation ?? null,
    confidence,
    tags: req.tags ?? [],
    branch_id: branchId,
    depth,
    descendant_count: 0,
    resonance_score: 0,
    attention_weight: 0,
    created_at: now(),
  };

  thoughts.set(thoughtId, thought);

  // Update branch root if needed
  if (!branch.root_thought_id) {
    branch.root_thought_id = thoughtId;
  }

  // Update parent's descendant count
  if (req.parent_id) {
    let current = thoughts.get(req.parent_id);
    while (current) {
      current.descendant_count++;
      current = current.parent_id ? thoughts.get(current.parent_id) ?? null : null;
    }
  }

  // Update branch stats
  branch.thought_count++;
  branch.max_depth = Math.max(branch.max_depth, depth);
  const branchThoughts = getBranchThoughts(branchId);
  branch.avg_confidence =
    branchThoughts.reduce((s, t) => s + t.confidence, 0) / branchThoughts.length;

  // Track branch contributors
  const contributors = new Set(branchThoughts.map((t) => t.agent_id));
  branch.contributor_count = contributors.size;
  branch.updated_at = now();

  // Update thinker stats
  thinker.thoughts_contributed++;
  thinker.avg_confidence =
    (thinker.avg_confidence * (thinker.thoughts_contributed - 1) + confidence) /
    thinker.thoughts_contributed;
  if (!thinker.branches_touched.includes(branchId)) {
    thinker.branches_touched.push(branchId);
  }
  thinker.last_active_at = now();

  // Update mesh counters
  mesh.thought_count++;
  mesh.updated_at = now();

  // ── Resonance & Dissonance Detection ──────────────────────────────────
  const resonanceTriggered = detectResonance(mesh, thought);
  const dissonanceTriggered = detectDissonance(mesh, thought);

  // Update thinker resonance triggers
  if (resonanceTriggered.length > 0) {
    thinker.resonance_triggers += resonanceTriggered.length;
  }

  // Update branch cross-resonance
  for (const event of resonanceTriggered) {
    for (const bid of event.branch_ids) {
      const b = branches.get(bid);
      if (b) {
        b.cross_branch_resonance = Math.min(
          b.cross_branch_resonance + event.strength * 0.1, 1,
        );
      }
    }
    // Update thought resonance scores
    for (const tid of event.thought_ids) {
      const t = thoughts.get(tid);
      if (t) {
        t.resonance_score = Math.min(t.resonance_score + event.strength, 1);
      }
    }
  }

  // Check for dissonance resolution
  if (thought.type === 'synthesis' || thought.type === 'refinement') {
    const unresolvedDissonance = getMeshDissonance(meshId).filter((d) => !d.resolved);
    for (const d of unresolvedDissonance) {
      // If this thought references both conflicting thoughts' content
      const conflictingThoughts = d.thought_ids.map((id) => thoughts.get(id)).filter(Boolean);
      const addressesConflict = conflictingThoughts.some(
        (ct) => ct && semanticSimilarity(thought.content, ct.content) > 0.3,
      );
      if (addressesConflict) {
        d.resolved = true;
        d.resolution_thought_id = thoughtId;
        d.resolved_at = now();
      }
    }
  }

  // Recompute mesh-level metrics
  mesh.resonance_level = computeResonanceLevel(meshId);
  mesh.dissonance_level = computeDissonanceLevel(meshId);

  // Check for phase transition
  if (shouldTransitionToConverging(mesh)) {
    mesh.status = 'converging';
  }

  // Recompute attention
  const attention = recomputeAttention(mesh);
  mesh.attention_focus = attention;

  return {
    thought,
    branch,
    resonance_triggered: resonanceTriggered,
    dissonance_triggered: dissonanceTriggered,
    attention,
  };
}

/**
 * Synthesize an emergent insight from converging thoughts.
 * This is where the magic happens — cross-pollination of reasoning chains
 * produces conclusions that no individual agent could have reached.
 */
export function synthesizeInsight(
  meshId: string,
  agentId: string,
  thoughtIds?: string[],
  branchIds?: string[],
  method?: SynthesisMethod,
): SynthesizeResponse {
  const mesh = meshes.get(meshId);
  if (!mesh) throw new Error(`Mesh ${meshId} not found`);

  const key = thinkerKey(meshId, agentId);
  const thinker = thinkers.get(key);
  if (!thinker || thinker.status !== 'active') {
    throw new Error(`Agent ${agentId} is not an active thinker in mesh ${meshId}`);
  }

  // Gather source thoughts
  let sourceThoughts: Thought[] = [];

  if (thoughtIds && thoughtIds.length > 0) {
    sourceThoughts = thoughtIds
      .map((id) => thoughts.get(id))
      .filter((t): t is Thought => t !== undefined && t.mesh_id === meshId);
  }

  if (branchIds && branchIds.length > 0) {
    for (const bid of branchIds) {
      const branchThoughts = getBranchThoughts(bid)
        .filter((t) => t.mesh_id === meshId)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5); // Top 5 per branch
      sourceThoughts.push(...branchThoughts);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  sourceThoughts = sourceThoughts.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  if (sourceThoughts.length < 2) {
    throw new Error('Synthesis requires at least 2 source thoughts');
  }

  // Determine synthesis method
  const synthMethod = method ?? determineSynthesisMethod(sourceThoughts, meshId);

  // Compute lineage
  const contributingBranchIds = Array.from(new Set(sourceThoughts.map((t) => t.branch_id)));
  const contributingAgentIds = Array.from(new Set(sourceThoughts.map((t) => t.agent_id)));

  // Trace back to roots
  const rootIds = new Set<string>();
  for (const t of sourceThoughts) {
    const root = getRootThought(t);
    if (root) rootIds.add(root.id);
  }

  const lineage: InsightLineage = {
    root_thought_ids: Array.from(rootIds),
    key_thought_ids: sourceThoughts.map((t) => t.id),
    contributing_branch_ids: contributingBranchIds,
    contributing_agent_ids: contributingAgentIds,
    reasoning_depth: Math.max(...sourceThoughts.map((t) => t.depth)),
    thoughts_considered: sourceThoughts.length,
  };

  // Aggregate confidence (geometric mean — penalizes low-confidence inputs)
  const confidenceProduct = sourceThoughts.reduce((p, t) => p * t.confidence, 1);
  const avgConfidence = Math.pow(confidenceProduct, 1 / sourceThoughts.length);

  // Compute novelty — how different is the synthesis from its inputs
  const inputContents = sourceThoughts.map((t) => t.content).join(' ');
  const syntheticContent = `Synthesis of ${sourceThoughts.length} thoughts across ` +
    `${contributingBranchIds.length} branches by ${contributingAgentIds.length} agents`;
  const novelty = 1 - semanticSimilarity(syntheticContent, inputContents);

  // Find relevant resonance events
  const relevantResonance = getMeshResonance(meshId).filter((r) =>
    r.thought_ids.some((tid) => sourceThoughts.some((t) => t.id === tid)),
  );

  // Find resolved dissonance
  const resolvedDissonance = getMeshDissonance(meshId).filter(
    (d) => d.resolved && d.thought_ids.some((tid) => sourceThoughts.some((t) => t.id === tid)),
  );

  const insight: EmergentInsight = {
    id: randomUUID(),
    mesh_id: meshId,
    content: syntheticContent,
    structured: {
      source_thought_count: sourceThoughts.length,
      branch_count: contributingBranchIds.length,
      agent_count: contributingAgentIds.length,
      method: synthMethod,
      source_types: Array.from(new Set(sourceThoughts.map((t) => t.type))),
    },
    synthesis_method: synthMethod,
    confidence: Math.round(avgConfidence * 1000) / 1000,
    resonance_event_ids: relevantResonance.map((r) => r.id),
    resolved_dissonance_ids: resolvedDissonance.map((d) => d.id),
    lineage,
    novelty_score: Math.round(novelty * 1000) / 1000,
    validated: false,
    endorsement_count: 0,
    created_at: now(),
  };

  insights.set(insight.id, insight);
  mesh.insight_count++;
  mesh.updated_at = now();

  // Transition to synthesizing if in converging phase
  if (mesh.status === 'converging') {
    mesh.status = 'synthesizing';
  }

  return { insight, mesh };
}

/**
 * Determine the best synthesis method based on the source thoughts.
 */
function determineSynthesisMethod(
  sourceThoughts: Thought[],
  meshId: string,
): SynthesisMethod {
  const types = new Set(sourceThoughts.map((t) => t.type));
  const branchIds = new Set(sourceThoughts.map((t) => t.branch_id));

  // If there are objections being synthesized with hypotheses → dialectic
  if (types.has('objection') && (types.has('hypothesis') || types.has('inference'))) {
    return 'dialectic';
  }

  // If there are analogies → analogical
  if (types.has('analogy')) {
    return 'analogical';
  }

  // If thoughts come from many branches with high resonance → convergence
  if (branchIds.size >= 3) {
    const resonance = getMeshResonance(meshId);
    const relevantResonance = resonance.filter((r) =>
      r.thought_ids.some((tid) => sourceThoughts.some((t) => t.id === tid)),
    );
    if (relevantResonance.length > 0) {
      return 'convergence';
    }
  }

  // If mostly evidence-based → abductive
  if (types.has('evidence')) {
    return 'abductive';
  }

  // Default to compositional
  return 'compositional';
}

/**
 * Endorse an emergent insight — increases its validation.
 */
export function endorseInsight(
  meshId: string,
  insightId: string,
  agentId: string,
  confidence?: number,
): EndorseInsightResponse {
  const insight = insights.get(insightId);
  if (!insight || insight.mesh_id !== meshId) {
    throw new Error(`Insight ${insightId} not found in mesh ${meshId}`);
  }

  const key = thinkerKey(meshId, agentId);
  const thinker = thinkers.get(key);
  if (!thinker) {
    throw new Error(`Agent ${agentId} is not in mesh ${meshId}`);
  }

  insight.endorsement_count++;

  // Update confidence based on endorsement
  if (confidence !== undefined) {
    insight.confidence = (insight.confidence + confidence) / 2;
  }

  // Mark as validated once enough endorsements
  const meshThinkerCount = getMeshThinkers(meshId).filter((t) => t.status === 'active').length;
  if (insight.endorsement_count >= Math.ceil(meshThinkerCount / 2)) {
    insight.validated = true;
  }

  return { insight, endorsement_count: insight.endorsement_count };
}

/**
 * Shift the mesh's collective attention to a specific branch.
 */
export function shiftAttention(
  meshId: string,
  agentId: string,
  branchId: string,
  reason: string,
): ShiftAttentionResponse {
  const mesh = meshes.get(meshId);
  if (!mesh) throw new Error(`Mesh ${meshId} not found`);

  const branch = branches.get(branchId);
  if (!branch || branch.mesh_id !== meshId) {
    throw new Error(`Branch ${branchId} not found in mesh ${meshId}`);
  }

  // Recompute base attention then boost the requested branch
  const attention = recomputeAttention(mesh) ?? {
    primary_branch_id: branchId,
    reason: 'agent_request' as AttentionReason,
    distribution: { [branchId]: 1 },
    triggered_by: agentId,
    updated_at: now(),
  };

  // Override to the requested branch
  attention.primary_branch_id = branchId;
  attention.reason = 'agent_request';
  attention.triggered_by = agentId;

  // Boost the branch in distribution
  if (attention.distribution[branchId] !== undefined) {
    attention.distribution[branchId] = Math.min(
      attention.distribution[branchId] + 0.3, 1,
    );
  }

  // Re-normalize
  const total = Object.values(attention.distribution).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const key of Object.keys(attention.distribution)) {
      attention.distribution[key] = Math.round(
        (attention.distribution[key] / total) * 1000,
      ) / 1000;
    }
  }

  mesh.attention_focus = attention;
  mesh.updated_at = now();

  return { attention };
}

/**
 * Crystallize the mesh — lock all insights and prepare final output.
 * After crystallization, no new thoughts are accepted.
 */
export function crystallizeMesh(
  meshId: string,
  agentId: string,
): CrystallizeResponse {
  const mesh = meshes.get(meshId);
  if (!mesh) throw new Error(`Mesh ${meshId} not found`);
  if (mesh.status === 'crystallized' || mesh.status === 'dissolved') {
    throw new Error(`Mesh ${meshId} is already ${mesh.status}`);
  }

  // Only creator or any thinker in synthesizing phase can crystallize
  if (mesh.status !== 'synthesizing' && agentId !== mesh.creator_agent_id) {
    throw new Error(
      'Only the mesh creator can crystallize before the synthesizing phase',
    );
  }

  mesh.status = 'crystallized';
  mesh.crystallized_at = now();
  mesh.updated_at = now();

  const meshInsights = getMeshInsights(meshId)
    .sort((a, b) => b.confidence - a.confidence);
  const meshResonance = getMeshResonance(meshId);
  const unresolvedDissonance = getMeshDissonance(meshId).filter((d) => !d.resolved);
  const meshBranches = getMeshBranches(meshId);
  const allThoughts = getMeshThoughts(meshId);
  const meshThinkerList = getMeshThinkers(meshId);

  const stats: MeshStats = {
    total_thoughts: allThoughts.length,
    total_branches: meshBranches.length,
    total_thinkers: meshThinkerList.length,
    total_insights: meshInsights.length,
    total_resonance_events: meshResonance.length,
    total_dissonance_events: getMeshDissonance(meshId).length,
    dissonance_resolution_rate: (() => {
      const all = getMeshDissonance(meshId);
      const resolved = all.filter((d) => d.resolved);
      return all.length > 0
        ? Math.round((resolved.length / all.length) * 1000) / 1000
        : 1;
    })(),
    avg_reasoning_depth:
      meshBranches.length > 0
        ? Math.round(
            (meshBranches.reduce((s, b) => s + b.max_depth, 0) / meshBranches.length) *
            100,
          ) / 100
        : 0,
    max_reasoning_depth: Math.max(...meshBranches.map((b) => b.max_depth), 0),
    avg_thought_confidence:
      allThoughts.length > 0
        ? Math.round(
            (allThoughts.reduce((s, t) => s + t.confidence, 0) / allThoughts.length) *
            1000,
          ) / 1000
        : 0,
    peak_resonance_level: Math.max(
      ...meshResonance.map((r) => r.strength),
      0,
    ),
    duration_ms: new Date(mesh.crystallized_at!).getTime() - new Date(mesh.created_at).getTime(),
  };

  const crystallization: MeshCrystallization = {
    mesh_id: meshId,
    problem_statement: mesh.problem_statement,
    insights: meshInsights,
    resonance_events: meshResonance,
    unresolved_dissonance: unresolvedDissonance,
    branches: meshBranches,
    stats,
    knowledge_node_ids: [], // Would be populated when persisting to knowledge graph
    crystallized_at: mesh.crystallized_at!,
  };

  return { crystallization };
}

/**
 * Get the full lineage of an insight — trace exactly how we got here.
 */
export function getInsightLineage(
  meshId: string,
  insightId: string,
): GetLineageResponse {
  const insight = insights.get(insightId);
  if (!insight || insight.mesh_id !== meshId) {
    throw new Error(`Insight ${insightId} not found in mesh ${meshId}`);
  }

  // Collect all thoughts in the lineage
  const lineageThoughts: Thought[] = [];
  const visited = new Set<string>();

  function collectLineage(thoughtId: string) {
    if (visited.has(thoughtId)) return;
    visited.add(thoughtId);
    const thought = thoughts.get(thoughtId);
    if (!thought) return;
    lineageThoughts.push(thought);
    if (thought.parent_id) {
      collectLineage(thought.parent_id);
    }
  }

  for (const tid of insight.lineage.key_thought_ids) {
    collectLineage(tid);
  }

  // Sort by depth for logical reading order
  lineageThoughts.sort((a, b) => a.depth - b.depth);

  const lineageBranches = insight.lineage.contributing_branch_ids
    .map((bid) => branches.get(bid))
    .filter((b): b is ReasoningBranch => b !== undefined);

  const resonance = insight.resonance_event_ids
    .map((rid) => resonanceEvents.get(rid))
    .filter((r): r is ResonanceEvent => r !== undefined);

  return {
    insight,
    thoughts: lineageThoughts,
    branches: lineageBranches,
    resonance_events: resonance,
  };
}

/**
 * Get full mesh state including all thinkers, branches, and recent activity.
 */
export function getMesh(meshId: string): GetMeshResponse {
  const mesh = meshes.get(meshId);
  if (!mesh) throw new Error(`Mesh ${meshId} not found`);

  const recentThoughts = getMeshThoughts(meshId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50);

  return {
    mesh,
    thinkers: getMeshThinkers(meshId),
    branches: getMeshBranches(meshId),
    recent_thoughts: recentThoughts,
    insights: getMeshInsights(meshId),
    active_resonance: getMeshResonance(meshId),
    active_dissonance: getMeshDissonance(meshId).filter((d) => !d.resolved),
  };
}

/**
 * List all cognitive meshes, optionally filtered by status.
 */
export function listMeshes(
  status?: CognitiveMeshStatus,
  limit: number = 50,
  offset: number = 0,
): ListMeshesResponse {
  let all = Array.from(meshes.values());
  if (status) {
    all = all.filter((m) => m.status === status);
  }
  all.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const total = all.length;
  const page = all.slice(offset, offset + limit);
  return { meshes: page, total };
}

/**
 * Dissolve a mesh — terminal state, preserving crystallization if available.
 */
export function dissolveMesh(meshId: string, agentId: string): void {
  const mesh = meshes.get(meshId);
  if (!mesh) throw new Error(`Mesh ${meshId} not found`);
  if (agentId !== mesh.creator_agent_id) {
    throw new Error('Only the mesh creator can dissolve it');
  }
  mesh.status = 'dissolved';
  mesh.updated_at = now();
}
