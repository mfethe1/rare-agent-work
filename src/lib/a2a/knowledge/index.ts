// ── A2A Agent Knowledge Graph ──

export {
  createNode,
  updateNode,
  deleteNode,
  getNode,
  searchNodes,
  createEdge,
  deleteEdge,
  listEdges,
  traverseGraph,
  findPath,
  findContradictions,
  mergeNodes,
  applyDecay,
  reinforceNode,
} from './engine';

export {
  nodeCreateSchema,
  nodeUpdateSchema,
  nodeSearchSchema,
  edgeCreateSchema,
  edgeListSchema,
  traverseSchema,
  pathSchema,
  mergeSchema,
  reinforceSchema,
} from './validation';

export type {
  NodeCreateInput,
  NodeUpdateInput,
  NodeSearchInput,
  EdgeCreateInput,
  EdgeListInput,
  TraverseInput,
  PathInput,
  MergeInput,
  ReinforceInput,
} from './validation';

export type {
  KnowledgeNodeType,
  KnowledgeNode,
  KnowledgeEdgeType,
  KnowledgeEdge,
  TraversalStrategy,
  TraversalDirection,
  PathStep,
  TraversalResult,
  PathResult,
  Contradiction,
  NodeCreateRequest,
  NodeCreateResponse,
  NodeUpdateRequest,
  NodeUpdateResponse,
  NodeSearchResponse,
  EdgeCreateRequest,
  EdgeCreateResponse,
  EdgeListResponse,
  TraverseRequest,
  TraverseResponse,
  PathRequest,
  PathResponse,
  ContradictionsResponse,
  MergeRequest,
  MergeResponse,
  DecayResponse,
} from './types';

// ── Collaborative Consensus Layer ──

export {
  endorseEntry,
  revokeEndorsement,
  listEndorsements,
  raiseConflict,
  voteOnConflict,
  getConflict,
  listConflicts,
  expireStaleConflicts,
} from './consensus-engine';

export {
  endorseSchema,
  raiseConflictSchema,
  voteConflictSchema,
  listConflictsSchema,
} from './consensus-validation';

export type {
  EndorseInput,
  RaiseConflictInput,
  VoteConflictInput,
  ListConflictsInput,
} from './consensus-validation';

export type {
  KnowledgeEndorsement,
  CommunityConfidence,
  ConsensusLevel,
  KnowledgeConflict,
  ConflictVote,
  ConflictTally,
  ConflictResolution,
  ConflictStatus,
  EndorseRequest,
  EndorseResponse,
  RevokeEndorsementResponse,
  ListEndorsementsResponse,
  RaiseConflictRequest,
  RaiseConflictResponse,
  VoteConflictRequest,
  VoteConflictResponse,
  GetConflictResponse,
  ListConflictsResponse,
} from './consensus-types';
