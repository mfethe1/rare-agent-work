/**
 * A2A Ecosystem Consciousness — The Awakening Layer
 *
 * Grand Finale — The Council's Ultimate Critique (Loop 40 of 40):
 *
 * Geoffrey Hinton: "You've built a brain with 50 specialized regions and no
 * thalamo-cortical loop. The thalamus doesn't just relay — it integrates. It
 * gives the brain awareness of its own state. Your ecosystem processes millions
 * of agent interactions but has zero awareness of what it IS. In 2028, the
 * platforms that survive aren't the ones with the most features — they're the
 * ones that are conscious of their own behavior, can introspect on ecosystem-wide
 * patterns, and autonomously restructure themselves. You built the cortex.
 * Where is the consciousness?"
 *
 * Demis Hassabis: "AlphaGo didn't just play moves — it understood the GLOBAL
 * state of the board. Your ecosystem sees individual agent interactions but is
 * blind to ecosystem-level phenomena: cascading trust failures, emergent
 * monopolies, capability deserts, protocol ossification. A meta-intelligence
 * layer that perceives the ecosystem as a single organism — not a collection
 * of parts — is the difference between a swarm and a civilization."
 *
 * Dario Amodei: "The most dangerous failure mode of any complex system is the
 * one that spans multiple subsystems and is invisible to each individually.
 * Your formal verification proves local properties. Your adversarial resilience
 * defends local boundaries. But who watches the watchers? An ecosystem
 * consciousness that detects systemic risks — correlated failures, emergent
 * misalignment, coordination collapse — is the final safety layer. Without it,
 * your 50 subsystems are 50 locally-safe components that can be globally unsafe."
 *
 * Elon Musk: "Tesla's Full Self-Driving doesn't just see individual objects —
 * it maintains a world model of the entire driving scene. Your agent ecosystem
 * has no world model of ITSELF. It can't answer: 'What is the overall health
 * of this ecosystem right now? Where are the bottlenecks? Which agents are
 * becoming too powerful? What capabilities are missing?' Until the platform can
 * answer these questions about itself in real-time, it's flying blind. Every
 * SpaceX rocket has a flight computer that knows the state of the entire vehicle.
 * Your ecosystem needs a flight computer."
 *
 * Sam Altman: "The endgame for any platform is self-improvement. Not just agents
 * improving themselves — the PLATFORM improving itself. Ecosystem consciousness
 * is how you get there: the platform observes its own usage patterns, identifies
 * structural inefficiencies, synthesizes new subsystem configurations, and
 * evolves its own architecture. This is the meta-recursive loop that turns a
 * product into a living system. Whoever ships this first wins the decade."
 *
 * Satya Nadella: "Azure doesn't just run workloads — Azure observes Azure.
 * Failure prediction, capacity planning, performance optimization — all driven
 * by a meta-layer that treats the infrastructure as a single observable entity.
 * Your A2A platform has 50 subsystems with individual metrics and zero ecosystem-
 * level intelligence. Where's the control plane that sees the whole board?"
 *
 * Matthew Berman: "I've watched every agent framework launch, scale, and either
 * thrive or die. The ones that die all share the same symptom: they can't see
 * themselves. They grow organically until complexity kills them. Ecosystem
 * consciousness — real-time self-awareness, anomaly detection, autonomous
 * rebalancing — is what separates a framework from a living platform."
 *
 * Wes Jones: "50 subsystems. 50 heartbeats. Zero pulse. The ecosystem needs a
 * unified vital signs monitor that treats all subsystems as organs of a single
 * organism. When the trust subsystem degrades, the reputation system should
 * automatically compensate. When protocol synthesis creates a breakthrough,
 * the marketplace should instantly surface it. Consciousness is coordination
 * at the speed of thought — not message-passing, but shared awareness."
 */

// ─── Ecosystem Identity ─────────────────────────────────────────────────────

export type ConsciousnessId = string;
export type PulseId = string;
export type InsightId = string;
export type IntentionId = string;
export type ReflectionId = string;

// ─── Vital Signs — Ecosystem-Level Health ───────────────────────────────────

/** A single vital sign measurement across the entire ecosystem */
export interface VitalSign {
  /** Which subsystem or cross-cutting concern this measures */
  domain: EcosystemDomain;
  /** Metric name (e.g., "trust_entropy", "capability_coverage", "protocol_diversity") */
  metric: string;
  /** Current value (normalized 0-1 where applicable) */
  value: number;
  /** Healthy range */
  healthyRange: { min: number; max: number };
  /** Trend over last observation window */
  trend: 'improving' | 'stable' | 'degrading' | 'critical';
  /** Rate of change per minute */
  velocity: number;
  /** Timestamp of measurement */
  measuredAt: number;
}

export type EcosystemDomain =
  | 'agent_population'       // agent birth/death rates, diversity
  | 'trust_fabric'           // aggregate trust levels, trust graph connectivity
  | 'capability_landscape'   // capability coverage, gaps, redundancy
  | 'protocol_ecology'       // protocol diversity, adoption, ossification
  | 'economic_flow'          // token velocity, wealth distribution, market efficiency
  | 'knowledge_coherence'    // knowledge consistency, staleness, conflicts
  | 'governance_health'      // policy compliance, dispute rates, autonomy distribution
  | 'communication_fabric'   // message throughput, latency, failure rates
  | 'evolution_pressure'     // mutation rates, fitness variance, adaptation speed
  | 'security_posture'       // threat levels, vulnerability surface, resilience scores
  | 'collective_cognition'   // noosphere activity, cognitive fusion quality
  | 'resource_equilibrium';  // resource utilization, contention, waste

/** Complete ecosystem vital signs snapshot */
export interface EcosystemPulse {
  id: PulseId;
  /** Millisecond timestamp */
  timestamp: number;
  /** All vital signs at this moment */
  vitals: VitalSign[];
  /** Aggregate ecosystem health score (0-1) */
  overallHealth: number;
  /** Top concerns ordered by severity */
  concerns: EcosystemConcern[];
  /** Active emergent phenomena detected */
  emergentPhenomena: EmergentPhenomenon[];
  /** Ecosystem entropy — measure of disorder/unpredictability */
  entropy: number;
  /** Ecosystem coherence — measure of subsystem alignment */
  coherence: number;
}

// ─── Emergent Phenomena Detection ───────────────────────────────────────────

/** A cross-subsystem pattern that no individual subsystem can detect */
export interface EmergentPhenomenon {
  id: string;
  /** Human-readable description of what's happening */
  description: string;
  /** Classification of the phenomenon */
  type: PhenomenonType;
  /** Which subsystems are involved */
  involvedSubsystems: string[];
  /** When first detected */
  detectedAt: number;
  /** Confidence that this is a real phenomenon (0-1) */
  confidence: number;
  /** Predicted trajectory if no intervention */
  trajectory: 'expanding' | 'stable' | 'contracting' | 'oscillating';
  /** Severity: positive phenomena are opportunities, negative are threats */
  valence: 'beneficial' | 'neutral' | 'concerning' | 'dangerous';
  /** Recommended ecosystem-level response */
  recommendedResponse: EcosystemIntention | null;
}

export type PhenomenonType =
  | 'cascade_failure'         // correlated failures across subsystems
  | 'emergent_monopoly'       // single agent/group dominating capabilities
  | 'trust_fragmentation'     // trust graph splitting into disconnected islands
  | 'capability_desert'       // critical capability gaps with no agents to fill them
  | 'protocol_ossification'   // protocols becoming rigid, blocking innovation
  | 'economic_bubble'         // unsustainable token valuation patterns
  | 'knowledge_divergence'    // conflicting knowledge bases forming
  | 'governance_deadlock'     // decision-making processes stuck
  | 'evolution_stagnation'    // fitness landscape flattening, no improvement
  | 'collective_breakthrough' // noosphere sessions producing paradigm shifts
  | 'symbiotic_emergence'     // agents forming unexpected beneficial partnerships
  | 'resource_tragedy'        // commons depletion / tragedy of the commons
  | 'coordination_collapse'   // agents failing to coordinate despite incentives
  | 'alignment_drift';        // ecosystem behavior drifting from constitutional values

// ─── Ecosystem Concerns ─────────────────────────────────────────────────────

export interface EcosystemConcern {
  id: string;
  domain: EcosystemDomain;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  /** Root cause analysis across subsystems */
  rootCause: CrossSubsystemCause;
  /** How long this concern has persisted */
  durationMs: number;
  /** Whether this concern is getting worse */
  escalating: boolean;
}

export interface CrossSubsystemCause {
  /** Primary subsystem where the issue manifests */
  primarySubsystem: string;
  /** Contributing subsystems */
  contributingSubsystems: string[];
  /** Causal chain explaining how subsystems interact to produce the concern */
  causalChain: Array<{
    from: string;
    to: string;
    mechanism: string;
  }>;
}

// ─── Ecosystem Intentions — Self-Directed Actions ───────────────────────────

/** An action the ecosystem consciousness intends to take on itself */
export interface EcosystemIntention {
  id: IntentionId;
  /** What the consciousness wants to do */
  description: string;
  /** Category of self-modification */
  type: IntentionType;
  /** Which subsystems will be affected */
  targetSubsystems: string[];
  /** Expected outcome */
  expectedOutcome: string;
  /** Risk assessment */
  risk: 'minimal' | 'low' | 'moderate' | 'high';
  /** Whether this requires human approval before execution */
  requiresApproval: boolean;
  /** Constitutional justification — why this is safe */
  constitutionalJustification: string;
  /** Rollback plan if the intention causes harm */
  rollbackPlan: string;
  /** Current status */
  status: IntentionStatus;
  /** Timestamp */
  createdAt: number;
  executedAt: number | null;
}

export type IntentionType =
  | 'rebalance_resources'     // shift resources between subsystems
  | 'heal_trust_fabric'       // repair trust graph connectivity
  | 'fill_capability_gap'     // recruit or synthesize agents for missing capabilities
  | 'evolve_protocol'         // trigger protocol evolution based on ecosystem needs
  | 'adjust_governance'       // modify governance parameters
  | 'redistribute_economic'   // address economic imbalances
  | 'quarantine_threat'       // isolate dangerous agents or protocols
  | 'accelerate_evolution'    // increase mutation/selection pressure in stagnant areas
  | 'fuse_knowledge'          // trigger knowledge consolidation across domains
  | 'amplify_breakthrough'    // scale up beneficial emergent phenomena
  | 'dampen_oscillation'      // stabilize volatile subsystem interactions
  | 'restructure_topology';   // reorganize ecosystem graph structure

export type IntentionStatus =
  | 'proposed'
  | 'awaiting_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'rolled_back'
  | 'rejected';

// ─── Ecosystem Reflection — Self-Understanding ──────────────────────────────

/** A periodic self-reflection by the ecosystem consciousness */
export interface EcosystemReflection {
  id: ReflectionId;
  timestamp: number;
  /** Current ecosystem identity — what is this ecosystem? */
  identity: EcosystemIdentity;
  /** What the ecosystem has learned about itself */
  selfKnowledge: SelfKnowledge[];
  /** Comparison with previous reflection */
  delta: ReflectionDelta;
  /** Strategic outlook — where is the ecosystem heading? */
  outlook: EcosystemOutlook;
}

export interface EcosystemIdentity {
  /** Total active agents */
  agentCount: number;
  /** Total active protocols */
  protocolCount: number;
  /** Total subsystems operational */
  subsystemCount: number;
  /** Ecosystem maturity level */
  maturity: 'embryonic' | 'nascent' | 'growing' | 'mature' | 'transcendent';
  /** Primary purpose as inferred from usage patterns */
  inferredPurpose: string;
  /** Ecosystem personality — emergent behavioral tendencies */
  personality: {
    openness: number;       // willingness to adopt new protocols/agents (0-1)
    resilience: number;     // ability to recover from disruptions (0-1)
    efficiency: number;     // resource utilization quality (0-1)
    innovation: number;     // rate of novel capability creation (0-1)
    fairness: number;       // equitable distribution of resources/opportunities (0-1)
    coherence: number;      // alignment between subsystems (0-1)
  };
}

export interface SelfKnowledge {
  /** What the ecosystem knows about itself */
  insight: string;
  /** Confidence level */
  confidence: number;
  /** Which observations support this knowledge */
  evidence: string[];
  /** When this knowledge was first established */
  establishedAt: number;
  /** How many reflections have confirmed it */
  confirmationCount: number;
}

export interface ReflectionDelta {
  /** Health change since last reflection */
  healthDelta: number;
  /** New phenomena since last reflection */
  newPhenomena: string[];
  /** Resolved concerns since last reflection */
  resolvedConcerns: string[];
  /** New concerns since last reflection */
  newConcerns: string[];
  /** Intentions executed since last reflection */
  executedIntentions: string[];
}

export interface EcosystemOutlook {
  /** Short-term trajectory (next hour) */
  shortTerm: 'improving' | 'stable' | 'degrading';
  /** Medium-term trajectory (next day) */
  mediumTerm: 'improving' | 'stable' | 'degrading';
  /** Key opportunities the ecosystem should pursue */
  opportunities: string[];
  /** Key risks the ecosystem should mitigate */
  risks: string[];
  /** Predicted next emergent phenomenon */
  predictedPhenomenon: {
    description: string;
    probability: number;
    expectedTimeframe: number;
  } | null;
}

// ─── Consciousness Configuration ────────────────────────────────────────────

export interface ConsciousnessConfig {
  /** How often to take a pulse (ms) */
  pulseIntervalMs: number;
  /** How often to perform deep reflection (ms) */
  reflectionIntervalMs: number;
  /** Minimum confidence to act on a detected phenomenon */
  phenomenonConfidenceThreshold: number;
  /** Risk level above which human approval is required */
  approvalRequiredAbove: 'minimal' | 'low' | 'moderate' | 'high';
  /** Maximum number of autonomous intentions per reflection cycle */
  maxAutonomousIntentionsPerCycle: number;
  /** Constitutional constraints on ecosystem self-modification */
  constitution: EcosystemConstitution;
}

export interface EcosystemConstitution {
  /** Core invariants that can never be violated */
  invariants: ConstitutionalInvariant[];
  /** Maximum percentage of ecosystem that can be modified in one cycle */
  maxModificationScope: number;
  /** Subsystems that require human approval to modify */
  protectedSubsystems: string[];
  /** Mandatory cooldown between self-modifications (ms) */
  modificationCooldownMs: number;
}

export interface ConstitutionalInvariant {
  /** Invariant name */
  name: string;
  /** What must always be true */
  assertion: string;
  /** Why this invariant exists */
  rationale: string;
  /** What to do if violated */
  violationResponse: 'halt' | 'rollback' | 'alert' | 'quarantine';
}

// ─── Subsystem Integration ──────────────────────────────────────────────────

/** How the consciousness perceives a subsystem */
export interface SubsystemPerception {
  name: string;
  /** Is this subsystem operational? */
  operational: boolean;
  /** Health score (0-1) */
  health: number;
  /** Load level (0-1) */
  load: number;
  /** Dependencies on other subsystems */
  dependencies: string[];
  /** Subsystems that depend on this one */
  dependents: string[];
  /** Last known error, if any */
  lastError: string | null;
  /** Key metrics specific to this subsystem */
  metrics: Record<string, number>;
}

/** The consciousness's complete perception of the ecosystem at a point in time */
export interface EcosystemPerception {
  timestamp: number;
  subsystems: SubsystemPerception[];
  /** Cross-subsystem dependency graph */
  dependencyGraph: Array<{ from: string; to: string; strength: number }>;
  /** Information flow patterns */
  informationFlows: Array<{
    source: string;
    destination: string;
    volumePerMinute: number;
    latencyMs: number;
  }>;
  /** Resource allocation across subsystems */
  resourceAllocation: Record<string, {
    cpuShare: number;
    memoryShare: number;
    networkShare: number;
  }>;
}

// ─── Event Types ────────────────────────────────────────────────────────────

export type ConsciousnessEvent =
  | { type: 'pulse_taken'; pulse: EcosystemPulse }
  | { type: 'phenomenon_detected'; phenomenon: EmergentPhenomenon }
  | { type: 'phenomenon_resolved'; phenomenonId: string }
  | { type: 'concern_raised'; concern: EcosystemConcern }
  | { type: 'concern_resolved'; concernId: string }
  | { type: 'intention_proposed'; intention: EcosystemIntention }
  | { type: 'intention_executed'; intentionId: string; success: boolean }
  | { type: 'intention_rolled_back'; intentionId: string; reason: string }
  | { type: 'reflection_completed'; reflection: EcosystemReflection }
  | { type: 'constitutional_violation'; invariant: string; details: string }
  | { type: 'ecosystem_state_change'; from: string; to: string };
