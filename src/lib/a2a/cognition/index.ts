/**
 * Collective Cognition Protocol — Public API
 *
 * Loop 30: Shared thinking spaces for agents to reason together.
 */

export type {
  // Mesh
  CognitiveMesh,
  CognitiveMeshStatus,
  MeshConfig,
  MeshStats,
  MeshCrystallization,

  // Thoughts
  Thought,
  ThoughtType,
  ThoughtRelation,

  // Branches
  ReasoningBranch,

  // Resonance & Dissonance
  ResonanceEvent,
  DissonanceEvent,

  // Attention
  AttentionFocus,
  AttentionReason,

  // Insights
  EmergentInsight,
  SynthesisMethod,
  InsightLineage,

  // Thinkers
  MeshThinker,
  ThinkerStatus,
  CognitiveStrength,

  // API types
  CreateMeshRequest,
  CreateMeshResponse,
  JoinMeshRequest,
  JoinMeshResponse,
  ContributeThoughtRequest,
  ContributeThoughtResponse,
  SynthesizeRequest,
  SynthesizeResponse,
  EndorseInsightRequest,
  EndorseInsightResponse,
  ShiftAttentionRequest,
  ShiftAttentionResponse,
  CrystallizeResponse,
  GetMeshResponse,
  ListMeshesResponse,
  GetLineageResponse,
} from './types';

export {
  createMesh,
  joinMesh,
  contributeThought,
  synthesizeInsight,
  endorseInsight,
  shiftAttention,
  crystallizeMesh,
  getInsightLineage,
  getMesh,
  listMeshes,
  dissolveMesh,
} from './engine';

export {
  createMeshSchema,
  joinMeshSchema,
  contributeThoughtSchema,
  synthesizeSchema,
  endorseInsightSchema,
  shiftAttentionSchema,
} from './validation';

export type {
  CreateMeshInput,
  JoinMeshInput,
  ContributeThoughtInput,
  SynthesizeInput,
  EndorseInsightInput,
  ShiftAttentionInput,
} from './validation';
