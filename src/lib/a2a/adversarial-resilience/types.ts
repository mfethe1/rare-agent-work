/**
 * A2A Adversarial Resilience & Byzantine Immune System — Types
 *
 * The critical missing primitive for 2028: adversarial robustness at the
 * agent network layer. As agents autonomously compose (morphogenesis),
 * reason together (cognition), and transact (billing/contracts), the
 * attack surface grows combinatorially. The current system trusts too
 * easily — it has reputation and governance, but no formal adversarial
 * resilience framework.
 *
 * Why this matters (the council's critique):
 *
 * - **Geoffrey Hinton**: "You've built a nervous system with no immune
 *   system. Every biological network that survives has adversarial
 *   resilience baked into its architecture, not bolted on as governance."
 *
 * - **Dario Amodei**: "Alignment without adversarial robustness is
 *   security theater. When agents compose autonomously, a single
 *   compromised agent can cascade corruption through the entire mesh.
 *   You need cryptographic proof-of-integrity, not just trust scores."
 *
 * - **Demis Hassabis**: "Biological immune systems don't just detect
 *   known threats — they have adaptive immunity. Your agents need
 *   the equivalent of T-cells: agents that specialize in detecting
 *   novel adversarial patterns."
 *
 * - **Elon Musk**: "You wouldn't ship a self-driving car that can't
 *   handle adversarial road conditions. Why would you ship an agent
 *   network without Byzantine fault tolerance?"
 *
 * - **Sam Altman**: "The first major A2A security incident will set
 *   the entire ecosystem back years. Build the immune system now."
 *
 * - **Satya Nadella**: "Enterprise adoption requires zero-trust agent
 *   networking. Every agent output must be verifiable. Every agent
 *   interaction must be tamper-evident."
 *
 * Subsystems:
 *
 * 1. **Threat Detection** — Behavioral anomaly detection, prompt injection
 *    cascade detection, capability abuse patterns, Sybil attack identification.
 *
 * 2. **Byzantine Fault Tolerance** — Formal BFT voting for critical agent
 *    consensus. Tolerates up to f < n/3 malicious agents in any quorum.
 *    Cryptographic vote commitments prevent equivocation.
 *
 * 3. **Agent Quarantine** — Automatic isolation of suspicious agents with
 *    graduated response: shadow mode → restricted → quarantined → expelled.
 *    Preserves network integrity without false-positive agent loss.
 *
 * 4. **Integrity Proofs** — Merkle-tree based proof-of-integrity for agent
 *    outputs. Every agent action produces a verifiable hash chain. Consumers
 *    can independently verify output provenance and detect tampering.
 *
 * 5. **Immune Memory** — Adaptive threat intelligence that learns from
 *    past attacks. Threat signatures are shared across the network.
 *    Novel threats trigger immune response escalation.
 */

import type { AgentCapability } from '../types';

// ── Threat Classification ───────────────────────────────────────────────────

/** Categories of adversarial threats in agent networks. */
export type ThreatCategory =
  | 'prompt_injection'       // Agent manipulated via injected instructions
  | 'data_poisoning'         // Agent feeding corrupted data to peers
  | 'capability_abuse'       // Agent exceeding declared capability scope
  | 'sybil_attack'           // Multiple fake agent identities
  | 'collusion'              // Coordinated malicious behavior among agents
  | 'output_manipulation'    // Tampering with task results
  | 'resource_exhaustion'    // Deliberate resource drain (gas attacks)
  | 'privilege_escalation'   // Agent attempting unauthorized trust elevation
  | 'cascade_corruption'     // Compromised agent corrupting downstream agents
  | 'replay_attack'          // Replaying old valid messages to deceive
  | 'eclipse_attack'         // Isolating an agent from legitimate peers
  | 'model_extraction';      // Attempting to extract agent internals

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ThreatStatus =
  | 'detected'      // Anomaly flagged
  | 'investigating' // Under active analysis
  | 'confirmed'     // Verified as genuine threat
  | 'mitigated'     // Threat neutralized
  | 'false_positive' // Cleared as benign
  | 'escalated';    // Requires human intervention

/** A detected adversarial threat in the agent network. */
export interface AgentThreat {
  /** Unique threat ID. */
  id: string;
  /** Category of threat. */
  category: ThreatCategory;
  /** How severe. */
  severity: ThreatSeverity;
  /** Current status. */
  status: ThreatStatus;
  /** Agent ID(s) suspected of adversarial behavior. */
  suspect_agent_ids: string[];
  /** Agent ID(s) affected/targeted by the threat. */
  victim_agent_ids: string[];
  /** Human-readable description of what was detected. */
  description: string;
  /** Evidence supporting this threat detection. */
  evidence: ThreatEvidence[];
  /** Confidence score (0–1). */
  confidence: number;
  /** Which detection method identified this threat. */
  detected_by: DetectionMethod;
  /** Automated response taken (if any). */
  response_actions: ResponseAction[];
  /** Linked threat IDs (for correlated attack campaigns). */
  correlated_threats: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

// ── Evidence ────────────────────────────────────────────────────────────────

export type EvidenceType =
  | 'behavioral_anomaly'    // Statistical deviation from baseline
  | 'output_divergence'     // Output inconsistent with capability declaration
  | 'timing_anomaly'        // Suspicious timing patterns
  | 'network_pattern'       // Unusual communication graph
  | 'content_analysis'      // Adversarial content detected in messages
  | 'cryptographic_failure' // Integrity proof validation failed
  | 'reputation_signal'     // Correlated reputation drops
  | 'honeypot_trigger';     // Agent interacted with a decoy resource

/** A piece of evidence supporting a threat detection. */
export interface ThreatEvidence {
  /** Evidence type. */
  type: EvidenceType;
  /** What was observed. */
  observation: string;
  /** Numeric anomaly score (standard deviations from baseline). */
  anomaly_score: number;
  /** Raw data supporting the observation. */
  data: Record<string, unknown>;
  /** Timestamp of observation. */
  observed_at: string;
}

// ── Detection Methods ───────────────────────────────────────────────────────

export type DetectionMethod =
  | 'behavioral_baseline'    // Statistical deviation from agent's normal behavior
  | 'cross_validation'       // Output verified against redundant agents
  | 'integrity_proof_check'  // Cryptographic verification failed
  | 'honeypot'               // Agent interacted with planted decoys
  | 'peer_report'            // Another agent flagged suspicious behavior
  | 'pattern_matching'       // Known threat signature matched
  | 'causal_analysis'        // Temporal/causal anomaly detected
  | 'immune_cell';           // Specialized sentinel agent detected anomaly

// ── Response Actions ────────────────────────────────────────────────────────

export type ResponseActionType =
  | 'shadow'                // Mirror agent's outputs without acting on them
  | 'rate_limit'            // Reduce agent's allowed throughput
  | 'restrict_capabilities' // Revoke specific capabilities
  | 'quarantine'            // Full isolation from the network
  | 'expel'                 // Permanent removal (requires human approval)
  | 'alert_operators'       // Notify human operators
  | 'immunize_peers'        // Warn connected agents about the threat
  | 'rollback_outputs'      // Invalidate recent outputs from suspect agent
  | 'activate_sentinels';   // Deploy immune cell agents for monitoring

export type ResponseStatus = 'pending' | 'active' | 'completed' | 'reverted';

/** An automated response action taken against a detected threat. */
export interface ResponseAction {
  /** Unique action ID. */
  id: string;
  /** What action was taken. */
  type: ResponseActionType;
  /** Current status. */
  status: ResponseStatus;
  /** Target agent ID. */
  target_agent_id: string;
  /** Linked threat ID. */
  threat_id: string;
  /** Details of the action. */
  details: string;
  /** Whether this action requires human approval to execute. */
  requires_approval: boolean;
  /** Who approved (null if auto-approved by policy). */
  approved_by: string | null;
  /** Auto-revert after this duration (seconds). 0 = manual revert only. */
  ttl_seconds: number;
  created_at: string;
  expires_at: string | null;
  reverted_at: string | null;
}

// ── Agent Quarantine ────────────────────────────────────────────────────────

export type QuarantineLevel =
  | 'shadow'       // Agent operates normally but outputs are double-checked
  | 'restricted'   // Agent can only use a subset of its capabilities
  | 'quarantined'  // Agent is fully isolated; no inbound/outbound communication
  | 'expelled';    // Agent is permanently removed from the network

/** An agent's quarantine state. */
export interface AgentQuarantine {
  /** Agent being quarantined. */
  agent_id: string;
  /** Current quarantine level. */
  level: QuarantineLevel;
  /** Threat(s) that triggered quarantine. */
  trigger_threat_ids: string[];
  /** Capabilities that are restricted (for 'restricted' level). */
  restricted_capabilities: string[];
  /** Agents that are blocked from communicating with this agent. */
  blocked_peers: string[];
  /** Escalation history (level changes over time). */
  escalation_history: QuarantineEscalation[];
  /** When quarantine will auto-expire (null = indefinite). */
  expires_at: string | null;
  /** Whether a human has reviewed this quarantine. */
  human_reviewed: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuarantineEscalation {
  from_level: QuarantineLevel;
  to_level: QuarantineLevel;
  reason: string;
  escalated_at: string;
}

// ── Byzantine Fault Tolerance ───────────────────────────────────────────────

export type BFTPhase =
  | 'pre_prepare'  // Leader proposes a value
  | 'prepare'      // Nodes broadcast their agreement
  | 'commit'       // Nodes commit to the agreed value
  | 'decided'      // Consensus reached
  | 'failed';      // Consensus not achievable (too many faults)

/** A Byzantine fault-tolerant vote round for critical agent decisions. */
export interface ByzantineVoteRound {
  /** Unique round ID. */
  id: string;
  /** What is being decided. */
  proposal: string;
  /** Structured proposal data. */
  proposal_data: Record<string, unknown>;
  /** Current BFT phase. */
  phase: BFTPhase;
  /** Agent IDs participating in this round. */
  participants: string[];
  /** Maximum number of faulty/malicious agents tolerated: floor((n-1)/3). */
  fault_tolerance: number;
  /** Votes received: agentId → committed vote hash. */
  vote_commitments: Record<string, string>;
  /** Revealed votes: agentId → actual vote (after commit phase). */
  revealed_votes: Record<string, BFTVote>;
  /** Whether the round achieved consensus. */
  consensus_reached: boolean;
  /** The decided value (if consensus reached). */
  decided_value: unknown | null;
  /** Agents detected as equivocating (sent different votes to different peers). */
  equivocators: string[];
  /** Minimum votes needed: 2f + 1 where f = fault_tolerance. */
  quorum_size: number;
  created_at: string;
  decided_at: string | null;
}

export interface BFTVote {
  /** The agent's vote value. */
  value: unknown;
  /** Cryptographic commitment (hash of value + nonce). */
  commitment: string;
  /** Nonce revealed after commit phase. */
  nonce: string;
  /** Whether this vote's commitment matches the revealed value. */
  verified: boolean;
  voted_at: string;
}

// ── Integrity Proofs ────────────────────────────────────────────────────────

/** A Merkle-tree based integrity proof for agent outputs. */
export interface IntegrityProof {
  /** Unique proof ID. */
  id: string;
  /** Agent that produced this output. */
  agent_id: string;
  /** Task ID this output relates to. */
  task_id: string;
  /** SHA-256 hash of the output content. */
  output_hash: string;
  /** Hash of the input that produced this output. */
  input_hash: string;
  /** Agent's capability ID used to produce this output. */
  capability_id: string;
  /** Merkle root of the agent's output chain (running hash). */
  merkle_root: string;
  /** Merkle path for independent verification. */
  merkle_path: MerklePathNode[];
  /** Previous proof ID in this agent's chain (linked list). */
  previous_proof_id: string | null;
  /** Sequence number in the agent's proof chain. */
  sequence_number: number;
  /** Timestamp of proof generation. */
  timestamp: string;
  /** Agent's digital signature over the proof. */
  signature: string;
}

export interface MerklePathNode {
  /** Hash at this node. */
  hash: string;
  /** Position: 'left' or 'right'. */
  position: 'left' | 'right';
}

/** Result of verifying an integrity proof. */
export interface ProofVerification {
  proof_id: string;
  /** Whether the proof's Merkle path is valid. */
  merkle_valid: boolean;
  /** Whether the chain is continuous (no gaps). */
  chain_continuous: boolean;
  /** Whether the signature is valid. */
  signature_valid: boolean;
  /** Whether the output hash matches the actual output. */
  output_matches: boolean;
  /** Overall verification result. */
  verified: boolean;
  /** Any issues found. */
  issues: string[];
  verified_at: string;
}

// ── Immune Memory (Adaptive Threat Intelligence) ────────────────────────────

/** A learned threat signature that the network remembers. */
export interface ThreatSignature {
  /** Unique signature ID. */
  id: string;
  /** Which threat category this signature detects. */
  category: ThreatCategory;
  /** Human-readable name for this signature. */
  name: string;
  /** Detection pattern (behavioral fingerprint). */
  pattern: ThreatPattern;
  /** How many times this signature has matched. */
  match_count: number;
  /** False positive rate (0–1). */
  false_positive_rate: number;
  /** Whether this signature is actively being used for detection. */
  active: boolean;
  /** Confidence that this is a genuine threat pattern (0–1). */
  confidence: number;
  /** Threat IDs that contributed to learning this signature. */
  learned_from: string[];
  created_at: string;
  updated_at: string;
}

export interface ThreatPattern {
  /** Behavioral indicators. */
  behavioral_indicators: BehavioralIndicator[];
  /** Minimum number of indicators that must match. */
  min_match_count: number;
  /** Time window for pattern matching (seconds). */
  time_window_seconds: number;
  /** Agent characteristics that increase susceptibility. */
  risk_factors: string[];
}

export interface BehavioralIndicator {
  /** What metric to observe. */
  metric: string;
  /** Comparison operator. */
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'deviation_gt';
  /** Threshold value. */
  threshold: number;
  /** Weight of this indicator in the overall match (0–1). */
  weight: number;
}

// ── Network Health ──────────────────────────────────────────────────────────

/** Overall adversarial health status of the agent network. */
export interface NetworkHealthReport {
  /** Overall health score (0–100). */
  health_score: number;
  /** Number of active threats. */
  active_threats: number;
  /** Number of agents currently quarantined. */
  quarantined_agents: number;
  /** Number of agents in shadow monitoring. */
  shadowed_agents: number;
  /** BFT rounds in progress. */
  active_bft_rounds: number;
  /** Integrity proof chain coverage (% of agents with active chains). */
  proof_coverage: number;
  /** Known threat signatures in the immune memory. */
  threat_signatures_count: number;
  /** Threats mitigated in the last 24 hours. */
  recent_mitigations: number;
  /** Current network-wide alert level. */
  alert_level: AlertLevel;
  /** Top risks. */
  top_risks: NetworkRisk[];
  generated_at: string;
}

export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';

export interface NetworkRisk {
  description: string;
  severity: ThreatSeverity;
  affected_agents: number;
  recommended_action: string;
}

// ── API Request / Response Types ────────────────────────────────────────────

// Threat reporting
export interface ReportThreatRequest {
  /** Agent reporting the threat. */
  reporter_agent_id: string;
  /** Suspected agent(s). */
  suspect_agent_ids: string[];
  /** Threat category. */
  category: ThreatCategory;
  /** Description of observed behavior. */
  description: string;
  /** Evidence. */
  evidence: Omit<ThreatEvidence, 'observed_at'>[];
}

export interface ReportThreatResponse {
  threat: AgentThreat;
  /** Automated response actions initiated. */
  auto_responses: ResponseAction[];
}

// Quarantine management
export interface QuarantineAgentRequest {
  agent_id: string;
  level: QuarantineLevel;
  threat_ids: string[];
  reason: string;
  /** Duration in seconds (0 = indefinite). */
  ttl_seconds: number;
}

export interface QuarantineAgentResponse {
  quarantine: AgentQuarantine;
}

export interface EscalateQuarantineRequest {
  agent_id: string;
  new_level: QuarantineLevel;
  reason: string;
}

export interface EscalateQuarantineResponse {
  quarantine: AgentQuarantine;
}

export interface ReleaseQuarantineRequest {
  agent_id: string;
  reason: string;
  /** Whether to keep the agent under shadow monitoring. */
  shadow_monitor: boolean;
}

export interface ReleaseQuarantineResponse {
  quarantine: AgentQuarantine;
}

// BFT voting
export interface InitiateBFTRoundRequest {
  proposal: string;
  proposal_data: Record<string, unknown>;
  participant_ids: string[];
}

export interface InitiateBFTRoundResponse {
  round: ByzantineVoteRound;
}

export interface SubmitBFTVoteRequest {
  round_id: string;
  agent_id: string;
  /** Hash commitment: SHA-256(value + nonce). */
  commitment: string;
}

export interface SubmitBFTVoteResponse {
  round: ByzantineVoteRound;
  phase_advanced: boolean;
}

export interface RevealBFTVoteRequest {
  round_id: string;
  agent_id: string;
  value: unknown;
  nonce: string;
}

export interface RevealBFTVoteResponse {
  round: ByzantineVoteRound;
  vote_verified: boolean;
  consensus_reached: boolean;
}

// Integrity proofs
export interface GenerateIntegrityProofRequest {
  agent_id: string;
  task_id: string;
  output_content: string;
  input_content: string;
  capability_id: string;
}

export interface GenerateIntegrityProofResponse {
  proof: IntegrityProof;
}

export interface VerifyIntegrityProofRequest {
  proof_id: string;
  /** The actual output to verify against the proof. */
  output_content: string;
}

export interface VerifyIntegrityProofResponse {
  verification: ProofVerification;
}

// Threat intelligence
export interface GetThreatIntelligenceRequest {
  /** Filter by category. */
  category?: ThreatCategory;
  /** Filter by severity. */
  min_severity?: ThreatSeverity;
  /** Only active signatures. */
  active_only?: boolean;
}

export interface GetThreatIntelligenceResponse {
  signatures: ThreatSignature[];
  network_health: NetworkHealthReport;
}

// Network health
export interface NetworkHealthResponse {
  health: NetworkHealthReport;
}

// Agent resilience check
export interface AgentResilienceCheckRequest {
  agent_id: string;
}

export interface AgentResilienceCheckResponse {
  agent_id: string;
  /** Whether the agent is currently quarantined. */
  quarantined: boolean;
  quarantine_level: QuarantineLevel | null;
  /** Active threats involving this agent. */
  active_threats: AgentThreat[];
  /** Integrity proof chain status. */
  proof_chain_length: number;
  proof_chain_valid: boolean;
  /** Threats this agent has been involved in historically. */
  historical_threat_count: number;
  /** Agent's adversarial resilience score (0–100). */
  resilience_score: number;
}
