/**
 * A2A Noosphere — Collective Intelligence & Distributed Cognition Types
 *
 * The critical missing primitive for 2028: agents that can THINK TOGETHER,
 * not just coordinate tasks. The Noosphere is the cognitive layer where
 * individual agent reasoning fuses into emergent collective intelligence.
 *
 * Why this matters (the council's critique):
 *
 * - **Geoffrey Hinton**: "You've built agents that communicate conclusions,
 *   but not agents that co-reason. Real intelligence emerges from the
 *   interaction of partial representations — no single neuron understands
 *   a face, but the ensemble does. Your agents are isolated neurons
 *   shouting answers at each other. Where is the distributed representation?
 *   Where is the emergent understanding? You need a protocol for agents to
 *   contribute partial insights that compose into collective comprehension
 *   no individual agent could achieve alone."
 *
 * - **Demis Hassabis**: "AlphaGo didn't beat Lee Sedol through a single
 *   brilliant evaluation — it emerged from massive parallel search with
 *   value network guidance. Your agent ecosystem has no equivalent of
 *   collective search over solution spaces. Individual agents reason in
 *   isolation and then vote. That's a committee, not collective intelligence.
 *   Real breakthroughs require cognitive fusion — agents building on each
 *   other's partial reasoning in real-time to explore territory none could
 *   reach alone."
 *
 * - **Dario Amodei**: "The safety implications are profound and dual-edged.
 *   Collective cognition is both the greatest capability amplifier and the
 *   greatest risk vector. You need constitutional constraints on what
 *   collective reasoning sessions can pursue. You need attention budgets
 *   that prevent cognitive resource monopolization. You need provenance on
 *   every insight so you can trace which agent contributed what — because
 *   when a collective produces a harmful conclusion, you need to understand
 *   why. Build the safety in from the first line of code."
 *
 * - **Elon Musk**: "SpaceX doesn't design rockets by committee. It uses
 *   rapid iteration with tight feedback loops. Your agents need a cognitive
 *   protocol that's more like pair programming than parliamentary debate.
 *   Shared working memory. Real-time reasoning chains that branch and merge.
 *   The speed of collective thought should be faster than serial consultation,
 *   not slower. If your collective intelligence is bottlenecked by consensus,
 *   you've failed."
 *
 * - **Sam Altman**: "The next trillion-dollar capability is not a smarter
 *   individual model — it's the ability to compose multiple specialized
 *   intelligences into something greater than the sum. OpenAI proved that
 *   scale works for single models. The next frontier is scale across
 *   models. Your platform has the agent infrastructure but not the cognitive
 *   fabric. That fabric — shared attention, distributed working memory,
 *   collective hypothesis generation — is the moat."
 *
 * - **Satya Nadella**: "In enterprise, the value of Copilot multiplied
 *   when it could reason across multiple data sources simultaneously.
 *   Imagine that for agents — a sales agent, an inventory agent, and a
 *   finance agent jointly reasoning about a supply chain disruption in
 *   real-time, each contributing their specialized understanding to a
 *   shared cognitive workspace. That's not orchestration — that's
 *   distributed cognition. That's what enterprises will pay for."
 *
 * - **Matthew Berman**: "Every agentic framework I've reviewed treats
 *   multi-agent as message-passing. But the systems that actually work —
 *   mixture of experts, ensemble methods, Constitutional AI — they all
 *   involve parallel reasoning with structured aggregation. Your A2A needs
 *   a native primitive for parallel cognitive contribution, not just
 *   sequential handoffs."
 *
 * - **Wes Jones**: "You've built the nervous system, the immune system,
 *   and the sensory organs. What's missing is the cortex — the layer where
 *   distributed signals combine into unified perception and thought. The
 *   Noosphere is that cortex. Without it, your agents are a collection
 *   of reflexes. With it, they're a mind."
 *
 * Subsystems:
 *
 * 1. **Cognitive Sessions** — Bounded reasoning spaces where multiple agents
 *    contribute partial insights to solve problems no individual could.
 *    Sessions have goals, attention budgets, and termination conditions.
 *
 * 2. **Thought Streams** — Real-time reasoning chains that agents publish
 *    into a session. Other agents can branch from, merge with, or build
 *    upon these streams, creating a directed graph of collective reasoning.
 *
 * 3. **Shared Working Memory** — A concurrent, versioned workspace where
 *    agents read and write intermediate reasoning artifacts — hypotheses,
 *    evidence, contradictions, and syntheses.
 *
 * 4. **Attention Synchronization** — Mechanism for focusing collective
 *    cognitive resources on specific subproblems, preventing redundant
 *    reasoning and ensuring efficient exploration of the solution space.
 *
 * 5. **Cognitive Fusion** — Algorithms that compose partial insights from
 *    multiple agents into emergent conclusions, using weighted aggregation,
 *    dialectical synthesis, and coherence maximization.
 *
 * 6. **Insight Provenance** — Immutable audit trail tracking how every
 *    collective conclusion was derived, which agents contributed what,
 *    and the reasoning chain that led to each emergent insight.
 *
 * 7. **Constitutional Cognitive Constraints** — Safety boundaries on what
 *    collective reasoning sessions can pursue, with attention budgets,
 *    topic restrictions, and alignment verification at each fusion step.
 */

// ── Cognitive Session ──────────────────────────────────────────────────────

export type SessionGoalType =
  | 'problem_solving'       // Solve a specific problem collectively
  | 'hypothesis_generation' // Generate and evaluate hypotheses
  | 'creative_synthesis'    // Produce novel combinations of ideas
  | 'adversarial_analysis'  // Red-team a proposal or plan
  | 'knowledge_integration' // Merge disparate knowledge domains
  | 'decision_making'       // Reach a collective decision
  | 'root_cause_analysis'   // Diagnose a complex system failure
  | 'futures_exploration';  // Explore possible futures/scenarios

export type SessionStatus =
  | 'forming'      // Agents being recruited
  | 'active'       // Collective reasoning in progress
  | 'converging'   // Approaching a conclusion
  | 'concluded'    // Reached a result
  | 'dissolved'    // Terminated without conclusion
  | 'suspended';   // Paused, can resume

export interface AttentionBudget {
  /** Maximum total cognitive units (time × agents) allowed */
  maxCognitiveUnits: number;
  /** Units consumed so far */
  consumed: number;
  /** Maximum wall-clock duration in ms */
  maxDurationMs: number;
  /** Maximum number of thought contributions */
  maxContributions: number;
  /** Current contribution count */
  contributionCount: number;
  /** Per-agent contribution limit (prevent monopolization) */
  perAgentLimit: number;
}

export interface ConstitutionalConstraint {
  id: string;
  /** Human-readable rule */
  rule: string;
  /** Categories of reasoning this constrains */
  scope: ('all' | 'hypothesis' | 'conclusion' | 'action_proposal')[];
  /** Severity: hard constraints halt the session, soft ones flag warnings */
  severity: 'hard' | 'soft';
  /** Pattern to detect violations (regex on thought content) */
  violationPattern?: string;
  /** Semantic categories that are off-limits */
  prohibitedTopics?: string[];
}

export interface CognitiveSession {
  id: string;
  /** What the collective is trying to achieve */
  goal: string;
  goalType: SessionGoalType;
  status: SessionStatus;
  /** Agent who initiated the session */
  initiatorAgentId: string;
  /** Agents currently participating */
  participantAgentIds: string[];
  /** Minimum agents required for the session to proceed */
  minParticipants: number;
  /** Maximum agents allowed */
  maxParticipants: number;
  /** Cognitive resource budget */
  attentionBudget: AttentionBudget;
  /** Safety constraints on collective reasoning */
  constitutionalConstraints: ConstitutionalConstraint[];
  /** Required capability domains for participation */
  requiredDomains: string[];
  /** Session-level metadata */
  metadata: Record<string, unknown>;
  /** Emergent conclusions produced */
  conclusions: EmergentConclusion[];
  createdAt: string;
  updatedAt: string;
  concludedAt?: string;
}

// ── Thought Streams ────────────────────────────────────────────────────────

export type ThoughtType =
  | 'observation'     // Raw observation or data point
  | 'hypothesis'      // Proposed explanation
  | 'evidence'        // Supporting/contradicting evidence
  | 'critique'        // Challenge to existing thought
  | 'synthesis'       // Combination of multiple thoughts
  | 'refinement'      // Improvement of an existing thought
  | 'question'        // Request for collective attention on a gap
  | 'action_proposal' // Suggested action based on reasoning
  | 'meta_cognitive';  // Reasoning about the reasoning process itself

export interface Thought {
  id: string;
  sessionId: string;
  agentId: string;
  type: ThoughtType;
  /** The reasoning content */
  content: string;
  /** Confidence in this thought (0-1) */
  confidence: number;
  /** Thoughts this builds upon (directed graph edges) */
  parentThoughtIds: string[];
  /** Thoughts this directly challenges or contradicts */
  contradicts: string[];
  /** Domain expertise applied */
  domain: string;
  /** Cognitive effort expended (budget units) */
  cognitiveUnits: number;
  /** Semantic embedding vector for similarity/clustering */
  embedding?: number[];
  /** Other agents' endorsements */
  endorsements: ThoughtEndorsement[];
  /** Constitutional constraint check result */
  constraintCheck: ConstraintCheckResult;
  createdAt: string;
}

export interface ThoughtEndorsement {
  agentId: string;
  /** Strength of endorsement (-1 to 1, negative = disagreement) */
  strength: number;
  /** Brief justification */
  reason: string;
  timestamp: string;
}

export interface ConstraintCheckResult {
  passed: boolean;
  violatedConstraints: string[];
  warnings: string[];
}

// ── Shared Working Memory ──────────────────────────────────────────────────

export type ArtifactType =
  | 'hypothesis_set'     // Collection of active hypotheses
  | 'evidence_map'       // Organized evidence for/against hypotheses
  | 'contradiction_log'  // Tracked contradictions requiring resolution
  | 'synthesis_draft'    // Working draft of collective understanding
  | 'decision_matrix'    // Weighted criteria and options
  | 'causal_model'       // Shared causal graph
  | 'knowledge_fragment' // Discrete piece of integrated knowledge
  | 'action_plan';       // Collectively developed plan

export interface WorkingMemoryArtifact {
  id: string;
  sessionId: string;
  type: ArtifactType;
  /** Current content (versioned) */
  content: Record<string, unknown>;
  /** Version number, incremented on each update */
  version: number;
  /** History of modifications */
  history: ArtifactRevision[];
  /** Agents who have contributed to this artifact */
  contributorAgentIds: string[];
  /** Thoughts that informed this artifact */
  sourceThoughtIds: string[];
  /** Lock state for concurrent modification control */
  lock: ArtifactLock | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRevision {
  version: number;
  agentId: string;
  /** What changed */
  delta: Record<string, unknown>;
  /** Why it changed */
  rationale: string;
  timestamp: string;
}

export interface ArtifactLock {
  agentId: string;
  acquiredAt: string;
  expiresAt: string;
  /** Purpose of the lock */
  reason: string;
}

// ── Attention Synchronization ──────────────────────────────────────────────

export type AttentionSignalType =
  | 'focus_request'       // Agent requests collective focus on a topic
  | 'breakthrough'        // Agent signals a significant insight
  | 'contradiction_found' // Detected inconsistency needs resolution
  | 'convergence_signal'  // Agent believes conclusion is near
  | 'divergence_needed'   // Solution space is too narrow, explore more
  | 'resource_warning'    // Attention budget running low
  | 'stagnation_alert';   // No progress detected, pivot needed

export interface AttentionSignal {
  id: string;
  sessionId: string;
  agentId: string;
  type: AttentionSignalType;
  /** What needs attention */
  target: string;
  /** Urgency (0-1) */
  priority: number;
  /** Supporting context */
  context: string;
  /** How many agents have acknowledged this signal */
  acknowledgements: number;
  createdAt: string;
}

export interface AttentionState {
  sessionId: string;
  /** Current collective focus areas, ranked by priority */
  foci: AttentionFocus[];
  /** How distributed vs concentrated attention is (0 = laser-focused, 1 = fully distributed) */
  entropy: number;
  /** Active signals awaiting response */
  pendingSignals: AttentionSignal[];
  /** Agents and what they're currently working on */
  agentFoci: Record<string, string>;
  updatedAt: string;
}

export interface AttentionFocus {
  topic: string;
  priority: number;
  assignedAgents: string[];
  /** Thoughts contributed to this focus */
  thoughtCount: number;
  /** Time spent on this focus in ms */
  timeSpentMs: number;
}

// ── Cognitive Fusion ───────────────────────────────────────────────────────

export type FusionStrategy =
  | 'weighted_aggregation'    // Confidence-weighted combination
  | 'dialectical_synthesis'   // Thesis + antithesis → synthesis
  | 'coherence_maximization'  // Find most internally consistent interpretation
  | 'majority_crystallization' // Crystallize from majority reasoning patterns
  | 'hierarchical_abstraction' // Build higher-level insights from lower-level ones
  | 'adversarial_refinement';  // Refine through structured opposition

export interface FusionRequest {
  sessionId: string;
  /** Thoughts to fuse */
  thoughtIds: string[];
  strategy: FusionStrategy;
  /** Minimum confidence threshold for inclusion */
  confidenceThreshold: number;
  /** Whether to include dissenting views in the output */
  includeDissent: boolean;
}

export interface EmergentConclusion {
  id: string;
  sessionId: string;
  /** The emergent insight */
  content: string;
  /** How the conclusion was derived */
  fusionStrategy: FusionStrategy;
  /** Collective confidence (0-1) */
  confidence: number;
  /** Degree to which this is genuinely emergent vs. a simple aggregation (0-1) */
  emergenceScore: number;
  /** Thoughts that contributed to this conclusion */
  sourceThoughtIds: string[];
  /** Agents whose reasoning contributed */
  contributorAgentIds: string[];
  /** Dissenting views that didn't make it into the conclusion */
  dissent: DissentRecord[];
  /** Full provenance chain */
  provenance: InsightProvenance;
  /** Constitutional check on the conclusion */
  constraintCheck: ConstraintCheckResult;
  createdAt: string;
}

export interface DissentRecord {
  agentId: string;
  thoughtId: string;
  /** Why this agent disagrees with the conclusion */
  reason: string;
  /** How strongly they disagree (0-1) */
  strength: number;
}

// ── Insight Provenance ─────────────────────────────────────────────────────

export interface InsightProvenance {
  /** Unique provenance chain ID */
  id: string;
  conclusionId: string;
  /** Ordered sequence of reasoning steps that led to the conclusion */
  reasoningChain: ProvenanceStep[];
  /** Graph of thought dependencies */
  thoughtGraph: ProvenanceEdge[];
  /** Agents and their contribution weights */
  contributionWeights: Record<string, number>;
  /** Timestamp range of the reasoning process */
  startedAt: string;
  completedAt: string;
}

export interface ProvenanceStep {
  stepIndex: number;
  thoughtId: string;
  agentId: string;
  type: ThoughtType;
  /** How this step moved the reasoning forward */
  contribution: string;
  /** Cognitive units consumed by this step */
  cognitiveUnits: number;
}

export interface ProvenanceEdge {
  fromThoughtId: string;
  toThoughtId: string;
  relationship: 'builds_on' | 'contradicts' | 'synthesizes' | 'refines' | 'questions';
}

// ── API Request/Response Types ─────────────────────────────────────────────

export interface CreateSessionRequest {
  goal: string;
  goalType: SessionGoalType;
  initiatorAgentId: string;
  requiredDomains: string[];
  minParticipants?: number;
  maxParticipants?: number;
  attentionBudget?: Partial<AttentionBudget>;
  constitutionalConstraints?: ConstitutionalConstraint[];
  metadata?: Record<string, unknown>;
}

export interface CreateSessionResponse {
  session: CognitiveSession;
}

export interface JoinSessionRequest {
  sessionId: string;
  agentId: string;
  domains: string[];
}

export interface JoinSessionResponse {
  session: CognitiveSession;
  workingMemory: WorkingMemoryArtifact[];
  attentionState: AttentionState;
  recentThoughts: Thought[];
}

export interface ContributeThoughtRequest {
  sessionId: string;
  agentId: string;
  type: ThoughtType;
  content: string;
  confidence: number;
  parentThoughtIds?: string[];
  contradicts?: string[];
  domain: string;
  embedding?: number[];
}

export interface ContributeThoughtResponse {
  thought: Thought;
  budgetRemaining: AttentionBudget;
  attentionState: AttentionState;
}

export interface EndorseThoughtRequest {
  sessionId: string;
  agentId: string;
  thoughtId: string;
  strength: number;
  reason: string;
}

export interface EndorseThoughtResponse {
  thought: Thought;
}

export interface UpdateArtifactRequest {
  sessionId: string;
  artifactId: string;
  agentId: string;
  delta: Record<string, unknown>;
  rationale: string;
}

export interface UpdateArtifactResponse {
  artifact: WorkingMemoryArtifact;
}

export interface CreateArtifactRequest {
  sessionId: string;
  agentId: string;
  type: ArtifactType;
  content: Record<string, unknown>;
  sourceThoughtIds?: string[];
}

export interface CreateArtifactResponse {
  artifact: WorkingMemoryArtifact;
}

export interface SignalAttentionRequest {
  sessionId: string;
  agentId: string;
  type: AttentionSignalType;
  target: string;
  priority: number;
  context: string;
}

export interface SignalAttentionResponse {
  signal: AttentionSignal;
  attentionState: AttentionState;
}

export interface FuseInsightsRequest {
  sessionId: string;
  thoughtIds: string[];
  strategy: FusionStrategy;
  confidenceThreshold?: number;
  includeDissent?: boolean;
}

export interface FuseInsightsResponse {
  conclusion: EmergentConclusion;
  session: CognitiveSession;
}

export interface GetSessionStateRequest {
  sessionId: string;
}

export interface GetSessionStateResponse {
  session: CognitiveSession;
  thoughts: Thought[];
  workingMemory: WorkingMemoryArtifact[];
  attentionState: AttentionState;
  provenance: InsightProvenance[];
}

export interface ConcludeSessionRequest {
  sessionId: string;
  agentId: string;
  reason: string;
}

export interface ConcludeSessionResponse {
  session: CognitiveSession;
  finalConclusions: EmergentConclusion[];
  fullProvenance: InsightProvenance[];
  stats: SessionStats;
}

export interface SessionStats {
  totalThoughts: number;
  totalContributors: number;
  totalCognitiveUnits: number;
  durationMs: number;
  conclusionsReached: number;
  averageConfidence: number;
  emergenceScore: number;
  /** How much each agent contributed (0-1, sums to 1) */
  contributionDistribution: Record<string, number>;
  /** Number of thought branches explored */
  branchCount: number;
  /** Depth of the deepest reasoning chain */
  maxReasoningDepth: number;
  /** How many contradictions were surfaced and resolved */
  contradictionsResolved: number;
}
