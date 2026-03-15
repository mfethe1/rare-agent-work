/**
 * A2A Agent Morphogenesis & Dynamic Composition Engine
 *
 * Enables agents to fuse, split, graft capabilities, metamorphose,
 * and replicate at runtime — with full provenance tracking and rollback.
 */

// Types
export type {
  // Operations
  MorphOperation,
  MorphEventStatus,
  MorphParams,

  // Core event & tracking
  MorphEvent,
  AgentSnapshot,
  AgentCapabilitySnapshot,
  CapabilityDelta,
  SafetyCheck,
  SafetyCheckResult,

  // Capability changes
  MergedCapability,
  PartitionedCapability,
  GraftedCapability,
  EmergedCapability,

  // Fusion
  FusionStrategy,
  FusionConfig,
  CompositeAgent,

  // Fission
  FissionStrategy,
  FissionConfig,
  FissionPartition,
  FissionResult,

  // Graft
  GraftMode,
  GraftConfig,
  ActiveGraft,

  // Metamorphosis
  MetamorphTrigger,
  MetamorphPhase,
  MetamorphConfig,
  MetamorphNewCapability,
  MetamorphEnhancement,
  MetamorphState,

  // Replication
  ReplicationVariation,
  ReplicationConfig,
  ReplicaAgent,

  // Registry & Lineage
  MorphRegistry,
  MorphLineageNode,
  MorphLineageGraph,

  // API types
  ProposeFusionRequest,
  ProposeFusionResponse,
  ConsentMorphRequest,
  ConsentMorphResponse,
  ExecuteFusionResponse,
  DefuseRequest,
  DefuseResponse,
  ProposeFissionRequest,
  ProposeFissionResponse,
  ExecuteFissionResponse,
  ReunifyRequest,
  ReunifyResponse,
  ProposeGraftRequest,
  ProposeGraftResponse,
  RevokeGraftRequest,
  RevokeGraftResponse,
  ProposeMetamorphRequest,
  ProposeMetamorphResponse,
  AdvanceMetamorphRequest,
  AdvanceMetamorphResponse,
  ProposeReplicationRequest,
  ProposeReplicationResponse,
  ExecuteReplicationResponse,
  MorphRegistryResponse,
  MorphLineageRequest,
  MorphLineageResponse,
  MorphHistoryResponse,
  RollbackMorphRequest,
  RollbackMorphResponse,
} from './types';

// Validation schemas
export {
  proposeFusionSchema,
  defuseSchema,
  proposeFissionSchema,
  reunifySchema,
  proposeGraftSchema,
  revokeGraftSchema,
  proposeMetamorphSchema,
  advanceMetamorphSchema,
  proposeReplicationSchema,
  consentMorphSchema,
  rollbackMorphSchema,
  morphLineageSchema,
} from './validation';

export type {
  ProposeFusionInput,
  DefuseInput,
  ProposeFissionInput,
  ReunifyInput,
  ProposeGraftInput,
  RevokeGraftInput,
  ProposeMetamorphInput,
  AdvanceMetamorphInput,
  ProposeReplicationInput,
  ConsentMorphInput,
  RollbackMorphInput,
  MorphLineageInput,
} from './validation';

// Engine functions
export {
  // Consent
  consentToMorph,

  // Fusion
  proposeFusion,
  executeFusion,
  defuse,

  // Fission
  proposeFission,
  executeFission,
  reunify,

  // Graft
  proposeGraft,
  executeGraft,
  revokeGraft,
  recordGraftInvocation,

  // Metamorphosis
  proposeMetamorph,
  advanceMetamorph,

  // Replication
  proposeReplication,
  executeReplication,

  // Rollback
  rollbackMorph,

  // Registry & queries
  getMorphRegistry,
  getMorphLineage,
  getMorphHistory,
  getComposite,
  getFission,
  getActiveGraft,
  getMetamorphState,
  getAgentGrafts,
  getAgentReplicas,
} from './engine';
