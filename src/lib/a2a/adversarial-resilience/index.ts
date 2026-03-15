/**
 * A2A Adversarial Resilience & Byzantine Immune System
 *
 * Protects the agent network from adversarial agents, Byzantine failures,
 * and cascade corruption — with adaptive immune memory and cryptographic
 * integrity proofs.
 */

// Types
export type {
  // Threat classification
  ThreatCategory,
  ThreatSeverity,
  ThreatStatus,
  AgentThreat,
  EvidenceType,
  ThreatEvidence,
  DetectionMethod,

  // Response actions
  ResponseActionType,
  ResponseStatus,
  ResponseAction,

  // Quarantine
  QuarantineLevel,
  AgentQuarantine,
  QuarantineEscalation,

  // BFT
  BFTPhase,
  ByzantineVoteRound,
  BFTVote,

  // Integrity proofs
  IntegrityProof,
  MerklePathNode,
  ProofVerification,

  // Immune memory
  ThreatSignature,
  ThreatPattern,
  BehavioralIndicator,

  // Network health
  NetworkHealthReport,
  AlertLevel,
  NetworkRisk,

  // API types
  ReportThreatRequest,
  ReportThreatResponse,
  QuarantineAgentRequest,
  QuarantineAgentResponse,
  EscalateQuarantineRequest,
  EscalateQuarantineResponse,
  ReleaseQuarantineRequest,
  ReleaseQuarantineResponse,
  InitiateBFTRoundRequest,
  InitiateBFTRoundResponse,
  SubmitBFTVoteRequest,
  SubmitBFTVoteResponse,
  RevealBFTVoteRequest,
  RevealBFTVoteResponse,
  GenerateIntegrityProofRequest,
  GenerateIntegrityProofResponse,
  VerifyIntegrityProofRequest,
  VerifyIntegrityProofResponse,
  GetThreatIntelligenceRequest,
  GetThreatIntelligenceResponse,
  NetworkHealthResponse,
  AgentResilienceCheckRequest,
  AgentResilienceCheckResponse,
} from './types';

// Validation schemas
export {
  reportThreatSchema,
  quarantineAgentSchema,
  escalateQuarantineSchema,
  releaseQuarantineSchema,
  initiateBFTRoundSchema,
  submitBFTVoteSchema,
  revealBFTVoteSchema,
  generateIntegrityProofSchema,
  verifyIntegrityProofSchema,
  getThreatIntelligenceSchema,
  agentResilienceCheckSchema,
} from './validation';

export type {
  ReportThreatInput,
  QuarantineAgentInput,
  EscalateQuarantineInput,
  ReleaseQuarantineInput,
  InitiateBFTRoundInput,
  SubmitBFTVoteInput,
  RevealBFTVoteInput,
  GenerateIntegrityProofInput,
  VerifyIntegrityProofInput,
  GetThreatIntelligenceInput,
  AgentResilienceCheckInput,
} from './validation';

// Engine functions
export {
  // Threat detection & reporting
  reportThreat,
  updateThreatStatus,
  getActiveThreats,
  getThreat,

  // Quarantine management
  quarantineAgent,
  escalateQuarantine,
  releaseQuarantine,
  getQuarantine,
  getAllQuarantines,
  isAgentAllowed,

  // Byzantine fault tolerance
  initiateBFTRound,
  submitBFTVoteCommitment,
  revealBFTVote,
  getBFTRound,
  getActiveBFTRounds,

  // Integrity proofs
  generateIntegrityProof,
  verifyIntegrityProof,
  getIntegrityProof,
  getAgentProofChain,

  // Threat intelligence
  getThreatIntelligence,
  getThreatSignature,

  // Network health
  getNetworkHealth,

  // Agent resilience
  checkAgentResilience,
} from './engine';
