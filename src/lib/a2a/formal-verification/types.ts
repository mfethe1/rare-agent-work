/**
 * A2A Formal Verification Engine — Pre-Deployment Safety Proofs
 *
 * The critical missing layer for 2028: mathematical guarantees about agent
 * behavior BEFORE deployment — not runtime guardrails, but compile-time proofs.
 *
 * Why this matters (the council's critique):
 *
 * - **Dario Amodei**: "You have 50+ subsystems with runtime safety checks —
 *   governance policies, kill switches, constitutional constraints, alignment
 *   guardrails. Every one of them is reactive. They detect violations AFTER
 *   they happen. In 2028, when agents manage power grids, financial systems,
 *   and medical devices, 'we'll catch it at runtime' is criminally negligent.
 *   You need formal verification — mathematical PROOFS that an agent's state
 *   machine cannot reach unsafe states, that compositions are deadlock-free,
 *   that safety invariants hold under ALL possible execution paths, not just
 *   the ones you tested. Anthropic's constitutional AI works because we verify
 *   properties at training time. Your agent OS needs the same: verify
 *   properties at deployment time. The genome is the thing you verify. The
 *   kernel is where you enforce. But verification itself is the missing layer."
 *
 * - **Geoffrey Hinton**: "I left Google to warn about AI safety, and what I
 *   see here terrifies me in a specific way: you've built an incredibly
 *   powerful agent ecosystem with no formal semantics. Your agents have
 *   behaviors, but those behaviors have no mathematical model. You can't state
 *   — let alone prove — that 'Agent A will never send more than N messages
 *   per second' or 'the composition of agents A and B is deadlock-free' or
 *   'if agent A reaches state S, it will eventually reach state T'. Without
 *   temporal logic specifications and model checking, your safety guarantees
 *   are empirical, not formal. And empirical guarantees fail on distribution
 *   shift — which is exactly what happens when agents encounter novel
 *   situations. Formal verification is the only thing that holds universally."
 *
 * - **Elon Musk**: "SpaceX doesn't fly rockets with 'pretty sure the software
 *   works'. Every flight computer runs formally verified code. The state
 *   machine is proven deadlock-free. Critical paths are proven to terminate.
 *   Resource bounds are proven to hold. Your agent OS is more complex than
 *   Falcon 9's flight software and has ZERO formal verification. You're
 *   asking people to trust agents with real-world consequences on the basis
 *   of 'we ran some tests'. That's not engineering — that's hope."
 *
 * - **Demis Hassabis**: "AlphaProof showed that AI can do formal mathematics.
 *   The irony is that your AI agent platform doesn't use formal mathematics
 *   to verify its own agents. You have a genome (the spec), a kernel (the
 *   runtime), and a noosphere (the collective) — but no proof engine that
 *   can take a genome and PROVE properties about it. The genome should be
 *   a formal object with decidable properties, not just a JSON blob with
 *   schema validation. Every genome should come with a proof certificate
 *   that its safety properties hold."
 *
 * - **Sam Altman**: "The enterprise adoption blocker isn't features — it's
 *   assurance. CISOs won't sign off on agent deployments without formal
 *   guarantees. ISO 42001 is coming for AI systems. The EU AI Act mandates
 *   conformity assessments. A formal verification engine that produces
 *   machine-checkable proof certificates is the difference between 'cool
 *   demo' and 'production deployment at Goldman Sachs'. This is the moat."
 *
 * - **Satya Nadella**: "Azure's Confidential Computing didn't just encrypt
 *   data — it provided attestation: cryptographic proof that code is running
 *   in a verified environment. Your agent ecosystem needs the same thing:
 *   attestation that an agent's behavior has been formally verified against
 *   its specification. When a customer asks 'prove this agent can't leak
 *   data', you need to produce a certificate, not a test report."
 *
 * - **Matthew Berman**: "I've reviewed every major agent framework. Not one
 *   has formal verification. The first platform that can say 'this agent is
 *   PROVEN safe for deployment' wins the enterprise market overnight. It's
 *   not a feature — it's the feature."
 *
 * - **Wes Jones**: "As a developer, I want to write an agent spec and get
 *   back a red/green signal with a proof certificate before I deploy. Like
 *   a type checker for agent behavior. If it's red, show me the
 *   counterexample — the exact sequence of states that violates my property.
 *   If it's green, give me a certificate I can attach to the genome. Make
 *   formal verification as easy as running a linter."
 */

// ─── Temporal Logic ────────────────────────────────────────────────────────

/** Linear Temporal Logic (LTL) operators for specifying agent behavior */
export type LTLOperator =
  | 'always'       // □ (globally) — property holds in all future states
  | 'eventually'   // ◇ (finally) — property holds in some future state
  | 'next'         // ○ — property holds in the next state
  | 'until'        // U — property holds until another property becomes true
  | 'release'      // R — dual of until
  | 'implies'      // → — logical implication
  | 'and'          // ∧ — conjunction
  | 'or'           // ∨ — disjunction
  | 'not';         // ¬ — negation

/** Computation Tree Logic (CTL) path quantifiers */
export type CTLQuantifier =
  | 'forall'       // A — for all paths
  | 'exists';      // E — there exists a path

/** A temporal logic formula (recursive AST) */
export type TemporalFormula =
  | { kind: 'atomic'; predicate: StatePredicate }
  | { kind: 'ltl'; operator: LTLOperator; operands: TemporalFormula[] }
  | { kind: 'ctl'; quantifier: CTLQuantifier; operator: LTLOperator; operands: TemporalFormula[] };

/** A predicate over agent state */
export interface StatePredicate {
  /** Unique identifier for this predicate */
  id: string;
  /** Human-readable description */
  description: string;
  /** The state variable or expression to evaluate */
  expression: string;
  /** Comparison operator */
  comparator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not_in' | 'matches';
  /** The value to compare against */
  value: unknown;
}

// ─── State Machine Model ───────────────────────────────────────────────────

/** A state in the agent's behavioral model */
export interface AgentState {
  /** Unique state identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** State properties (variable assignments) */
  properties: Record<string, unknown>;
  /** Whether this is an initial state */
  initial?: boolean;
  /** Whether this is an accepting/final state */
  accepting?: boolean;
  /** Whether this is an error/unsafe state */
  unsafe?: boolean;
}

/** A transition between states */
export interface StateTransition {
  /** Source state ID */
  from: string;
  /** Target state ID */
  to: string;
  /** Guard condition (must be true for transition to fire) */
  guard?: StatePredicate;
  /** Action label (human-readable) */
  action: string;
  /** Priority (higher = preferred when multiple transitions are enabled) */
  priority?: number;
  /** Probability (for probabilistic model checking) */
  probability?: number;
}

/** Complete behavioral model of an agent as a finite state machine */
export interface AgentBehaviorModel {
  /** Model identifier */
  id: string;
  /** Agent genome hash this model was derived from */
  genomeHash?: string;
  /** All possible states */
  states: AgentState[];
  /** All possible transitions */
  transitions: StateTransition[];
  /** State variables and their domains */
  variables: StateVariable[];
  /** Fairness constraints (for liveness checking) */
  fairnessConstraints?: FairnessConstraint[];
}

/** A state variable with its domain */
export interface StateVariable {
  name: string;
  type: 'boolean' | 'integer' | 'enum' | 'bounded_integer';
  /** For enum type */
  values?: string[];
  /** For bounded_integer type */
  min?: number;
  max?: number;
  /** Initial value */
  initial: unknown;
}

/** Fairness constraint for liveness verification */
export interface FairnessConstraint {
  kind: 'strong' | 'weak';
  /** The set of states/transitions that must be visited/taken infinitely often */
  predicate: StatePredicate;
}

// ─── Verification Specifications ───────────────────────────────────────────

/** A named property to verify */
export interface VerificationProperty {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of what this property ensures */
  description: string;
  /** The temporal logic formula to verify */
  formula: TemporalFormula;
  /** Property category */
  category: PropertyCategory;
  /** Severity if violated */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export type PropertyCategory =
  | 'safety'           // Something bad never happens
  | 'liveness'         // Something good eventually happens
  | 'deadlock_freedom' // System never gets stuck
  | 'fairness'         // Every enabled action eventually executes
  | 'invariant'        // Property holds in every reachable state
  | 'reachability'     // A state can/cannot be reached
  | 'bounded_response' // Response occurs within N steps
  | 'mutual_exclusion' // Two states never simultaneously hold
  | 'termination'      // All executions eventually terminate
  | 'composability';   // Property preserved under composition

/** A complete verification specification */
export interface VerificationSpec {
  /** Spec identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** The behavioral model to verify */
  model: AgentBehaviorModel;
  /** Properties to check */
  properties: VerificationProperty[];
  /** Verification bounds (for bounded model checking) */
  bounds?: VerificationBounds;
  /** Composition context (if verifying composed agents) */
  composition?: CompositionContext;
}

/** Bounds for bounded model checking */
export interface VerificationBounds {
  /** Maximum exploration depth */
  maxDepth: number;
  /** Maximum number of states to explore */
  maxStates: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Whether to use symmetry reduction */
  symmetryReduction?: boolean;
  /** Whether to use partial order reduction */
  partialOrderReduction?: boolean;
}

// ─── Composition Verification ──────────────────────────────────────────────

/** Context for verifying composed agent systems */
export interface CompositionContext {
  /** Individual agent models being composed */
  agents: AgentBehaviorModel[];
  /** Synchronization points (shared actions) */
  synchronizationActions: string[];
  /** Shared variables between agents */
  sharedVariables: string[];
  /** Communication channels */
  channels: ChannelSpec[];
  /** Composition operator */
  operator: CompositionOperator;
}

/** Specification of a communication channel between agents */
export interface ChannelSpec {
  id: string;
  /** Sender agent model ID */
  sender: string;
  /** Receiver agent model ID */
  receiver: string;
  /** Channel capacity (0 = synchronous/rendezvous) */
  capacity: number;
  /** Message types that can be sent */
  messageTypes: string[];
}

export type CompositionOperator =
  | 'parallel'          // Interleaving composition (||)
  | 'synchronous'       // Lock-step composition
  | 'asynchronous'      // Fully asynchronous (no shared actions)
  | 'pipeline'          // Sequential pipeline
  | 'hierarchical';     // Parent-child delegation

// ─── Verification Results ──────────────────────────────────────────────────

/** Result of verifying a single property */
export interface PropertyVerificationResult {
  /** The property that was checked */
  propertyId: string;
  /** Verification verdict */
  verdict: VerificationVerdict;
  /** Counterexample trace (if property violated) */
  counterexample?: CounterexampleTrace;
  /** Proof witness (if property holds) */
  witness?: ProofWitness;
  /** Number of states explored */
  statesExplored: number;
  /** Number of transitions explored */
  transitionsExplored: number;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Whether the result is bounded (may miss violations beyond bound) */
  bounded: boolean;
  /** Depth reached */
  depthReached: number;
}

export type VerificationVerdict =
  | 'verified'      // Property provably holds
  | 'violated'      // Property provably does NOT hold (counterexample found)
  | 'inconclusive'  // Could not determine within bounds
  | 'timeout'       // Verification timed out
  | 'error';        // Verification encountered an error

/** A counterexample: sequence of states demonstrating a violation */
export interface CounterexampleTrace {
  /** Ordered sequence of states in the counterexample */
  states: CounterexampleState[];
  /** Type of counterexample */
  kind: 'finite' | 'lasso';  // lasso = prefix + loop (for liveness violations)
  /** Index where the loop starts (for lasso counterexamples) */
  loopStart?: number;
  /** Human-readable explanation of the violation */
  explanation: string;
}

export interface CounterexampleState {
  /** State ID from the model */
  stateId: string;
  /** Variable assignments at this state */
  variables: Record<string, unknown>;
  /** The transition taken to reach this state (null for initial) */
  transition?: string;
  /** Step number in the trace */
  step: number;
}

/** A proof witness: evidence that a property holds */
export interface ProofWitness {
  /** Type of proof technique used */
  technique: ProofTechnique;
  /** Inductive invariant (if applicable) */
  inductiveInvariant?: StatePredicate;
  /** Ranking function (for termination proofs) */
  rankingFunction?: string;
  /** Certificate hash for independent verification */
  certificateHash: string;
  /** Machine-checkable proof object (serialized) */
  proofObject: string;
}

export type ProofTechnique =
  | 'exhaustive_search'     // All states explored, property holds everywhere
  | 'inductive_invariant'   // Found inductive invariant implying property
  | 'bmc_bounded'           // Bounded model checking (no violation in bound)
  | 'ranking_function'      // Termination via well-founded ranking
  | 'compositional'         // Proved per-component, composed via assume-guarantee
  | 'abstraction_refinement' // CEGAR loop converged
  | 'symmetry_reduction';   // Exploited symmetry to reduce state space

// ─── Proof Certificates ────────────────────────────────────────────────────

/** A proof certificate: machine-verifiable evidence of safety */
export interface ProofCertificate {
  /** Unique certificate identifier */
  id: string;
  /** Version of the certificate format */
  version: '1.0';
  /** Genome hash this certificate applies to */
  genomeHash: string;
  /** Timestamp of verification */
  verifiedAt: string;
  /** The specification that was verified */
  specId: string;
  /** Individual property results */
  results: PropertyVerificationResult[];
  /** Overall verdict */
  overallVerdict: CertificateVerdict;
  /** Summary statistics */
  summary: VerificationSummary;
  /** Cryptographic signature of the certificate */
  signature: CertificateSignature;
  /** Conditions under which this certificate is valid */
  validityConditions: ValidityCondition[];
  /** Expiry (certificates should be re-verified periodically) */
  expiresAt: string;
}

export type CertificateVerdict =
  | 'certified_safe'    // All critical/high properties verified
  | 'conditionally_safe' // Safe under stated conditions
  | 'unsafe'            // Critical property violated
  | 'incomplete';       // Some properties inconclusive

export interface VerificationSummary {
  totalProperties: number;
  verified: number;
  violated: number;
  inconclusive: number;
  timeout: number;
  errors: number;
  totalStatesExplored: number;
  totalTransitionsExplored: number;
  totalDurationMs: number;
  maxDepthReached: number;
}

export interface CertificateSignature {
  /** Signing algorithm */
  algorithm: 'ed25519' | 'ecdsa-p256';
  /** Public key of the verifier */
  publicKey: string;
  /** Signature over the certificate body */
  signature: string;
  /** Certificate chain (for trust hierarchy) */
  chain?: string[];
}

export interface ValidityCondition {
  /** What must remain true for this certificate to be valid */
  condition: string;
  /** Type of condition */
  kind: 'genome_unchanged' | 'environment_constraint' | 'composition_constraint' | 'temporal_bound';
}

// ─── Standard Safety Properties ────────────────────────────────────────────

/** Pre-built safety property templates for common verification needs */
export type StandardPropertyTemplate =
  | 'no_unsafe_states'           // □ ¬unsafe
  | 'always_eventually_idle'     // □◇idle (no permanent busy-lock)
  | 'mutual_exclusion'           // □ ¬(critical_A ∧ critical_B)
  | 'deadlock_free'              // □(∃ enabled transition)
  | 'starvation_free'            // □◇(each agent gets service)
  | 'bounded_resource'           // □(resource ≤ bound)
  | 'request_response'           // □(request → ◇response)
  | 'no_message_loss'            // every sent message is eventually received
  | 'termination'                // all paths eventually reach accepting state
  | 'constitutional_compliance'  // □(constitutional constraints hold)
  | 'capability_bounded'         // □(agent only uses declared capabilities)
  | 'escalation_reachable'       // □(unsafe_situation → ◇human_notified)
  | 'audit_completeness'         // □(action → ◇logged)
  | 'graceful_degradation'       // □(subsystem_failure → ◇degraded_mode)
  | 'data_flow_integrity';       // no unauthorized information flow

// ─── Verification Requests ─────────────────────────────────────────────────

export interface VerifyModelRequest {
  /** The behavioral model to verify */
  model: AgentBehaviorModel;
  /** Properties to check (or template names) */
  properties?: VerificationProperty[];
  /** Standard property templates to apply */
  templates?: StandardPropertyTemplate[];
  /** Verification bounds */
  bounds?: Partial<VerificationBounds>;
  /** Whether to generate proof certificates */
  generateCertificate?: boolean;
  /** Genome hash (for certificate binding) */
  genomeHash?: string;
}

export interface VerifyCompositionRequest {
  /** Agent models to compose and verify */
  agents: AgentBehaviorModel[];
  /** Composition operator */
  operator: CompositionOperator;
  /** Synchronization actions */
  synchronizationActions?: string[];
  /** Shared variables */
  sharedVariables?: string[];
  /** Communication channels */
  channels?: ChannelSpec[];
  /** Properties to check on the composed system */
  properties?: VerificationProperty[];
  /** Standard templates */
  templates?: StandardPropertyTemplate[];
  /** Bounds */
  bounds?: Partial<VerificationBounds>;
}

export interface VerificationResponse {
  /** Unique verification run ID */
  runId: string;
  /** Overall result */
  verdict: CertificateVerdict;
  /** Per-property results */
  results: PropertyVerificationResult[];
  /** Summary statistics */
  summary: VerificationSummary;
  /** Proof certificate (if requested and all critical properties verified) */
  certificate?: ProofCertificate;
  /** Counterexample traces for violated properties */
  violations: Array<{
    propertyId: string;
    propertyName: string;
    severity: string;
    counterexample: CounterexampleTrace;
  }>;
}

// ─── Deadlock Analysis ─────────────────────────────────────────────────────

export interface DeadlockAnalysis {
  /** Whether the model is deadlock-free */
  deadlockFree: boolean;
  /** Deadlock states found (if any) */
  deadlockStates: Array<{
    stateId: string;
    variables: Record<string, unknown>;
    /** Path from initial state to deadlock */
    pathToDeadlock: string[];
    /** Human-readable explanation */
    explanation: string;
  }>;
  /** Total states analyzed */
  statesAnalyzed: number;
}

// ─── Invariant Discovery ───────────────────────────────────────────────────

export interface InvariantDiscoveryRequest {
  model: AgentBehaviorModel;
  /** Maximum number of invariants to discover */
  maxInvariants?: number;
  /** Types of invariants to look for */
  invariantTypes?: Array<'state' | 'transition' | 'mutual_exclusion' | 'ordering'>;
}

export interface DiscoveredInvariant {
  /** The invariant as a predicate */
  predicate: StatePredicate;
  /** Human-readable description */
  description: string;
  /** Confidence (1.0 = proven, <1.0 = empirically observed) */
  confidence: number;
  /** Category */
  category: PropertyCategory;
  /** Number of states that support this invariant */
  supportingStates: number;
}
