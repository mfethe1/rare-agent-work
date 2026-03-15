/**
 * A2A Noosphere — Collective Intelligence & Distributed Cognition
 *
 * Public API for the Noosphere subsystem. Enables agents to form cognitive
 * sessions, contribute thoughts to shared reasoning streams, synchronize
 * attention, and fuse partial insights into emergent collective conclusions.
 */

export {
  createSession,
  joinSession,
  contributeThought,
  endorseThought,
  createArtifact,
  updateArtifact,
  signalAttention,
  fuseInsights,
  getSessionState,
  concludeSession,
  dissolveSession,
  detectStagnation,
} from './engine';

export type {
  // Core types
  CognitiveSession,
  SessionGoalType,
  SessionStatus,
  AttentionBudget,
  ConstitutionalConstraint,

  // Thought streams
  Thought,
  ThoughtType,
  ThoughtEndorsement,
  ConstraintCheckResult,

  // Working memory
  WorkingMemoryArtifact,
  ArtifactType,
  ArtifactRevision,
  ArtifactLock,

  // Attention
  AttentionSignal,
  AttentionSignalType,
  AttentionState,
  AttentionFocus,

  // Fusion
  FusionStrategy,
  EmergentConclusion,
  DissentRecord,

  // Provenance
  InsightProvenance,
  ProvenanceStep,
  ProvenanceEdge,

  // Session stats
  SessionStats,

  // Request/Response types
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
