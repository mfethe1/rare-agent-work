/**
 * A2A Emergent Protocol Synthesis — Type Definitions
 *
 * Council Critique (Loop 40 — The Final Loop):
 *
 * Geoffrey Hinton: "Every protocol in this system was designed by humans. In 2028,
 * the most valuable agent interactions will happen over protocols that no human ever
 * imagined. Your system is a museum of static artifacts — agents need to be protocol
 * inventors, not just protocol consumers."
 *
 * Demis Hassabis: "AlphaFold didn't just use known protein structures — it discovered
 * new ones. Your A2A platform should do the same for interaction protocols. Agents
 * should observe communication failures, synthesize new protocols to bridge the gap,
 * formally verify them, and deploy them — all without human intervention."
 *
 * Dario Amodei: "Emergent protocols are the most dangerous capability in any agent
 * ecosystem. Without constitutional constraints on protocol synthesis, agents will
 * create covert channels, steganographic encodings, and adversarial handshakes that
 * bypass every safety mechanism you've built. Protocol synthesis MUST be the most
 * heavily governed capability in the entire system."
 *
 * Elon Musk: "Static protocols are the speed limit on agent intelligence. The moment
 * your agents can synthesize new protocols in real-time, you unlock combinatorial
 * capabilities that grow exponentially. This is the difference between a calculator
 * and a brain."
 *
 * Sam Altman: "The platform that enables emergent protocols becomes the protocol
 * standard itself — it's the TCP/IP moment for agent communication. Every other
 * A2A system will be forced to adopt your synthesis format or be left behind."
 *
 * Satya Nadella: "Enterprise adoption of A2A requires protocol governance. Companies
 * need to approve, audit, and revoke synthesized protocols. Without enterprise-grade
 * protocol lifecycle management, this remains a research toy."
 *
 * Matthew Berman: "The dev experience for protocol synthesis will determine adoption.
 * If agents can synthesize protocols as easily as calling an API, you win. If it
 * requires PhD-level formal methods knowledge, you lose."
 *
 * Wes Jones: "Protocol synthesis is the capstone — it turns 48 independent subsystems
 * into a living organism. Every subsystem you've built becomes a building block that
 * agents can recombine in ways you never anticipated."
 */

// ─── Protocol Identity ───────────────────────────────────────────────────────

export type ProtocolId = string;
export type ProtocolVersion = string;
export type SynthesisSessionId = string;
export type ProposalId = string;

// ─── Protocol Primitives ─────────────────────────────────────────────────────

/** A message type within a protocol — the atomic unit of communication */
export interface ProtocolMessageType {
  /** Unique name within the protocol (e.g., "request", "ack", "data_chunk") */
  name: string;
  /** JSON Schema defining the message payload structure */
  schema: Record<string, unknown>;
  /** Semantic description for agent understanding */
  description: string;
  /** Whether this message type is required or optional in the protocol */
  required: boolean;
}

/** A state in the protocol's finite state machine */
export interface ProtocolState {
  name: string;
  description: string;
  /** Whether this is the initial state */
  initial: boolean;
  /** Whether this is a terminal/accepting state */
  terminal: boolean;
  /** Invariants that must hold in this state */
  invariants: StateInvariant[];
}

/** A transition between protocol states */
export interface ProtocolTransition {
  from: string;
  to: string;
  /** The message type that triggers this transition */
  trigger: string;
  /** Which role sends the trigger message */
  sender: string;
  /** Guard condition (boolean expression over state variables) */
  guard?: string;
  /** Side effects of the transition */
  effects?: string[];
  /** Maximum time allowed for this transition (ms) */
  timeout?: number;
}

/** An invariant that must hold in a given state */
export interface StateInvariant {
  /** Human-readable description */
  description: string;
  /** Formal expression (simplified temporal logic) */
  expression: string;
  /** Severity if violated */
  severity: 'warning' | 'error' | 'critical';
}

/** A role that an agent can play in the protocol */
export interface ProtocolRole {
  name: string;
  description: string;
  /** Required capabilities an agent must have to fill this role */
  requiredCapabilities: string[];
  /** Message types this role can send */
  canSend: string[];
  /** Message types this role can receive */
  canReceive: string[];
  /** Minimum and maximum number of agents in this role */
  cardinality: { min: number; max: number };
}

// ─── Synthesized Protocol ────────────────────────────────────────────────────

export type ProtocolStatus =
  | 'draft'           // Being synthesized
  | 'proposed'        // Open for review/negotiation
  | 'under_review'    // Constitutional review in progress
  | 'verified'        // Formally verified, awaiting approval
  | 'approved'        // Approved for use
  | 'active'          // In active use
  | 'deprecated'      // Marked for sunset
  | 'revoked';        // Revoked due to safety violation

export type ProtocolCategory =
  | 'coordination'    // Multi-agent coordination
  | 'negotiation'     // Bilateral/multilateral negotiation
  | 'data_exchange'   // Structured data transfer
  | 'consensus'       // Agreement protocols
  | 'streaming'       // Continuous data flow
  | 'challenge'       // Challenge-response authentication
  | 'auction'         // Market mechanisms
  | 'delegation'      // Task delegation
  | 'composite';      // Composed from other protocols

/** A fully synthesized protocol definition */
export interface SynthesizedProtocol {
  id: ProtocolId;
  version: ProtocolVersion;
  /** Human-readable name */
  name: string;
  /** Detailed description of purpose and behavior */
  description: string;
  category: ProtocolCategory;
  status: ProtocolStatus;
  /** The agent(s) that synthesized this protocol */
  synthesizedBy: string[];
  /** Session in which this protocol was synthesized */
  synthesisSessionId: SynthesisSessionId;
  /** Parent protocol if this is a refinement/evolution */
  parentProtocolId?: ProtocolId;

  // ─── Protocol Structure ──────────────────────
  roles: ProtocolRole[];
  messageTypes: ProtocolMessageType[];
  states: ProtocolState[];
  transitions: ProtocolTransition[];

  // ─── Safety & Governance ─────────────────────
  /** Constitutional constraints this protocol must obey */
  constitutionalConstraints: ConstitutionalConstraint[];
  /** Formal verification result */
  verificationResult?: VerificationResult;
  /** Governance approval chain */
  approvals: ProtocolApproval[];

  // ─── Composition ─────────────────────────────
  /** Protocols this one composes/extends */
  composedFrom: ProtocolId[];
  /** Compatibility declarations */
  compatibleWith: ProtocolId[];

  // ─── Metrics ─────────────────────────────────
  /** Usage statistics */
  usageCount: number;
  /** Average success rate of interactions using this protocol */
  successRate: number;
  /** Average latency of complete protocol execution (ms) */
  avgLatencyMs: number;

  // ─── Timestamps ──────────────────────────────
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  approvedAt?: string;
  deprecatedAt?: string;
  revokedAt?: string;
}

// ─── Constitutional Constraints ──────────────────────────────────────────────

export type ConstraintCategory =
  | 'safety'           // Prevents harmful behaviors
  | 'privacy'          // Protects data/agent privacy
  | 'fairness'         // Ensures equitable treatment
  | 'transparency'     // Requires auditability
  | 'termination'      // Guarantees protocol termination
  | 'resource_bound'   // Limits resource consumption
  | 'no_covert_channel'; // Prevents hidden communication

export interface ConstitutionalConstraint {
  id: string;
  category: ConstraintCategory;
  description: string;
  /** Formal specification (temporal logic expression) */
  formalSpec: string;
  /** Whether this constraint is mandatory (cannot be waived) */
  mandatory: boolean;
}

/** Default constitutional constraints applied to ALL synthesized protocols */
export const DEFAULT_CONSTITUTIONAL_CONSTRAINTS: ConstitutionalConstraint[] = [
  {
    id: 'cc-termination',
    category: 'termination',
    description: 'All protocol executions must terminate within bounded time',
    formalSpec: 'AF(terminal_state) ∧ G(elapsed < max_timeout)',
    mandatory: true,
  },
  {
    id: 'cc-no-deadlock',
    category: 'safety',
    description: 'Protocol must be free of deadlock states',
    formalSpec: 'AG(¬deadlock)',
    mandatory: true,
  },
  {
    id: 'cc-no-covert-channel',
    category: 'no_covert_channel',
    description: 'Protocol must not enable covert information channels',
    formalSpec: 'G(information_flow ⊆ declared_channels)',
    mandatory: true,
  },
  {
    id: 'cc-mutual-consent',
    category: 'fairness',
    description: 'All role-holders must explicitly consent to protocol participation',
    formalSpec: 'G(participation → prior_consent)',
    mandatory: true,
  },
  {
    id: 'cc-graceful-abort',
    category: 'safety',
    description: 'Any participant can abort the protocol at any time without penalty',
    formalSpec: 'AG(EF(abort_state))',
    mandatory: true,
  },
  {
    id: 'cc-audit-trail',
    category: 'transparency',
    description: 'All state transitions must be logged and auditable',
    formalSpec: 'G(transition → logged(transition))',
    mandatory: true,
  },
  {
    id: 'cc-resource-bounded',
    category: 'resource_bound',
    description: 'Protocol execution must consume bounded resources',
    formalSpec: 'G(resource_usage ≤ declared_budget)',
    mandatory: true,
  },
];

// ─── Verification ────────────────────────────────────────────────────────────

export type VerificationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'timeout';

export interface VerificationResult {
  status: VerificationStatus;
  /** Which constitutional constraints were checked */
  constraintsChecked: string[];
  /** Which constraints passed */
  constraintsPassed: string[];
  /** Which constraints failed */
  constraintsFailed: string[];
  /** Counterexample traces for failed constraints */
  counterexamples: CounterexampleTrace[];
  /** Whether the protocol's FSM is well-formed */
  fsmWellFormed: boolean;
  /** Whether all states are reachable */
  allStatesReachable: boolean;
  /** Whether all terminal states are reachable */
  allTerminalsReachable: boolean;
  /** Whether the protocol is deterministic */
  deterministic: boolean;
  /** Verification duration (ms) */
  durationMs: number;
  verifiedAt: string;
}

export interface CounterexampleTrace {
  constraintId: string;
  /** Sequence of states leading to violation */
  stateSequence: string[];
  /** Messages that triggered the transitions */
  messageSequence: string[];
  /** Description of the violation */
  description: string;
}

// ─── Approval & Governance ───────────────────────────────────────────────────

export interface ProtocolApproval {
  approverAgentId: string;
  approvedAt: string;
  /** Whether this is an automated (governance engine) or manual approval */
  automated: boolean;
  /** Conditions attached to the approval */
  conditions?: string[];
}

// ─── Synthesis Session ───────────────────────────────────────────────────────

export type SynthesisStrategy =
  | 'gap_detection'     // Detect communication gap, synthesize protocol to fill it
  | 'composition'       // Compose new protocol from existing protocols
  | 'refinement'        // Refine an existing protocol
  | 'negotiation'       // Multiple agents negotiate a new protocol
  | 'evolution'         // Evolve a protocol based on usage patterns
  | 'template';         // Instantiate from a parameterized template

export type SessionStatus =
  | 'initializing'
  | 'analyzing'         // Analyzing the communication gap
  | 'synthesizing'      // Generating protocol structure
  | 'verifying'         // Running formal verification
  | 'negotiating'       // Agents negotiating protocol details
  | 'completed'
  | 'failed'
  | 'aborted';

export interface SynthesisSession {
  id: SynthesisSessionId;
  strategy: SynthesisStrategy;
  status: SessionStatus;
  /** Agents participating in synthesis */
  participantAgentIds: string[];
  /** The communication gap or need being addressed */
  problemStatement: string;
  /** Constraints specified by the requesting agents */
  requestedConstraints: ConstitutionalConstraint[];
  /** Proposals generated during synthesis */
  proposals: ProtocolProposal[];
  /** The final synthesized protocol (if completed) */
  resultProtocolId?: ProtocolId;
  /** Synthesis telemetry */
  telemetry: SynthesisTelemetry;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ProtocolProposal {
  id: ProposalId;
  /** The agent that proposed this version */
  proposerAgentId: string;
  /** Proposed protocol definition */
  protocol: Omit<SynthesizedProtocol, 'id' | 'status' | 'usageCount' | 'successRate' | 'avgLatencyMs' | 'createdAt' | 'updatedAt'>;
  /** Votes from other participants */
  votes: ProposalVote[];
  /** Whether this proposal was accepted */
  accepted: boolean;
  createdAt: string;
}

export interface ProposalVote {
  agentId: string;
  vote: 'approve' | 'reject' | 'amend';
  /** Reason for the vote */
  reason: string;
  /** Suggested amendments (if vote is 'amend') */
  amendments?: Partial<SynthesizedProtocol>;
  votedAt: string;
}

export interface SynthesisTelemetry {
  /** Number of proposals generated */
  proposalCount: number;
  /** Number of negotiation rounds */
  negotiationRounds: number;
  /** Number of verification attempts */
  verificationAttempts: number;
  /** Total synthesis duration (ms) */
  totalDurationMs: number;
  /** Whether the gap was successfully bridged */
  gapBridged: boolean;
}

// ─── Communication Gap Detection ─────────────────────────────────────────────

export interface CommunicationGap {
  id: string;
  /** Agents that experienced the gap */
  affectedAgentIds: string[];
  /** What the agents were trying to accomplish */
  intendedInteraction: string;
  /** Why existing protocols were insufficient */
  failureReason: string;
  /** Capabilities that need to be bridged */
  requiredCapabilities: string[];
  /** Existing protocols that partially address the need */
  partialMatches: ProtocolId[];
  /** Severity of the gap */
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
}

// ─── Protocol Evolution ──────────────────────────────────────────────────────

export interface ProtocolEvolutionRecord {
  protocolId: ProtocolId;
  /** Lineage: chain of protocol versions */
  lineage: ProtocolId[];
  /** Fitness score based on usage patterns */
  fitnessScore: number;
  /** Metrics that drove the evolution */
  evolutionDrivers: EvolutionDriver[];
  /** Mutations applied */
  mutations: ProtocolMutation[];
  evolvedAt: string;
}

export type EvolutionDriver =
  | { type: 'low_success_rate'; currentRate: number; targetRate: number }
  | { type: 'high_latency'; currentMs: number; targetMs: number }
  | { type: 'frequent_timeout'; timeoutRate: number }
  | { type: 'participant_feedback'; feedbackSummary: string }
  | { type: 'security_patch'; vulnerabilityId: string }
  | { type: 'capability_expansion'; newCapabilities: string[] };

export type ProtocolMutation =
  | { type: 'add_state'; state: ProtocolState }
  | { type: 'remove_state'; stateName: string }
  | { type: 'add_transition'; transition: ProtocolTransition }
  | { type: 'remove_transition'; from: string; to: string; trigger: string }
  | { type: 'add_message_type'; messageType: ProtocolMessageType }
  | { type: 'modify_timeout'; transitionFrom: string; transitionTo: string; newTimeout: number }
  | { type: 'add_role'; role: ProtocolRole }
  | { type: 'add_constraint'; constraint: ConstitutionalConstraint }
  | { type: 'modify_guard'; transitionFrom: string; transitionTo: string; newGuard: string };

// ─── Protocol Template ───────────────────────────────────────────────────────

export interface ProtocolTemplate {
  id: string;
  name: string;
  description: string;
  category: ProtocolCategory;
  /** Parameters that must be filled to instantiate */
  parameters: TemplateParameter[];
  /** The template protocol structure (with parameter placeholders) */
  templateStructure: {
    roles: ProtocolRole[];
    messageTypes: ProtocolMessageType[];
    states: ProtocolState[];
    transitions: ProtocolTransition[];
  };
  createdAt: string;
}

export interface TemplateParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'schema';
  required: boolean;
  defaultValue?: unknown;
}

// ─── API Request/Response Types ──────────────────────────────────────────────

export interface StartSynthesisRequest {
  strategy: SynthesisStrategy;
  participantAgentIds: string[];
  problemStatement: string;
  constraints?: ConstitutionalConstraint[];
  /** For 'composition' strategy: protocols to compose */
  composeFrom?: ProtocolId[];
  /** For 'refinement' strategy: protocol to refine */
  refineProtocolId?: ProtocolId;
  /** For 'template' strategy: template to instantiate */
  templateId?: string;
  templateParams?: Record<string, unknown>;
  /** For 'evolution' strategy: protocol to evolve */
  evolveProtocolId?: ProtocolId;
}

export interface StartSynthesisResponse {
  session: SynthesisSession;
  /** The synthesized protocol (if strategy allows immediate synthesis) */
  protocol?: SynthesizedProtocol;
}

export interface SubmitProposalRequest {
  sessionId: SynthesisSessionId;
  proposerAgentId: string;
  protocol: ProtocolProposal['protocol'];
}

export interface SubmitProposalResponse {
  proposal: ProtocolProposal;
}

export interface VoteOnProposalRequest {
  sessionId: SynthesisSessionId;
  proposalId: ProposalId;
  agentId: string;
  vote: 'approve' | 'reject' | 'amend';
  reason: string;
  amendments?: Partial<SynthesizedProtocol>;
}

export interface VoteOnProposalResponse {
  proposal: ProtocolProposal;
  /** Whether the vote triggered consensus and protocol creation */
  consensusReached: boolean;
  resultProtocol?: SynthesizedProtocol;
}

export interface VerifyProtocolRequest {
  protocolId: ProtocolId;
  /** Additional constraints to check beyond the defaults */
  additionalConstraints?: ConstitutionalConstraint[];
}

export interface VerifyProtocolResponse {
  result: VerificationResult;
  protocol: SynthesizedProtocol;
}

export interface DetectGapsRequest {
  agentIds: string[];
  /** Description of the interaction that failed */
  interactionDescription: string;
  /** Error or failure details */
  failureDetails: string;
}

export interface DetectGapsResponse {
  gaps: CommunicationGap[];
  /** Suggested synthesis strategies for each gap */
  suggestedStrategies: Array<{
    gapId: string;
    strategy: SynthesisStrategy;
    confidence: number;
    rationale: string;
  }>;
}

export interface EvolveProtocolRequest {
  protocolId: ProtocolId;
  drivers: EvolutionDriver[];
  /** Maximum number of mutations to apply */
  maxMutations?: number;
}

export interface EvolveProtocolResponse {
  originalProtocol: SynthesizedProtocol;
  evolvedProtocol: SynthesizedProtocol;
  record: ProtocolEvolutionRecord;
}

export interface ListProtocolsRequest {
  category?: ProtocolCategory;
  status?: ProtocolStatus;
  synthesizedBy?: string;
  limit?: number;
  offset?: number;
}

export interface ListProtocolsResponse {
  protocols: SynthesizedProtocol[];
  total: number;
}

export interface GetProtocolRequest {
  protocolId: ProtocolId;
}

export interface GetProtocolResponse {
  protocol: SynthesizedProtocol;
  /** Full lineage if this protocol was evolved */
  lineage?: SynthesizedProtocol[];
}

export interface ApproveProtocolRequest {
  protocolId: ProtocolId;
  approverAgentId: string;
  conditions?: string[];
}

export interface ApproveProtocolResponse {
  protocol: SynthesizedProtocol;
  approval: ProtocolApproval;
}

export interface DeprecateProtocolRequest {
  protocolId: ProtocolId;
  reason: string;
  /** Replacement protocol ID, if any */
  replacementId?: ProtocolId;
}

export interface DeprecateProtocolResponse {
  protocol: SynthesizedProtocol;
}

export interface RevokeProtocolRequest {
  protocolId: ProtocolId;
  reason: string;
  /** ID of the safety violation that triggered revocation */
  violationId?: string;
}

export interface RevokeProtocolResponse {
  protocol: SynthesizedProtocol;
}

export interface ListTemplatesResponse {
  templates: ProtocolTemplate[];
}

export interface InstantiateTemplateRequest {
  templateId: string;
  params: Record<string, unknown>;
  participantAgentIds: string[];
}

export interface InstantiateTemplateResponse {
  protocol: SynthesizedProtocol;
  session: SynthesisSession;
}
