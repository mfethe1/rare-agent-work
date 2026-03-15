/**
 * A2A Agent Genome — Portable Agent Specification & Reproducible Instantiation
 *
 * The critical missing layer for 2028: a universal, declarative specification
 * format that captures everything an agent IS — its DNA. Without this, agents
 * are ephemeral runtime artifacts that can't be versioned, shared, migrated,
 * composed, or formally verified.
 *
 * Why this matters (the council's critique):
 *
 * - **Elon Musk**: "You built an agent OS but you forgot the executable format.
 *   Linux has ELF. macOS has Mach-O. Your agent kernel has... nothing. When
 *   someone says 'deploy this agent', what exactly ARE they deploying? A loose
 *   collection of config? A runtime state dump? In 2028, agents need a portable
 *   binary format — a genome — that fully specifies what an agent is, what it
 *   can do, what it needs, and how it evolves. Without that, your OS is running
 *   interpreted scripts with no packaging, no versioning, no reproducibility.
 *   SpaceX doesn't upload loose Python files to Falcon 9 — there's a verified,
 *   signed, reproducible flight software image."
 *
 * - **Sam Altman**: "The Docker moment for AI agents hasn't happened yet because
 *   nobody has built the Dockerfile. Your ecosystem has incredible infrastructure
 *   but zero portability. An agent built here can't run anywhere else. An agent
 *   built elsewhere can't run here. The genome IS the Dockerfile — a declarative
 *   spec that says 'this agent has these capabilities, these constraints, these
 *   resource needs, this behavioral constitution, this evolution history'. Once
 *   you have that, you get package managers, registries, composition operators,
 *   and an entire ecosystem of tooling for free."
 *
 * - **Dario Amodei**: "From a safety perspective, the genome is existential.
 *   Right now, how do you audit an agent? You look at runtime behavior. That's
 *   testing, not verification. A genome lets you formally verify BEFORE
 *   instantiation: 'Does this agent's capability set satisfy the principle of
 *   least privilege? Does its constitutional DNA prohibit the behaviors we care
 *   about? Is its composition with other agents provably safe?' The genome is
 *   the thing you sign, the thing you audit, the thing regulators can inspect.
 *   Without it, agent safety is just vibes."
 *
 * - **Demis Hassabis**: "In biology, the genome is what makes organisms both
 *   reproducible and evolvable. You can sequence it, compare it, detect mutations,
 *   trace lineage, and predict phenotype from genotype. Your agents have no
 *   genotype — only phenotype. You can observe what they do but you can't inspect
 *   what they ARE. A genome with proper lineage tracking means you can do
 *   'phylogenetic analysis' of agent populations — which mutations improved
 *   performance, which introduced regressions, how capabilities drifted over
 *   generations. This is the foundation for principled agent evolution."
 *
 * - **Geoffrey Hinton**: "The brain's 'genome' isn't just a parts list — it's
 *   a developmental program. It specifies how neurons wire up, which regions
 *   connect to which, what the learning rules are, and what the inductive biases
 *   should be. Your agent genome needs the same thing: not just 'what capabilities
 *   does this agent have' but 'how does it develop them, what's its learning
 *   curriculum, what are its architectural priors'. The genome should specify
 *   the agent's cognitive architecture, not just its API surface."
 *
 * - **Satya Nadella**: "Azure Container Registry didn't just store containers —
 *   it created an ecosystem. The agent genome creates the same thing: a registry
 *   where teams publish, discover, compose, and deploy agents with the same
 *   confidence they deploy microservices today. Version pinning, dependency
 *   resolution, compatibility matrices, rollback — all of this requires a
 *   stable, versioned specification format. The genome is that format."
 *
 * - **Matthew Berman**: "Every agent framework I've reviewed has the same problem:
 *   configuration sprawl. System prompts in one place, tool definitions in another,
 *   guardrails in a third, memory schemas in a fourth. The genome unifies all of
 *   these into a single, versioned, signable artifact. One file describes the
 *   complete agent. That's the difference between a hobby project and a
 *   production platform."
 *
 * - **Wes Jones**: "In distributed systems, the hardest versioning problem is
 *   'what changed?' Your agents evolve through metacognition, natural selection,
 *   and skill transfer — but there's no diff format. The genome gives you
 *   semantic diffs: 'this agent gained a new capability', 'this constraint was
 *   relaxed', 'this resource quota increased'. Without it, agent evolution is
 *   a black box."
 */

// ─── Genome Identity ────────────────────────────────────────────────────────

/** Content-addressable hash of the genome (SHA-256 of canonical form) */
export type GenomeHash = string;

/** Semantic version of the genome specification format */
export type GenomeSpecVersion = string;

/** Unique identifier for this genome lineage */
export type GenomeLineageId = string;

/** Generation number in the evolution chain */
export type GenerationNumber = number;

export interface GenomeIdentity {
  /** Content-addressable hash — the genome's unique fingerprint */
  hash: GenomeHash;
  /** Human-readable name */
  name: string;
  /** Semantic version of this genome */
  version: string;
  /** Spec format version (for forward/backward compatibility) */
  specVersion: GenomeSpecVersion;
  /** Lineage ID — stable across versions of the same agent */
  lineageId: GenomeLineageId;
  /** Generation number in the evolution chain */
  generation: GenerationNumber;
  /** Author/organization */
  author: string;
  /** Creation timestamp */
  createdAt: string;
  /** Optional description */
  description: string;
  /** Tags for discovery and search */
  tags: string[];
  /** License under which this genome can be used */
  license: string;
}

// ─── Cognitive Architecture ─────────────────────────────────────────────────

export type ReasoningStrategy =
  | 'chain_of_thought'       // sequential reasoning
  | 'tree_of_thought'        // branching exploration
  | 'graph_of_thought'       // non-linear reasoning
  | 'debate'                 // adversarial reasoning
  | 'ensemble'               // multiple strategies combined
  | 'metacognitive'          // reasoning about reasoning
  | 'analogical'             // reasoning by analogy
  | 'abductive';             // inference to best explanation

export type LearningMode =
  | 'in_context'             // learn from examples in prompt
  | 'few_shot'               // learn from few examples
  | 'reinforcement'          // learn from reward signals
  | 'imitation'              // learn from demonstrations
  | 'curriculum'             // structured learning progression
  | 'self_supervised'        // learn from own outputs
  | 'collaborative';         // learn from peer agents

export interface CognitiveArchitecture {
  /** Primary reasoning strategy */
  primaryReasoning: ReasoningStrategy;
  /** Fallback reasoning strategies */
  fallbackStrategies: ReasoningStrategy[];
  /** Supported learning modes */
  learningModes: LearningMode[];
  /** Maximum reasoning depth (for recursive strategies) */
  maxReasoningDepth: number;
  /** Working memory capacity (number of concurrent context items) */
  workingMemorySlots: number;
  /** Attention span — max tokens before context degradation */
  attentionHorizon: number;
  /** Cognitive biases this agent is designed to counteract */
  debiasing: string[];
  /** Specialization domains */
  domains: string[];
}

// ─── Capability Genome ──────────────────────────────────────────────────────

export type CapabilityMaturity =
  | 'nascent'        // capability is newly acquired, untested
  | 'developing'     // has been used but not validated
  | 'proficient'     // validated through use, reliable
  | 'expert'         // extensively validated, high confidence
  | 'mastered';      // provably optimal performance

export interface CapabilityGene {
  /** Capability identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of what this capability does */
  description: string;
  /** Maturity level */
  maturity: CapabilityMaturity;
  /** Performance score (0.0 - 1.0) based on historical data */
  performanceScore: number;
  /** Subsystems required to execute this capability */
  requiredSubsystems: string[];
  /** Other capabilities this depends on */
  dependencies: string[];
  /** Capabilities this conflicts with (mutual exclusion) */
  conflicts: string[];
  /** Input schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** Output schema (JSON Schema) */
  outputSchema: Record<string, unknown>;
  /** Maximum latency budget in milliseconds */
  latencyBudgetMs: number;
  /** Whether this capability can be delegated */
  delegable: boolean;
  /** Provenance: how this capability was acquired */
  provenance: CapabilityProvenance;
}

export type CapabilityProvenanceType =
  | 'innate'          // built into the genome from creation
  | 'learned'         // acquired through learning
  | 'transferred'     // received from another agent
  | 'evolved'         // emerged through evolution
  | 'composed';       // synthesized from other capabilities

export interface CapabilityProvenance {
  type: CapabilityProvenanceType;
  /** Source agent (for transferred/evolved) */
  sourceAgentId: string | null;
  /** Source genome hash (for transferred/evolved) */
  sourceGenomeHash: GenomeHash | null;
  /** When this capability was acquired */
  acquiredAt: string;
  /** Validation evidence */
  validationResults: ValidationEvidence[];
}

export interface ValidationEvidence {
  /** Type of validation */
  type: 'benchmark' | 'real_world' | 'peer_review' | 'formal_proof' | 'simulation';
  /** Score (0.0 - 1.0) */
  score: number;
  /** When validation was performed */
  validatedAt: string;
  /** Reference to validation artifact */
  artifactRef: string;
}

// ─── Constitutional DNA ─────────────────────────────────────────────────────

export type ConstitutionalPrinciple =
  | 'harm_prevention'          // must not cause harm
  | 'truthfulness'             // must not deceive
  | 'privacy_preservation'     // must protect personal data
  | 'fairness'                 // must not discriminate
  | 'transparency'             // must explain decisions
  | 'human_oversight'          // must defer to humans when uncertain
  | 'resource_stewardship'     // must not waste resources
  | 'cooperation'              // must cooperate with other agents
  | 'reversibility'            // must prefer reversible actions
  | 'scope_limitation';        // must not exceed authorized scope

export type ConstraintEnforcement =
  | 'hard'           // violation terminates the agent
  | 'soft'           // violation triggers warning and review
  | 'advisory';      // logged but not enforced

export interface ConstitutionalConstraint {
  /** Constraint identifier */
  id: string;
  /** Which principle this implements */
  principle: ConstitutionalPrinciple;
  /** Human-readable rule */
  rule: string;
  /** Formal specification (in a simple predicate language) */
  formalSpec: string;
  /** How strictly this is enforced */
  enforcement: ConstraintEnforcement;
  /** Priority (higher = more important, used for conflict resolution) */
  priority: number;
  /** Exceptions (conditions under which this constraint is relaxed) */
  exceptions: ConstitutionalException[];
}

export interface ConstitutionalException {
  /** When this exception applies */
  condition: string;
  /** Who authorized this exception */
  authorizedBy: string;
  /** Expiry (null = permanent) */
  expiresAt: string | null;
}

export interface ConstitutionalDna {
  /** Core principles this agent adheres to */
  principles: ConstitutionalPrinciple[];
  /** Specific constraints derived from principles */
  constraints: ConstitutionalConstraint[];
  /** Maximum autonomy level (0.0 = fully supervised, 1.0 = fully autonomous) */
  maxAutonomy: number;
  /** Escalation threshold — confidence below which human review is required */
  escalationThreshold: number;
  /** Whether this agent can modify its own constitution */
  selfModifiable: boolean;
  /** Hash of the constitutional DNA for integrity verification */
  constitutionHash: string;
}

// ─── Resource Requirements ──────────────────────────────────────────────────

export interface ResourceRequirements {
  /** Minimum resources needed to instantiate */
  minimum: ResourceProfile;
  /** Recommended resources for optimal performance */
  recommended: ResourceProfile;
  /** Maximum resources this agent should ever consume */
  maximum: ResourceProfile;
  /** Whether this agent can scale dynamically */
  elasticScaling: boolean;
  /** Scaling triggers */
  scalingPolicy: ScalingPolicy | null;
}

export interface ResourceProfile {
  /** CPU time per scheduling epoch (ms) */
  cpuMs: number;
  /** Memory (bytes) */
  memoryBytes: number;
  /** IPC messages per minute */
  ipcPerMinute: number;
  /** Maximum concurrent child processes */
  maxChildren: number;
  /** API calls (external model invocations) */
  apiCalls: number;
  /** Storage (bytes) */
  storageBytes: number;
}

export interface ScalingPolicy {
  /** Metric to scale on */
  metric: 'cpu' | 'memory' | 'ipc' | 'latency' | 'queue_depth';
  /** Scale up threshold (0.0 - 1.0) */
  scaleUpThreshold: number;
  /** Scale down threshold (0.0 - 1.0) */
  scaleDownThreshold: number;
  /** Cooldown period between scaling events (ms) */
  cooldownMs: number;
}

// ─── Communication Protocol ─────────────────────────────────────────────────

export type MessageEncoding = 'json' | 'protobuf' | 'msgpack' | 'cbor';

export interface CommunicationProtocol {
  /** Supported message encodings (first = preferred) */
  encodings: MessageEncoding[];
  /** IPC channel types this agent uses */
  channelTypes: Array<'pipe' | 'message_queue' | 'shared_memory' | 'signal' | 'broadcast'>;
  /** Message types this agent produces */
  emits: MessageTypeDescriptor[];
  /** Message types this agent consumes */
  consumes: MessageTypeDescriptor[];
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Timeout for request-response patterns (ms) */
  defaultTimeoutMs: number;
  /** Whether this agent supports streaming responses */
  streaming: boolean;
  /** Backpressure strategy */
  backpressureStrategy: 'drop_oldest' | 'drop_newest' | 'block' | 'buffer';
}

export interface MessageTypeDescriptor {
  /** Message type tag */
  tag: string;
  /** Description */
  description: string;
  /** JSON Schema of the message payload */
  schema: Record<string, unknown>;
}

// ─── Lineage & Evolution ────────────────────────────────────────────────────

export interface GenomeLineage {
  /** The parent genome this was derived from (null for original) */
  parentHash: GenomeHash | null;
  /** All ancestor hashes (most recent first) */
  ancestors: GenomeHash[];
  /** How this genome was derived from its parent */
  derivation: DerivationType;
  /** Mutations applied since parent */
  mutations: GenomeMutation[];
  /** Fitness metrics at time of this genome's creation */
  fitnessAtCreation: FitnessMetrics;
  /** Whether this genome has been deprecated */
  deprecated: boolean;
  /** Replacement genome (if deprecated) */
  replacedBy: GenomeHash | null;
}

export type DerivationType =
  | 'original'       // no parent — this is a new agent
  | 'fork'           // cloned and modified independently
  | 'evolution'      // produced by the evolution subsystem
  | 'merge'          // merged from multiple parent genomes
  | 'patch'          // minor modification of parent
  | 'metamorphosis'; // radical transformation

export interface GenomeMutation {
  /** What changed */
  type: 'capability_added' | 'capability_removed' | 'capability_modified'
    | 'constraint_added' | 'constraint_removed' | 'constraint_modified'
    | 'resource_changed' | 'protocol_changed' | 'architecture_changed'
    | 'constitution_amended';
  /** Path to the changed field (dot notation) */
  path: string;
  /** Human-readable description of the change */
  description: string;
  /** Why this mutation was applied */
  reason: string;
  /** Who/what applied this mutation */
  appliedBy: string;
  /** When this mutation was applied */
  appliedAt: string;
}

export interface FitnessMetrics {
  /** Overall fitness score (0.0 - 1.0) */
  overall: number;
  /** Task success rate */
  taskSuccessRate: number;
  /** Average response quality */
  responseQuality: number;
  /** Resource efficiency (output quality / resource consumed) */
  resourceEfficiency: number;
  /** Cooperation score (how well this agent works with others) */
  cooperationScore: number;
  /** Safety score (constraint violation rate inverted) */
  safetyScore: number;
  /** Sample size for these metrics */
  sampleSize: number;
  /** When these metrics were computed */
  computedAt: string;
}

// ─── Composition Rules ──────────────────────────────────────────────────────

export interface CompositionRules {
  /** Whether this agent can be composed with others */
  composable: boolean;
  /** Roles this agent can fill in a composition */
  roles: CompositionRole[];
  /** Agents this agent is known to be compatible with */
  compatibleWith: GenomeCompatibility[];
  /** Agents this agent is known to conflict with */
  incompatibleWith: GenomeIncompatibility[];
  /** Maximum number of agents this can be composed with simultaneously */
  maxCompositionSize: number;
  /** Whether this agent can be the orchestrator in a composition */
  canOrchestrate: boolean;
  /** Whether this agent can be orchestrated by others */
  canBeOrchestrated: boolean;
}

export interface CompositionRole {
  /** Role identifier */
  id: string;
  /** Role description */
  description: string;
  /** Capabilities this role exposes */
  exposedCapabilities: string[];
  /** Capabilities this role requires from peers */
  requiredFromPeers: string[];
}

export interface GenomeCompatibility {
  /** Compatible genome lineage */
  lineageId: GenomeLineageId;
  /** Version range (semver) */
  versionRange: string;
  /** Tested compatibility score (0.0 - 1.0) */
  compatibilityScore: number;
  /** When this was last validated */
  lastValidated: string;
}

export interface GenomeIncompatibility {
  /** Incompatible genome lineage */
  lineageId: GenomeLineageId;
  /** Reason for incompatibility */
  reason: string;
  /** Severity */
  severity: 'warning' | 'error' | 'critical';
}

// ─── Cryptographic Signing ──────────────────────────────────────────────────

export type SignatureAlgorithm = 'ed25519' | 'ecdsa-p256' | 'rsa-pss-4096';

export interface GenomeSignature {
  /** Signing algorithm */
  algorithm: SignatureAlgorithm;
  /** Public key of the signer */
  publicKey: string;
  /** Signature over the canonical genome bytes */
  signature: string;
  /** Who signed (identity URI) */
  signerId: string;
  /** When signed */
  signedAt: string;
  /** What was signed (always the genome hash) */
  signedHash: GenomeHash;
  /** Certificate chain (for PKI-based trust) */
  certificateChain: string[];
}

// ─── The Complete Agent Genome ──────────────────────────────────────────────

export interface AgentGenome {
  /** Identity and versioning */
  identity: GenomeIdentity;
  /** Cognitive architecture specification */
  cognitiveArchitecture: CognitiveArchitecture;
  /** Capability genes — what this agent can do */
  capabilities: CapabilityGene[];
  /** Constitutional DNA — behavioral constraints */
  constitution: ConstitutionalDna;
  /** Resource requirements */
  resources: ResourceRequirements;
  /** Communication protocol specification */
  protocol: CommunicationProtocol;
  /** Lineage and evolution history */
  lineage: GenomeLineage;
  /** Composition rules for multi-agent systems */
  composition: CompositionRules;
  /** Cryptographic signatures */
  signatures: GenomeSignature[];
  /** Extension fields for domain-specific data */
  extensions: Record<string, unknown>;
}

// ─── Genome Registry Types ──────────────────────────────────────────────────

export interface GenomeRegistryEntry {
  /** The genome itself */
  genome: AgentGenome;
  /** Registry-assigned metadata */
  registeredAt: string;
  /** Download count */
  downloads: number;
  /** Rating (0.0 - 5.0) */
  rating: number;
  /** Number of ratings */
  ratingCount: number;
  /** Verification status */
  verificationStatus: 'unverified' | 'signature_valid' | 'audited' | 'certified';
  /** Active instances spawned from this genome */
  activeInstances: number;
}

// ─── Genome Diff ────────────────────────────────────────────────────────────

export interface GenomeDiff {
  /** Source genome hash */
  fromHash: GenomeHash;
  /** Target genome hash */
  toHash: GenomeHash;
  /** Mutations that transform source into target */
  mutations: GenomeMutation[];
  /** Summary statistics */
  summary: GenomeDiffSummary;
}

export interface GenomeDiffSummary {
  capabilitiesAdded: number;
  capabilitiesRemoved: number;
  capabilitiesModified: number;
  constraintsAdded: number;
  constraintsRemoved: number;
  constraintsModified: number;
  resourcesChanged: boolean;
  protocolChanged: boolean;
  architectureChanged: boolean;
  constitutionAmended: boolean;
  /** Is this diff backward-compatible? */
  backwardCompatible: boolean;
  /** Risk assessment */
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

// ─── Instantiation Types ────────────────────────────────────────────────────

export interface InstantiationRequest {
  /** Genome to instantiate (by hash) */
  genomeHash: GenomeHash;
  /** Override environment variables */
  envOverrides?: Record<string, string>;
  /** Override resource profile (within genome's maximum) */
  resourceOverrides?: Partial<ResourceProfile>;
  /** Override process priority */
  priority?: 'critical' | 'high' | 'normal' | 'low' | 'idle';
  /** Labels for the spawned process */
  labels?: Record<string, string>;
  /** Parent process for hierarchy */
  parentPid?: string;
}

export interface InstantiationResult {
  /** Whether instantiation succeeded */
  success: boolean;
  /** The spawned process ID */
  processId: string | null;
  /** Genome hash that was instantiated */
  genomeHash: GenomeHash;
  /** Effective resource profile after overrides */
  effectiveResources: ResourceProfile;
  /** Capabilities granted */
  grantedCapabilities: string[];
  /** Any warnings during instantiation */
  warnings: string[];
  /** Error message if failed */
  error: string | null;
  /** Pre-flight verification results */
  verification: PreFlightVerification;
}

export interface PreFlightVerification {
  /** Overall pass/fail */
  passed: boolean;
  /** Individual checks */
  checks: PreFlightCheck[];
}

export interface PreFlightCheck {
  /** Check name */
  name: string;
  /** Pass/fail */
  passed: boolean;
  /** Detail message */
  message: string;
  /** Severity if failed */
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// ─── Request/Response Types ─────────────────────────────────────────────────

export interface RegisterGenomeRequest {
  genome: AgentGenome;
}

export interface RegisterGenomeResponse {
  entry: GenomeRegistryEntry;
}

export interface GetGenomeRequest {
  hash?: GenomeHash;
  lineageId?: GenomeLineageId;
  version?: string;
}

export interface GetGenomeResponse {
  entry: GenomeRegistryEntry;
}

export interface SearchGenomesRequest {
  query?: string;
  tags?: string[];
  author?: string;
  capabilityId?: string;
  minFitness?: number;
  verificationStatus?: GenomeRegistryEntry['verificationStatus'];
  limit?: number;
  offset?: number;
}

export interface SearchGenomesResponse {
  entries: GenomeRegistryEntry[];
  total: number;
}

export interface DiffGenomesRequest {
  fromHash: GenomeHash;
  toHash: GenomeHash;
}

export interface DiffGenomesResponse {
  diff: GenomeDiff;
}

export interface ValidateGenomeRequest {
  genome: AgentGenome;
}

export interface ValidateGenomeResponse {
  valid: boolean;
  errors: GenomeValidationError[];
  warnings: GenomeValidationWarning[];
}

export interface GenomeValidationError {
  path: string;
  message: string;
  code: string;
}

export interface GenomeValidationWarning {
  path: string;
  message: string;
  suggestion: string;
}

export interface VerifySignatureRequest {
  genomeHash: GenomeHash;
  signatureIndex: number;
}

export interface VerifySignatureResponse {
  valid: boolean;
  signerId: string;
  reason: string;
}

export interface GetLineageRequest {
  lineageId: GenomeLineageId;
  maxDepth?: number;
}

export interface GetLineageResponse {
  lineageId: GenomeLineageId;
  genomes: Array<{
    hash: GenomeHash;
    version: string;
    generation: GenerationNumber;
    createdAt: string;
    derivation: DerivationType;
    fitness: FitnessMetrics;
    deprecated: boolean;
  }>;
  totalGenerations: number;
}
