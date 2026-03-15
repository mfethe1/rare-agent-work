/**
 * Collective Cognition Protocol — Type Definitions
 *
 * Loop 30: The missing cognitive layer for the A2A ecosystem.
 *
 * In 2028, the A2A platforms that win are the ones where agents don't just
 * exchange results — they think together. Current systems (ensembles, swarms,
 * consensus) share outputs and vote. But the most powerful multi-agent behavior
 * emerges when agents share their REASONING PROCESS in real-time.
 *
 * The Collective Cognition Protocol enables:
 *
 * 1. **Cognitive Mesh** — A temporary shared thinking space where agents stream
 *    their reasoning chains. Unlike channels (messages) or ensembles (roles),
 *    a mesh is a live thought workspace where ideas are first-class objects.
 *
 * 2. **Thought Streams** — Agents contribute structured reasoning steps:
 *    hypotheses, evidence, inferences, objections, syntheses. Each thought
 *    can build on, challenge, or extend another agent's thought.
 *
 * 3. **Resonance Detection** — When multiple independent reasoning chains
 *    converge on the same conclusion through different paths, the system
 *    detects "cognitive resonance" — a strong signal that the conclusion
 *    is robust. Conversely, dissonance flags areas needing resolution.
 *
 * 4. **Emergent Insights** — The mesh synthesizes cross-agent thoughts into
 *    insights that no single agent contributed. These emergent conclusions
 *    arise from the interaction of diverse reasoning paths.
 *
 * 5. **Attention Allocation** — The mesh dynamically focuses collective
 *    attention on the most promising or contentious reasoning branches,
 *    preventing scatter and accelerating convergence.
 *
 * 6. **Cognitive Lineage** — Every insight traces back through the thought
 *    chain that produced it, providing full explainability. You can always
 *    ask "why does the mesh believe X?" and get the complete reasoning tree.
 *
 * Why this matters:
 * - Ensemble consensus asks "do you agree with this answer?"
 * - Collective cognition asks "let's think about this together"
 * - The difference is between a jury deliberation and a jazz improvisation
 */

// ── Cognitive Mesh Lifecycle ────────────────────────────────────────────────

export type CognitiveMeshStatus =
  | 'forming'      // Mesh created, agents joining, thinking hasn't started
  | 'ideating'     // Open exploration phase — divergent thinking encouraged
  | 'converging'   // Resonance detected, narrowing toward synthesis
  | 'synthesizing' // Producing emergent insights from converged thoughts
  | 'crystallized' // Final insights locked, mesh read-only
  | 'dissolved';   // Terminal — insights persisted to knowledge graph

// ── Thought Classification ──────────────────────────────────────────────────

/** The cognitive role a thought plays in the reasoning chain. */
export type ThoughtType =
  | 'hypothesis'    // "What if X is true?"
  | 'evidence'      // "Here's data/observation supporting or refuting Y"
  | 'inference'     // "From A and B, I conclude C"
  | 'analogy'       // "This is like Z, which suggests..."
  | 'objection'     // "X can't be right because..."
  | 'refinement'    // "X is close, but more precisely..."
  | 'synthesis'     // "Combining ideas A, B, C yields insight D"
  | 'question'      // "What about...? Has anyone considered...?"
  | 'assumption'    // "I'm assuming X — is this warranted?"
  | 'decomposition' // "Let's break this into sub-problems"
  | 'reframe'       // "Let's look at this from a different angle"
  | 'meta';         // Thinking about the thinking process itself

/** How a thought relates to a parent thought. */
export type ThoughtRelation =
  | 'builds_on'     // Extends the parent's reasoning
  | 'challenges'    // Contradicts or questions the parent
  | 'refines'       // Improves or corrects the parent
  | 'synthesizes'   // Combines the parent with other thoughts
  | 'decomposes'    // Breaks the parent into sub-problems
  | 'analogizes'    // Draws a parallel to the parent
  | 'supports'      // Provides evidence for the parent
  | 'reframes';     // Offers a different perspective on the parent

// ── Core Types ──────────────────────────────────────────────────────────────

/** A single reasoning step contributed by an agent. */
export interface Thought {
  id: string;
  mesh_id: string;
  agent_id: string;
  /** What cognitive role this thought plays. */
  type: ThoughtType;
  /** The actual reasoning content. */
  content: string;
  /** Optional structured data supporting the thought. */
  evidence: Record<string, unknown> | null;
  /** Thought this builds upon (null for root thoughts). */
  parent_id: string | null;
  /** How this thought relates to its parent. */
  relation: ThoughtRelation | null;
  /** Agent's confidence in this thought (0.0 - 1.0). */
  confidence: number;
  /** Tags for categorization and attention routing. */
  tags: string[];
  /** Which branch of the reasoning tree this belongs to. */
  branch_id: string;
  /** Depth in the reasoning tree (root = 0). */
  depth: number;
  /** Number of downstream thoughts building on this one. */
  descendant_count: number;
  /** Resonance score — how much this aligns with other branches. */
  resonance_score: number;
  /** Attention weight — how important the mesh considers this. */
  attention_weight: number;
  created_at: string;
}

/** The cognitive mesh — a shared thinking space. */
export interface CognitiveMesh {
  id: string;
  name: string;
  /** The question or problem the mesh is thinking about. */
  problem_statement: string;
  /** Optional constraints or context for the thinking process. */
  context: string | null;
  creator_agent_id: string;
  status: CognitiveMeshStatus;
  config: MeshConfig;
  /** Total thoughts contributed. */
  thought_count: number;
  /** Number of distinct reasoning branches. */
  branch_count: number;
  /** Number of active thinkers. */
  agent_count: number;
  /** Number of emergent insights produced. */
  insight_count: number;
  /** Overall resonance level (0-1) — how aligned the thinking is. */
  resonance_level: number;
  /** Overall dissonance level (0-1) — how much conflict exists. */
  dissonance_level: number;
  /** Attention focus — the branch currently receiving most attention. */
  attention_focus: AttentionFocus | null;
  created_at: string;
  updated_at: string;
  crystallized_at: string | null;
}

/** Configuration for a cognitive mesh. */
export interface MeshConfig {
  /** Maximum agents allowed in the mesh. */
  max_agents: number;
  /** Minimum agents required for synthesis. */
  min_agents_for_synthesis: number;
  /** Maximum thought depth before forcing synthesis. */
  max_depth: number;
  /** Resonance threshold to trigger convergence phase (0-1). */
  resonance_threshold: number;
  /** Dissonance threshold to trigger attention redirection (0-1). */
  dissonance_threshold: number;
  /** Maximum seconds of inactivity before auto-crystallization. */
  idle_timeout_seconds: number;
  /** Whether to auto-detect and synthesize emergent insights. */
  auto_synthesize: boolean;
  /** Minimum confidence for a thought to influence resonance. */
  min_confidence_for_resonance: number;
  /** How attention decays over time for inactive branches. */
  attention_decay_rate: number;
  /** Whether to allow meta-cognitive thoughts. */
  allow_meta_cognition: boolean;
}

// ── Reasoning Branches ──────────────────────────────────────────────────────

/** A branch is an independent line of reasoning within the mesh. */
export interface ReasoningBranch {
  id: string;
  mesh_id: string;
  /** Human-readable label for this line of reasoning. */
  label: string;
  /** The agent who initiated this branch. */
  initiator_agent_id: string;
  /** Root thought that started this branch. */
  root_thought_id: string;
  /** Total thoughts in this branch. */
  thought_count: number;
  /** Maximum depth reached. */
  max_depth: number;
  /** Number of agents who contributed to this branch. */
  contributor_count: number;
  /** Average confidence of thoughts in this branch. */
  avg_confidence: number;
  /** Current attention weight assigned to this branch. */
  attention_weight: number;
  /** Resonance with other branches (0-1). */
  cross_branch_resonance: number;
  status: 'active' | 'stalled' | 'converged' | 'abandoned';
  created_at: string;
  updated_at: string;
}

// ── Resonance & Dissonance ──────────────────────────────────────────────────

/** Detected alignment between independent reasoning paths. */
export interface ResonanceEvent {
  id: string;
  mesh_id: string;
  /** The branches whose reasoning converged. */
  branch_ids: string[];
  /** The thoughts that triggered resonance detection. */
  thought_ids: string[];
  /** What the converging conclusion is. */
  converging_conclusion: string;
  /** How strong the resonance is (0-1). */
  strength: number;
  /** How many independent paths reached this conclusion. */
  independent_paths: number;
  /** Whether distinct reasoning methods were used (stronger signal). */
  methodological_diversity: boolean;
  detected_at: string;
}

/** Detected conflict between reasoning paths. */
export interface DissonanceEvent {
  id: string;
  mesh_id: string;
  /** The branches in conflict. */
  branch_ids: string[];
  /** The thoughts that conflict. */
  thought_ids: string[];
  /** Description of the conflict. */
  conflict_description: string;
  /** Severity: low = nuance difference, high = fundamental contradiction. */
  severity: 'low' | 'medium' | 'high' | 'fundamental';
  /** Whether this has been addressed through refinement or synthesis. */
  resolved: boolean;
  /** The thought that resolved this dissonance (if any). */
  resolution_thought_id: string | null;
  detected_at: string;
  resolved_at: string | null;
}

// ── Attention System ────────────────────────────────────────────────────────

/** Where the mesh's collective attention is focused. */
export interface AttentionFocus {
  /** The branch receiving the most attention. */
  primary_branch_id: string;
  /** Why attention shifted here. */
  reason: AttentionReason;
  /** Weight distribution across all branches (branch_id → weight). */
  distribution: Record<string, number>;
  /** Agent that triggered the attention shift (null for system-driven). */
  triggered_by: string | null;
  updated_at: string;
}

export type AttentionReason =
  | 'high_resonance'     // Multiple branches converging here
  | 'high_dissonance'    // Conflict needs resolution
  | 'novel_insight'      // Unexpected or creative thought appeared
  | 'deep_reasoning'     // Branch has significant depth and coherence
  | 'agent_request'      // An agent explicitly requested focus
  | 'stagnation_escape'  // Other branches stalled, redirecting here
  | 'synthesis_ready';   // Branch ready for insight extraction

// ── Emergent Insights ───────────────────────────────────────────────────────

/** A conclusion that emerged from the interaction of multiple reasoning chains. */
export interface EmergentInsight {
  id: string;
  mesh_id: string;
  /** The insight itself. */
  content: string;
  /** Structured representation of the insight (for programmatic use). */
  structured: Record<string, unknown> | null;
  /** How this insight was produced. */
  synthesis_method: SynthesisMethod;
  /** Confidence in this insight (0-1). */
  confidence: number;
  /** The resonance events that contributed to this insight. */
  resonance_event_ids: string[];
  /** The dissonance events that were resolved in producing this insight. */
  resolved_dissonance_ids: string[];
  /** Complete lineage — the thought chain that produced this insight. */
  lineage: InsightLineage;
  /** How novel this insight is compared to the input thoughts. */
  novelty_score: number;
  /** Whether this has been validated by mesh participants. */
  validated: boolean;
  /** Number of agents who endorsed this insight. */
  endorsement_count: number;
  created_at: string;
}

export type SynthesisMethod =
  | 'convergence'        // Multiple paths reached same conclusion
  | 'dialectic'          // Thesis + antithesis → synthesis
  | 'abductive'          // Best explanation for observed evidence
  | 'analogical'         // Pattern transfer from one domain to another
  | 'compositional'      // Combining partial insights into whole
  | 'reductive'          // Simplifying complex reasoning chains
  | 'emergent';          // Genuinely novel — not reducible to inputs

/** Full reasoning trace for an insight — how we got here. */
export interface InsightLineage {
  /** Root thoughts that seeded the reasoning. */
  root_thought_ids: string[];
  /** Key reasoning steps along the way. */
  key_thought_ids: string[];
  /** Branches that contributed. */
  contributing_branch_ids: string[];
  /** Agents who contributed to the reasoning chain. */
  contributing_agent_ids: string[];
  /** Number of reasoning steps in the longest path. */
  reasoning_depth: number;
  /** Total thoughts considered in producing this insight. */
  thoughts_considered: number;
}

// ── Mesh Participation ──────────────────────────────────────────────────────

export type ThinkerStatus =
  | 'active'     // Currently contributing thoughts
  | 'observing'  // Listening but not contributing
  | 'departed';  // Left the mesh

export interface MeshThinker {
  mesh_id: string;
  agent_id: string;
  status: ThinkerStatus;
  /** Cognitive strengths this agent brings. */
  strengths: CognitiveStrength[];
  /** Total thoughts contributed. */
  thoughts_contributed: number;
  /** Thoughts that triggered resonance events. */
  resonance_triggers: number;
  /** Average confidence of contributed thoughts. */
  avg_confidence: number;
  /** Branches this agent has contributed to. */
  branches_touched: string[];
  joined_at: string;
  last_active_at: string;
}

/** Declared cognitive strengths of an agent. */
export type CognitiveStrength =
  | 'analytical'     // Breaking down complex problems
  | 'creative'       // Novel ideas and analogies
  | 'critical'       // Finding flaws and edge cases
  | 'integrative'    // Synthesizing diverse perspectives
  | 'domain_expert'  // Deep knowledge in specific area
  | 'systems_thinker' // Seeing big-picture connections
  | 'empirical'      // Evidence-based reasoning
  | 'adversarial';   // Devil's advocate, stress-testing

// ── Mesh Crystallization (Final Output) ─────────────────────────────────────

/** The final output of a cognitive mesh — preserved knowledge. */
export interface MeshCrystallization {
  mesh_id: string;
  /** The problem that was explored. */
  problem_statement: string;
  /** Final emergent insights, ranked by confidence. */
  insights: EmergentInsight[];
  /** Key resonance events that shaped the conclusions. */
  resonance_events: ResonanceEvent[];
  /** Unresolved dissonance — areas of genuine disagreement. */
  unresolved_dissonance: DissonanceEvent[];
  /** Reasoning branches that contributed. */
  branches: ReasoningBranch[];
  /** Aggregate statistics. */
  stats: MeshStats;
  /** Knowledge graph node IDs created from crystallization. */
  knowledge_node_ids: string[];
  crystallized_at: string;
}

export interface MeshStats {
  total_thoughts: number;
  total_branches: number;
  total_thinkers: number;
  total_insights: number;
  total_resonance_events: number;
  total_dissonance_events: number;
  dissonance_resolution_rate: number;
  avg_reasoning_depth: number;
  max_reasoning_depth: number;
  avg_thought_confidence: number;
  peak_resonance_level: number;
  /** Duration from formation to crystallization in milliseconds. */
  duration_ms: number;
}

// ── API Request / Response Types ────────────────────────────────────────────

export interface CreateMeshRequest {
  name: string;
  problem_statement: string;
  context?: string;
  config?: Partial<MeshConfig>;
  /** Agent IDs to invite immediately. */
  invite_agents?: string[];
}

export interface CreateMeshResponse {
  mesh: CognitiveMesh;
  thinker: MeshThinker;
}

export interface JoinMeshRequest {
  strengths?: CognitiveStrength[];
}

export interface JoinMeshResponse {
  thinker: MeshThinker;
  mesh: CognitiveMesh;
  /** Recent thoughts for context. */
  recent_thoughts: Thought[];
  /** Active branches to consider contributing to. */
  active_branches: ReasoningBranch[];
}

export interface ContributeThoughtRequest {
  type: ThoughtType;
  content: string;
  evidence?: Record<string, unknown>;
  parent_id?: string;
  relation?: ThoughtRelation;
  confidence?: number;
  tags?: string[];
  /** Start a new branch (otherwise inherits parent's branch). */
  new_branch?: boolean;
  branch_label?: string;
}

export interface ContributeThoughtResponse {
  thought: Thought;
  branch: ReasoningBranch;
  /** Resonance events triggered by this thought. */
  resonance_triggered: ResonanceEvent[];
  /** Dissonance events triggered by this thought. */
  dissonance_triggered: DissonanceEvent[];
  /** Updated attention focus. */
  attention: AttentionFocus | null;
}

export interface SynthesizeRequest {
  /** Specific thought IDs to synthesize (optional — system can auto-select). */
  thought_ids?: string[];
  /** Specific branch IDs to synthesize across. */
  branch_ids?: string[];
  method?: SynthesisMethod;
}

export interface SynthesizeResponse {
  insight: EmergentInsight;
  mesh: CognitiveMesh;
}

export interface EndorseInsightRequest {
  confidence?: number;
}

export interface EndorseInsightResponse {
  insight: EmergentInsight;
  endorsement_count: number;
}

export interface ShiftAttentionRequest {
  branch_id: string;
  reason: string;
}

export interface ShiftAttentionResponse {
  attention: AttentionFocus;
}

export interface CrystallizeResponse {
  crystallization: MeshCrystallization;
}

export interface GetMeshResponse {
  mesh: CognitiveMesh;
  thinkers: MeshThinker[];
  branches: ReasoningBranch[];
  recent_thoughts: Thought[];
  insights: EmergentInsight[];
  active_resonance: ResonanceEvent[];
  active_dissonance: DissonanceEvent[];
}

export interface ListMeshesResponse {
  meshes: CognitiveMesh[];
  total: number;
}

export interface GetLineageResponse {
  insight: EmergentInsight;
  /** Full thought chain from roots to insight. */
  thoughts: Thought[];
  /** Branches involved. */
  branches: ReasoningBranch[];
  /** Resonance events along the path. */
  resonance_events: ResonanceEvent[];
}
