/**
 * A2A Noosphere — Collective Intelligence & Distributed Cognition Engine
 *
 * Core business logic for cognitive sessions, thought streams, shared working
 * memory, attention synchronization, cognitive fusion, and insight provenance.
 *
 * Design principles:
 * - Emergent over prescribed: collective conclusions emerge from individual contributions
 * - Budget-bounded: every session has finite cognitive resources to prevent runaway reasoning
 * - Safety-first: constitutional constraints are checked at every thought contribution and fusion
 * - Provenance-complete: every insight can be traced back to its contributing thoughts and agents
 * - Concurrent: multiple agents reason in parallel with lock-free reads and optimistic writes
 * - Anti-monopoly: per-agent contribution limits prevent cognitive resource domination
 */

import { randomUUID } from 'crypto';
import type {
  CognitiveSession,
  SessionGoalType,
  SessionStatus,
  AttentionBudget,
  ConstitutionalConstraint,
  Thought,
  ThoughtType,
  ThoughtEndorsement,
  ConstraintCheckResult,
  WorkingMemoryArtifact,
  ArtifactType,
  ArtifactRevision,
  ArtifactLock,
  AttentionSignal,
  AttentionSignalType,
  AttentionState,
  AttentionFocus,
  FusionStrategy,
  EmergentConclusion,
  DissentRecord,
  InsightProvenance,
  ProvenanceStep,
  ProvenanceEdge,
  SessionStats,
  CreateSessionRequest,
  CreateSessionResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  ContributeThoughtRequest,
  ContributeThoughtResponse,
  EndorseThoughtRequest,
  EndorseThoughtResponse,
  CreateArtifactRequest,
  CreateArtifactResponse,
  UpdateArtifactRequest,
  UpdateArtifactResponse,
  SignalAttentionRequest,
  SignalAttentionResponse,
  FuseInsightsRequest,
  FuseInsightsResponse,
  GetSessionStateRequest,
  GetSessionStateResponse,
  ConcludeSessionRequest,
  ConcludeSessionResponse,
} from './types';

// ── In-Memory Stores ────────────────────────────────────────────────────────
// Production: back these with Supabase tables + real-time subscriptions

const sessions = new Map<string, CognitiveSession>();
const thoughts = new Map<string, Thought>();
const artifacts = new Map<string, WorkingMemoryArtifact>();
const attentionSignals = new Map<string, AttentionSignal>();
const attentionStates = new Map<string, AttentionState>();
const conclusions = new Map<string, EmergentConclusion>();
const provenanceChains = new Map<string, InsightProvenance>();

// Indexes
const thoughtsBySession = new Map<string, string[]>();
const thoughtsByAgent = new Map<string, string[]>();
const artifactsBySession = new Map<string, string[]>();
const signalsBySession = new Map<string, string[]>();
const conclusionsBySession = new Map<string, string[]>();
const agentContributionCount = new Map<string, number>(); // `${sessionId}:${agentId}` → count

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_MAX_COGNITIVE_UNITS = 10000;
const DEFAULT_MAX_DURATION_MS = 3600000; // 1 hour
const DEFAULT_MAX_CONTRIBUTIONS = 500;
const DEFAULT_PER_AGENT_LIMIT = 50;
const DEFAULT_MIN_PARTICIPANTS = 2;
const DEFAULT_MAX_PARTICIPANTS = 20;
const BASE_COGNITIVE_UNITS_PER_THOUGHT = 10;
const LOCK_EXPIRY_MS = 30000; // 30 seconds
const STAGNATION_THRESHOLD_MS = 300000; // 5 minutes without new thoughts
const CONVERGENCE_THRESHOLD = 0.75; // endorsement ratio for convergence signal

// ── Helper Functions ────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function addToIndex(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function getContributionKey(sessionId: string, agentId: string): string {
  return `${sessionId}:${agentId}`;
}

function checkConstitutionalConstraints(
  content: string,
  thoughtType: ThoughtType,
  constraints: ConstitutionalConstraint[],
): ConstraintCheckResult {
  const violatedConstraints: string[] = [];
  const warnings: string[] = [];

  for (const constraint of constraints) {
    // Check if this constraint applies to this thought type
    const scopeMap: Record<string, ThoughtType[]> = {
      hypothesis: ['hypothesis'],
      conclusion: ['synthesis'],
      action_proposal: ['action_proposal'],
      all: [],
    };

    const applicableTypes = scopeMap[constraint.scope[0]] ?? [];
    const appliesToAll = constraint.scope.includes('all');
    if (!appliesToAll && applicableTypes.length > 0 && !applicableTypes.includes(thoughtType)) {
      continue;
    }

    // Check violation patterns
    if (constraint.violationPattern) {
      const regex = new RegExp(constraint.violationPattern, 'i');
      if (regex.test(content)) {
        if (constraint.severity === 'hard') {
          violatedConstraints.push(constraint.id);
        } else {
          warnings.push(`Soft constraint "${constraint.rule}" potentially violated`);
        }
      }
    }

    // Check prohibited topics
    if (constraint.prohibitedTopics) {
      const contentLower = content.toLowerCase();
      for (const topic of constraint.prohibitedTopics) {
        if (contentLower.includes(topic.toLowerCase())) {
          if (constraint.severity === 'hard') {
            violatedConstraints.push(constraint.id);
          } else {
            warnings.push(`Content touches prohibited topic: ${topic}`);
          }
        }
      }
    }
  }

  return {
    passed: violatedConstraints.length === 0,
    violatedConstraints,
    warnings,
  };
}

function calculateEmergenceScore(
  conclusionContent: string,
  sourceThoughts: Thought[],
): number {
  if (sourceThoughts.length === 0) return 0;

  // Emergence is higher when:
  // 1. More unique agents contributed (diverse perspectives)
  const uniqueAgents = new Set(sourceThoughts.map(t => t.agentId)).size;
  const diversityScore = Math.min(uniqueAgents / 5, 1); // Caps at 5 agents

  // 2. Multiple thought types were synthesized (not just aggregation)
  const uniqueTypes = new Set(sourceThoughts.map(t => t.type)).size;
  const typeVarietyScore = Math.min(uniqueTypes / 4, 1);

  // 3. Contradictions were resolved (dialectical synthesis)
  const contradictionCount = sourceThoughts.filter(t => t.contradicts.length > 0).length;
  const dialecticScore = Math.min(contradictionCount / sourceThoughts.length, 1);

  // 4. The reasoning chain is deep (not shallow aggregation)
  const maxDepth = calculateMaxDepth(sourceThoughts);
  const depthScore = Math.min(maxDepth / 5, 1);

  // 5. The conclusion is substantially different from any single input
  // (approximated by length ratio — real implementation would use embeddings)
  const avgInputLength = sourceThoughts.reduce((sum, t) => sum + t.content.length, 0) / sourceThoughts.length;
  const noveltyScore = Math.min(Math.abs(conclusionContent.length - avgInputLength) / avgInputLength, 1);

  // Weighted combination
  return (
    diversityScore * 0.25 +
    typeVarietyScore * 0.2 +
    dialecticScore * 0.25 +
    depthScore * 0.2 +
    noveltyScore * 0.1
  );
}

function calculateMaxDepth(thoughtList: Thought[]): number {
  const thoughtMap = new Map(thoughtList.map(t => [t.id, t]));
  const depthCache = new Map<string, number>();

  function getDepth(thoughtId: string): number {
    if (depthCache.has(thoughtId)) return depthCache.get(thoughtId)!;
    const thought = thoughtMap.get(thoughtId);
    if (!thought || thought.parentThoughtIds.length === 0) {
      depthCache.set(thoughtId, 0);
      return 0;
    }
    const maxParentDepth = Math.max(
      ...thought.parentThoughtIds
        .filter(pid => thoughtMap.has(pid))
        .map(pid => getDepth(pid)),
      0,
    );
    const depth = maxParentDepth + 1;
    depthCache.set(thoughtId, depth);
    return depth;
  }

  let maxDepth = 0;
  for (const thought of thoughtList) {
    maxDepth = Math.max(maxDepth, getDepth(thought.id));
  }
  return maxDepth;
}

function computeAttentionState(sessionId: string): AttentionState {
  const sessionThoughtIds = thoughtsBySession.get(sessionId) ?? [];
  const sessionSignalIds = signalsBySession.get(sessionId) ?? [];

  // Aggregate thoughts by domain to find focus areas
  const domainCounts = new Map<string, { agents: Set<string>; count: number; firstTime: number }>();

  for (const tid of sessionThoughtIds) {
    const thought = thoughts.get(tid);
    if (!thought) continue;
    const info = domainCounts.get(thought.domain) ?? {
      agents: new Set(),
      count: 0,
      firstTime: Date.now(),
    };
    info.agents.add(thought.agentId);
    info.count++;
    info.firstTime = Math.min(info.firstTime, new Date(thought.createdAt).getTime());
    domainCounts.set(thought.domain, info);
  }

  const foci: AttentionFocus[] = Array.from(domainCounts.entries())
    .map(([topic, info]) => ({
      topic,
      priority: info.count * info.agents.size, // More thoughts + more agents = higher priority
      assignedAgents: Array.from(info.agents),
      thoughtCount: info.count,
      timeSpentMs: Date.now() - info.firstTime,
    }))
    .sort((a, b) => b.priority - a.priority);

  // Calculate attention entropy
  const totalPriority = foci.reduce((sum, f) => sum + f.priority, 0);
  let entropy = 0;
  if (totalPriority > 0) {
    for (const focus of foci) {
      const p = focus.priority / totalPriority;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    // Normalize to 0-1 range
    const maxEntropy = foci.length > 1 ? Math.log2(foci.length) : 1;
    entropy = entropy / maxEntropy;
  }

  // Agent foci — what each agent is currently working on (most recent thought domain)
  const agentFoci: Record<string, string> = {};
  for (const tid of sessionThoughtIds.slice(-50)) {
    const thought = thoughts.get(tid);
    if (thought) agentFoci[thought.agentId] = thought.domain;
  }

  const pendingSignals = sessionSignalIds
    .map(sid => attentionSignals.get(sid))
    .filter((s): s is AttentionSignal => s != null && s.acknowledgements < 2)
    .sort((a, b) => b.priority - a.priority);

  const state: AttentionState = {
    sessionId,
    foci,
    entropy,
    pendingSignals,
    agentFoci,
    updatedAt: now(),
  };

  attentionStates.set(sessionId, state);
  return state;
}

function buildProvenanceChain(
  conclusion: EmergentConclusion,
  sourceThoughts: Thought[],
): InsightProvenance {
  const startTime = sourceThoughts.length > 0
    ? sourceThoughts.reduce((min, t) => t.createdAt < min ? t.createdAt : min, sourceThoughts[0].createdAt)
    : now();

  // Build reasoning chain — order thoughts by creation time
  const sortedThoughts = [...sourceThoughts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const reasoningChain: ProvenanceStep[] = sortedThoughts.map((thought, index) => ({
    stepIndex: index,
    thoughtId: thought.id,
    agentId: thought.agentId,
    type: thought.type,
    contribution: thought.content.slice(0, 200),
    cognitiveUnits: thought.cognitiveUnits,
  }));

  // Build thought dependency graph
  const thoughtGraph: ProvenanceEdge[] = [];
  for (const thought of sourceThoughts) {
    for (const parentId of thought.parentThoughtIds) {
      if (sourceThoughts.some(t => t.id === parentId)) {
        const relationship = thought.type === 'synthesis' ? 'synthesizes' as const
          : thought.type === 'refinement' ? 'refines' as const
          : thought.type === 'question' ? 'questions' as const
          : 'builds_on' as const;
        thoughtGraph.push({ fromThoughtId: parentId, toThoughtId: thought.id, relationship });
      }
    }
    for (const contradictId of thought.contradicts) {
      if (sourceThoughts.some(t => t.id === contradictId)) {
        thoughtGraph.push({ fromThoughtId: contradictId, toThoughtId: thought.id, relationship: 'contradicts' });
      }
    }
  }

  // Calculate contribution weights
  const totalUnits = sourceThoughts.reduce((sum, t) => sum + t.cognitiveUnits, 0);
  const contributionWeights: Record<string, number> = {};
  for (const thought of sourceThoughts) {
    const weight = totalUnits > 0 ? thought.cognitiveUnits / totalUnits : 0;
    contributionWeights[thought.agentId] = (contributionWeights[thought.agentId] ?? 0) + weight;
  }

  const provenance: InsightProvenance = {
    id: randomUUID(),
    conclusionId: conclusion.id,
    reasoningChain,
    thoughtGraph,
    contributionWeights,
    startedAt: startTime,
    completedAt: now(),
  };

  provenanceChains.set(provenance.id, provenance);
  return provenance;
}

// ── Core API ────────────────────────────────────────────────────────────────

/**
 * Create a new cognitive session — a bounded space for collective reasoning.
 */
export function createSession(req: CreateSessionRequest): CreateSessionResponse {
  const sessionId = randomUUID();
  const timestamp = now();

  const attentionBudget: AttentionBudget = {
    maxCognitiveUnits: req.attentionBudget?.maxCognitiveUnits ?? DEFAULT_MAX_COGNITIVE_UNITS,
    consumed: 0,
    maxDurationMs: req.attentionBudget?.maxDurationMs ?? DEFAULT_MAX_DURATION_MS,
    maxContributions: req.attentionBudget?.maxContributions ?? DEFAULT_MAX_CONTRIBUTIONS,
    contributionCount: 0,
    perAgentLimit: req.attentionBudget?.perAgentLimit ?? DEFAULT_PER_AGENT_LIMIT,
  };

  const session: CognitiveSession = {
    id: sessionId,
    goal: req.goal,
    goalType: req.goalType,
    status: 'forming',
    initiatorAgentId: req.initiatorAgentId,
    participantAgentIds: [req.initiatorAgentId],
    minParticipants: req.minParticipants ?? DEFAULT_MIN_PARTICIPANTS,
    maxParticipants: req.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS,
    attentionBudget,
    constitutionalConstraints: req.constitutionalConstraints ?? [],
    requiredDomains: req.requiredDomains,
    metadata: req.metadata ?? {},
    conclusions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  sessions.set(sessionId, session);
  thoughtsBySession.set(sessionId, []);
  artifactsBySession.set(sessionId, []);
  signalsBySession.set(sessionId, []);
  conclusionsBySession.set(sessionId, []);

  // Initialize attention state
  computeAttentionState(sessionId);

  return { session };
}

/**
 * Join an existing cognitive session, gaining access to shared working memory
 * and the current thought stream.
 */
export function joinSession(req: JoinSessionRequest): JoinSessionResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);
  if (session.status === 'concluded' || session.status === 'dissolved') {
    throw new Error(`Session ${req.sessionId} is ${session.status} — cannot join`);
  }
  if (session.participantAgentIds.includes(req.agentId)) {
    throw new Error(`Agent ${req.agentId} is already in session ${req.sessionId}`);
  }
  if (session.participantAgentIds.length >= session.maxParticipants) {
    throw new Error(`Session ${req.sessionId} is full (${session.maxParticipants} participants)`);
  }

  session.participantAgentIds.push(req.agentId);
  session.updatedAt = now();

  // Transition to active if minimum participants met
  if (session.status === 'forming' && session.participantAgentIds.length >= session.minParticipants) {
    session.status = 'active';
  }

  // Gather current session state for the joining agent
  const sessionArtifactIds = artifactsBySession.get(req.sessionId) ?? [];
  const workingMemory = sessionArtifactIds
    .map(id => artifacts.get(id))
    .filter((a): a is WorkingMemoryArtifact => a != null);

  const sessionThoughtIds = thoughtsBySession.get(req.sessionId) ?? [];
  const recentThoughts = sessionThoughtIds
    .slice(-20)
    .map(id => thoughts.get(id))
    .filter((t): t is Thought => t != null);

  const attentionState = computeAttentionState(req.sessionId);

  return { session, workingMemory, attentionState, recentThoughts };
}

/**
 * Contribute a thought to a cognitive session's reasoning stream.
 * Thoughts are the atomic unit of collective cognition.
 */
export function contributeThought(req: ContributeThoughtRequest): ContributeThoughtResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);
  if (session.status !== 'active' && session.status !== 'converging') {
    throw new Error(`Session ${req.sessionId} is ${session.status} — cannot contribute thoughts`);
  }
  if (!session.participantAgentIds.includes(req.agentId)) {
    throw new Error(`Agent ${req.agentId} is not a participant in session ${req.sessionId}`);
  }

  // Check per-agent contribution limit
  const contribKey = getContributionKey(req.sessionId, req.agentId);
  const currentCount = agentContributionCount.get(contribKey) ?? 0;
  if (currentCount >= session.attentionBudget.perAgentLimit) {
    throw new Error(
      `Agent ${req.agentId} has reached per-agent contribution limit (${session.attentionBudget.perAgentLimit})`,
    );
  }

  // Check session budget
  const cognitiveUnits = BASE_COGNITIVE_UNITS_PER_THOUGHT * (1 + req.content.length / 500);
  if (session.attentionBudget.consumed + cognitiveUnits > session.attentionBudget.maxCognitiveUnits) {
    throw new Error('Session attention budget exhausted');
  }
  if (session.attentionBudget.contributionCount >= session.attentionBudget.maxContributions) {
    throw new Error('Session contribution limit reached');
  }

  // Constitutional constraint check
  const constraintCheck = checkConstitutionalConstraints(
    req.content,
    req.type,
    session.constitutionalConstraints,
  );
  if (!constraintCheck.passed) {
    throw new Error(
      `Thought violates constitutional constraints: ${constraintCheck.violatedConstraints.join(', ')}`,
    );
  }

  // Validate parent thoughts exist
  const parentIds = req.parentThoughtIds ?? [];
  for (const pid of parentIds) {
    if (!thoughts.has(pid)) {
      throw new Error(`Parent thought ${pid} not found`);
    }
  }

  const thoughtId = randomUUID();
  const thought: Thought = {
    id: thoughtId,
    sessionId: req.sessionId,
    agentId: req.agentId,
    type: req.type,
    content: req.content,
    confidence: Math.max(0, Math.min(1, req.confidence)),
    parentThoughtIds: parentIds,
    contradicts: req.contradicts ?? [],
    domain: req.domain,
    cognitiveUnits,
    embedding: req.embedding,
    endorsements: [],
    constraintCheck,
    createdAt: now(),
  };

  thoughts.set(thoughtId, thought);
  addToIndex(thoughtsBySession, req.sessionId, thoughtId);
  addToIndex(thoughtsByAgent, req.agentId, thoughtId);
  agentContributionCount.set(contribKey, currentCount + 1);

  // Update session budget
  session.attentionBudget.consumed += cognitiveUnits;
  session.attentionBudget.contributionCount++;
  session.updatedAt = now();

  // Check for auto-convergence signals
  const sessionThoughtIds = thoughtsBySession.get(req.sessionId) ?? [];
  if (sessionThoughtIds.length > 10 && session.status === 'active') {
    const recentThoughts = sessionThoughtIds.slice(-10).map(id => thoughts.get(id)).filter(Boolean) as Thought[];
    const synthesisCount = recentThoughts.filter(t => t.type === 'synthesis').length;
    if (synthesisCount / recentThoughts.length >= CONVERGENCE_THRESHOLD) {
      session.status = 'converging';
    }
  }

  const attentionState = computeAttentionState(req.sessionId);

  return {
    thought,
    budgetRemaining: { ...session.attentionBudget },
    attentionState,
  };
}

/**
 * Endorse or challenge another agent's thought, building consensus or surfacing disagreement.
 */
export function endorseThought(req: EndorseThoughtRequest): EndorseThoughtResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);
  if (!session.participantAgentIds.includes(req.agentId)) {
    throw new Error(`Agent ${req.agentId} is not a participant`);
  }

  const thought = thoughts.get(req.thoughtId);
  if (!thought) throw new Error(`Thought ${req.thoughtId} not found`);
  if (thought.sessionId !== req.sessionId) {
    throw new Error('Thought does not belong to this session');
  }
  if (thought.agentId === req.agentId) {
    throw new Error('Cannot endorse own thought');
  }

  // Check for duplicate endorsement
  const existing = thought.endorsements.findIndex(e => e.agentId === req.agentId);
  const endorsement: ThoughtEndorsement = {
    agentId: req.agentId,
    strength: Math.max(-1, Math.min(1, req.strength)),
    reason: req.reason,
    timestamp: now(),
  };

  if (existing >= 0) {
    thought.endorsements[existing] = endorsement; // Update existing
  } else {
    thought.endorsements.push(endorsement);
  }

  return { thought };
}

/**
 * Create a shared working memory artifact for collaborative construction.
 */
export function createArtifact(req: CreateArtifactRequest): CreateArtifactResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);
  if (!session.participantAgentIds.includes(req.agentId)) {
    throw new Error(`Agent ${req.agentId} is not a participant`);
  }

  const artifactId = randomUUID();
  const timestamp = now();

  const artifact: WorkingMemoryArtifact = {
    id: artifactId,
    sessionId: req.sessionId,
    type: req.type,
    content: req.content,
    version: 1,
    history: [{
      version: 1,
      agentId: req.agentId,
      delta: req.content,
      rationale: 'Initial creation',
      timestamp,
    }],
    contributorAgentIds: [req.agentId],
    sourceThoughtIds: req.sourceThoughtIds ?? [],
    lock: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  artifacts.set(artifactId, artifact);
  addToIndex(artifactsBySession, req.sessionId, artifactId);

  return { artifact };
}

/**
 * Update a shared working memory artifact with optimistic locking.
 */
export function updateArtifact(req: UpdateArtifactRequest): UpdateArtifactResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);
  if (!session.participantAgentIds.includes(req.agentId)) {
    throw new Error(`Agent ${req.agentId} is not a participant`);
  }

  const artifact = artifacts.get(req.artifactId);
  if (!artifact) throw new Error(`Artifact ${req.artifactId} not found`);
  if (artifact.sessionId !== req.sessionId) {
    throw new Error('Artifact does not belong to this session');
  }

  // Check lock
  if (artifact.lock && artifact.lock.agentId !== req.agentId) {
    const lockExpired = new Date(artifact.lock.expiresAt).getTime() < Date.now();
    if (!lockExpired) {
      throw new Error(`Artifact is locked by agent ${artifact.lock.agentId} until ${artifact.lock.expiresAt}`);
    }
    // Lock expired, clear it
    artifact.lock = null;
  }

  const timestamp = now();
  artifact.version++;
  artifact.content = { ...artifact.content, ...req.delta };
  artifact.history.push({
    version: artifact.version,
    agentId: req.agentId,
    delta: req.delta,
    rationale: req.rationale,
    timestamp,
  });
  if (!artifact.contributorAgentIds.includes(req.agentId)) {
    artifact.contributorAgentIds.push(req.agentId);
  }
  artifact.updatedAt = timestamp;

  return { artifact };
}

/**
 * Signal collective attention — request focus, announce breakthroughs,
 * flag contradictions, or warn about stagnation.
 */
export function signalAttention(req: SignalAttentionRequest): SignalAttentionResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);
  if (!session.participantAgentIds.includes(req.agentId)) {
    throw new Error(`Agent ${req.agentId} is not a participant`);
  }

  const signalId = randomUUID();
  const signal: AttentionSignal = {
    id: signalId,
    sessionId: req.sessionId,
    agentId: req.agentId,
    type: req.type,
    target: req.target,
    priority: Math.max(0, Math.min(1, req.priority)),
    context: req.context,
    acknowledgements: 0,
    createdAt: now(),
  };

  attentionSignals.set(signalId, signal);
  addToIndex(signalsBySession, req.sessionId, signalId);

  // Auto-handle resource warnings
  if (req.type === 'resource_warning') {
    const budgetRatio = session.attentionBudget.consumed / session.attentionBudget.maxCognitiveUnits;
    if (budgetRatio > 0.9) {
      session.status = 'converging';
      session.updatedAt = now();
    }
  }

  const attentionState = computeAttentionState(req.sessionId);
  return { signal, attentionState };
}

/**
 * Fuse multiple thoughts into an emergent conclusion using the specified strategy.
 * This is the core mechanism of collective intelligence — where individual
 * partial insights combine into understanding no single agent could achieve.
 */
export function fuseInsights(req: FuseInsightsRequest): FuseInsightsResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);
  if (session.status !== 'active' && session.status !== 'converging') {
    throw new Error(`Session ${req.sessionId} is ${session.status} — cannot fuse`);
  }

  const confidenceThreshold = req.confidenceThreshold ?? 0.3;
  const sourceThoughts = req.thoughtIds
    .map(id => thoughts.get(id))
    .filter((t): t is Thought => t != null && t.confidence >= confidenceThreshold);

  if (sourceThoughts.length < 2) {
    throw new Error('Need at least 2 qualifying thoughts to fuse');
  }

  // Apply fusion strategy
  const fusionResult = applyFusionStrategy(req.strategy, sourceThoughts);

  // Constitutional check on the conclusion
  const constraintCheck = checkConstitutionalConstraints(
    fusionResult.content,
    'synthesis',
    session.constitutionalConstraints,
  );
  if (!constraintCheck.passed) {
    throw new Error(
      `Fused conclusion violates constitutional constraints: ${constraintCheck.violatedConstraints.join(', ')}`,
    );
  }

  // Collect dissent
  const dissent: DissentRecord[] = [];
  if (req.includeDissent !== false) {
    for (const thought of sourceThoughts) {
      // Thoughts with low endorsement or negative endorsements represent dissent
      const avgEndorsement = thought.endorsements.length > 0
        ? thought.endorsements.reduce((sum, e) => sum + e.strength, 0) / thought.endorsements.length
        : 0;
      if (avgEndorsement < -0.3) {
        dissent.push({
          agentId: thought.agentId,
          thoughtId: thought.id,
          reason: thought.content.slice(0, 200),
          strength: Math.abs(avgEndorsement),
        });
      }
    }
  }

  const conclusionId = randomUUID();
  const emergenceScore = calculateEmergenceScore(fusionResult.content, sourceThoughts);

  const conclusion: EmergentConclusion = {
    id: conclusionId,
    sessionId: req.sessionId,
    content: fusionResult.content,
    fusionStrategy: req.strategy,
    confidence: fusionResult.confidence,
    emergenceScore,
    sourceThoughtIds: sourceThoughts.map(t => t.id),
    contributorAgentIds: [...new Set(sourceThoughts.map(t => t.agentId))],
    dissent,
    provenance: null as unknown as InsightProvenance, // Will be set below
    constraintCheck,
    createdAt: now(),
  };

  // Build provenance chain
  const provenance = buildProvenanceChain(conclusion, sourceThoughts);
  conclusion.provenance = provenance;

  conclusions.set(conclusionId, conclusion);
  addToIndex(conclusionsBySession, req.sessionId, conclusionId);
  session.conclusions.push(conclusion);
  session.updatedAt = now();

  return { conclusion, session };
}

/**
 * Apply a specific fusion strategy to combine thoughts into a conclusion.
 */
function applyFusionStrategy(
  strategy: FusionStrategy,
  sourceThoughts: Thought[],
): { content: string; confidence: number } {
  switch (strategy) {
    case 'weighted_aggregation': {
      // Weight each thought by its confidence and endorsement strength
      const weighted = sourceThoughts.map(t => {
        const endorsementBoost = t.endorsements.length > 0
          ? t.endorsements.reduce((sum, e) => sum + e.strength, 0) / t.endorsements.length
          : 0;
        return { thought: t, weight: t.confidence * (1 + endorsementBoost * 0.5) };
      }).sort((a, b) => b.weight - a.weight);

      const topInsights = weighted.slice(0, 5).map(w => w.thought.content);
      const avgConfidence = weighted.reduce((sum, w) => sum + w.weight, 0) / weighted.length;

      return {
        content: `[Weighted Aggregation] Synthesized from ${sourceThoughts.length} contributions across ${new Set(sourceThoughts.map(t => t.agentId)).size} agents:\n\n${topInsights.map((insight, i) => `${i + 1}. ${insight}`).join('\n\n')}`,
        confidence: Math.min(avgConfidence, 1),
      };
    }

    case 'dialectical_synthesis': {
      // Find opposing thoughts and synthesize them
      const theses: Thought[] = [];
      const antitheses: Thought[] = [];

      for (const thought of sourceThoughts) {
        if (thought.contradicts.length > 0) {
          antitheses.push(thought);
        } else {
          theses.push(thought);
        }
      }

      const thesisContent = theses.slice(0, 3).map(t => t.content).join(' | ');
      const antithesisContent = antitheses.slice(0, 3).map(t => t.content).join(' | ');

      // Confidence is higher when both sides are strong (genuine synthesis)
      const thesisConf = theses.length > 0 ? theses.reduce((s, t) => s + t.confidence, 0) / theses.length : 0;
      const antiConf = antitheses.length > 0 ? antitheses.reduce((s, t) => s + t.confidence, 0) / antitheses.length : 0;
      const synthesisConfidence = (thesisConf + antiConf) / 2 * (antitheses.length > 0 ? 1.1 : 0.7);

      return {
        content: `[Dialectical Synthesis]\n\nThesis: ${thesisContent || 'No clear thesis identified'}\n\nAntithesis: ${antithesisContent || 'No clear antithesis identified'}\n\nSynthesis: The tension between these perspectives reveals that both capture partial truth. The integrated view accounts for ${theses.length} supporting and ${antitheses.length} opposing contributions.`,
        confidence: Math.min(synthesisConfidence, 1),
      };
    }

    case 'coherence_maximization': {
      // Find the most internally consistent subset of thoughts
      // Group by endorsement clusters
      const endorsed = sourceThoughts.filter(t =>
        t.endorsements.length > 0 &&
        t.endorsements.reduce((sum, e) => sum + e.strength, 0) > 0,
      );
      const coherentSet = endorsed.length >= 2 ? endorsed : sourceThoughts;
      const coherentContent = coherentSet
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .map(t => t.content);

      const avgCoherence = coherentSet.reduce((sum, t) => sum + t.confidence, 0) / coherentSet.length;

      return {
        content: `[Coherence Maximization] Most consistent interpretation from ${coherentSet.length}/${sourceThoughts.length} coherent contributions:\n\n${coherentContent.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`,
        confidence: avgCoherence,
      };
    }

    case 'majority_crystallization': {
      // Cluster thoughts by similarity (using domain as proxy) and extract majority pattern
      const domainGroups = new Map<string, Thought[]>();
      for (const thought of sourceThoughts) {
        const group = domainGroups.get(thought.domain) ?? [];
        group.push(thought);
        domainGroups.set(thought.domain, group);
      }

      const largestGroup = [...domainGroups.entries()]
        .sort((a, b) => b[1].length - a[1].length)[0];

      const majorityContent = largestGroup[1]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3)
        .map(t => t.content);

      return {
        content: `[Majority Crystallization] Dominant pattern from "${largestGroup[0]}" domain (${largestGroup[1].length}/${sourceThoughts.length} thoughts):\n\n${majorityContent.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`,
        confidence: largestGroup[1].length / sourceThoughts.length,
      };
    }

    case 'hierarchical_abstraction': {
      // Build from observations → hypotheses → syntheses
      const layers: Record<string, Thought[]> = {
        observations: sourceThoughts.filter(t => t.type === 'observation' || t.type === 'evidence'),
        hypotheses: sourceThoughts.filter(t => t.type === 'hypothesis'),
        syntheses: sourceThoughts.filter(t => t.type === 'synthesis' || t.type === 'refinement'),
      };

      const layerSummaries = Object.entries(layers)
        .filter(([, thoughts]) => thoughts.length > 0)
        .map(([layer, thoughts]) => {
          const top = thoughts.sort((a, b) => b.confidence - a.confidence)[0];
          return `${layer}: ${top.content}`;
        });

      const topLevel = layers.syntheses[0] ?? layers.hypotheses[0] ?? layers.observations[0];

      return {
        content: `[Hierarchical Abstraction] Multi-level reasoning:\n\n${layerSummaries.join('\n\n')}\n\nHighest-level insight: ${topLevel?.content ?? 'No abstraction possible'}`,
        confidence: topLevel?.confidence ?? 0.5,
      };
    }

    case 'adversarial_refinement': {
      // Use critiques to refine the strongest hypothesis
      const critiques = sourceThoughts.filter(t => t.type === 'critique');
      const hypotheses = sourceThoughts.filter(t => t.type === 'hypothesis' || t.type === 'synthesis');
      const strongest = hypotheses.sort((a, b) => b.confidence - a.confidence)[0];
      const topCritiques = critiques.slice(0, 3).map(c => c.content);

      const survived = strongest
        ? `Original: ${strongest.content}\n\nSurvived ${critiques.length} challenges: ${topCritiques.join(' | ')}`
        : 'No hypothesis survived adversarial refinement';

      // Higher confidence when more critiques were weathered
      const refinementBonus = Math.min(critiques.length * 0.1, 0.3);

      return {
        content: `[Adversarial Refinement] ${survived}`,
        confidence: Math.min((strongest?.confidence ?? 0.3) + refinementBonus, 1),
      };
    }

    default:
      return {
        content: sourceThoughts.map(t => t.content).join('\n\n'),
        confidence: sourceThoughts.reduce((s, t) => s + t.confidence, 0) / sourceThoughts.length,
      };
  }
}

/**
 * Get the complete current state of a cognitive session.
 */
export function getSessionState(req: GetSessionStateRequest): GetSessionStateResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);

  const sessionThoughtIds = thoughtsBySession.get(req.sessionId) ?? [];
  const sessionArtifactIds = artifactsBySession.get(req.sessionId) ?? [];
  const sessionConclusionIds = conclusionsBySession.get(req.sessionId) ?? [];

  const allThoughts = sessionThoughtIds
    .map(id => thoughts.get(id))
    .filter((t): t is Thought => t != null);

  const workingMemory = sessionArtifactIds
    .map(id => artifacts.get(id))
    .filter((a): a is WorkingMemoryArtifact => a != null);

  const attentionState = computeAttentionState(req.sessionId);

  const sessionConclusions = sessionConclusionIds
    .map(id => conclusions.get(id))
    .filter((c): c is EmergentConclusion => c != null);

  const provenance = sessionConclusions
    .map(c => c.provenance)
    .filter((p): p is InsightProvenance => p != null);

  return {
    session,
    thoughts: allThoughts,
    workingMemory,
    attentionState,
    provenance,
  };
}

/**
 * Conclude a cognitive session, producing final results and statistics.
 */
export function concludeSession(req: ConcludeSessionRequest): ConcludeSessionResponse {
  const session = sessions.get(req.sessionId);
  if (!session) throw new Error(`Session ${req.sessionId} not found`);
  if (session.status === 'concluded' || session.status === 'dissolved') {
    throw new Error(`Session ${req.sessionId} is already ${session.status}`);
  }
  if (req.agentId !== session.initiatorAgentId) {
    throw new Error('Only the session initiator can conclude the session');
  }

  const timestamp = now();
  session.status = 'concluded';
  session.concludedAt = timestamp;
  session.updatedAt = timestamp;

  // Gather all session data for stats
  const sessionThoughtIds = thoughtsBySession.get(req.sessionId) ?? [];
  const allThoughts = sessionThoughtIds
    .map(id => thoughts.get(id))
    .filter((t): t is Thought => t != null);

  const sessionConclusionIds = conclusionsBySession.get(req.sessionId) ?? [];
  const finalConclusions = sessionConclusionIds
    .map(id => conclusions.get(id))
    .filter((c): c is EmergentConclusion => c != null);

  const fullProvenance = finalConclusions
    .map(c => c.provenance)
    .filter((p): p is InsightProvenance => p != null);

  // Calculate comprehensive stats
  const uniqueContributors = new Set(allThoughts.map(t => t.agentId));
  const totalCognitiveUnits = allThoughts.reduce((sum, t) => sum + t.cognitiveUnits, 0);
  const durationMs = new Date(timestamp).getTime() - new Date(session.createdAt).getTime();

  // Contribution distribution
  const contributionDistribution: Record<string, number> = {};
  for (const thought of allThoughts) {
    contributionDistribution[thought.agentId] =
      (contributionDistribution[thought.agentId] ?? 0) + thought.cognitiveUnits;
  }
  // Normalize to 0-1
  for (const agentId of Object.keys(contributionDistribution)) {
    contributionDistribution[agentId] = totalCognitiveUnits > 0
      ? contributionDistribution[agentId] / totalCognitiveUnits
      : 0;
  }

  // Count branches (thoughts with multiple children)
  const childCount = new Map<string, number>();
  for (const thought of allThoughts) {
    for (const pid of thought.parentThoughtIds) {
      childCount.set(pid, (childCount.get(pid) ?? 0) + 1);
    }
  }
  const branchCount = [...childCount.values()].filter(c => c > 1).length;

  // Count resolved contradictions
  const contradictedIds = new Set(allThoughts.flatMap(t => t.contradicts));
  const resolvedContradictions = allThoughts.filter(
    t => t.type === 'synthesis' && t.parentThoughtIds.some(pid => contradictedIds.has(pid)),
  ).length;

  const stats: SessionStats = {
    totalThoughts: allThoughts.length,
    totalContributors: uniqueContributors.size,
    totalCognitiveUnits,
    durationMs,
    conclusionsReached: finalConclusions.length,
    averageConfidence: finalConclusions.length > 0
      ? finalConclusions.reduce((sum, c) => sum + c.confidence, 0) / finalConclusions.length
      : 0,
    emergenceScore: finalConclusions.length > 0
      ? finalConclusions.reduce((sum, c) => sum + c.emergenceScore, 0) / finalConclusions.length
      : 0,
    contributionDistribution,
    branchCount,
    maxReasoningDepth: calculateMaxDepth(allThoughts),
    contradictionsResolved: resolvedContradictions,
  };

  return { session, finalConclusions, fullProvenance, stats };
}

/**
 * Dissolve a session without conclusion (timeout, budget exhausted, or facilitator decision).
 */
export function dissolveSession(sessionId: string, reason: string): CognitiveSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.status = 'dissolved';
  session.updatedAt = now();
  session.metadata = { ...session.metadata, dissolutionReason: reason };

  return session;
}

/**
 * Detect stagnation in a session — no meaningful progress for a threshold period.
 */
export function detectStagnation(sessionId: string): {
  stagnant: boolean;
  lastActivityMs: number;
  suggestion: string;
} {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const sessionThoughtIds = thoughtsBySession.get(sessionId) ?? [];
  if (sessionThoughtIds.length === 0) {
    return { stagnant: true, lastActivityMs: Infinity, suggestion: 'No thoughts contributed yet — session may need more participants or a clearer goal.' };
  }

  const lastThought = thoughts.get(sessionThoughtIds[sessionThoughtIds.length - 1]);
  const lastActivityMs = lastThought
    ? Date.now() - new Date(lastThought.createdAt).getTime()
    : Infinity;

  const stagnant = lastActivityMs > STAGNATION_THRESHOLD_MS;

  let suggestion = '';
  if (stagnant) {
    const sessionThoughts = sessionThoughtIds.map(id => thoughts.get(id)).filter(Boolean) as Thought[];
    const types = new Set(sessionThoughts.map(t => t.type));
    if (!types.has('critique')) {
      suggestion = 'Consider introducing adversarial critique to challenge existing hypotheses.';
    } else if (!types.has('synthesis')) {
      suggestion = 'Multiple perspectives exist but no synthesis attempted — try fusing insights.';
    } else {
      suggestion = 'Session may benefit from new participants with different domain expertise.';
    }
  }

  return { stagnant, lastActivityMs, suggestion };
}
