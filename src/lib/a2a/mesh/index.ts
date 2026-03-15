// ── A2A Agent Service Mesh ──

export {
  getCircuitBreaker,
  recordSuccess,
  recordFailure,
  assembleHealthSnapshots,
  selectAgent,
  acquireBulkheadSlot,
  releaseBulkheadSlot,
  computeRetryDelay,
  isRetryable,
  resolvePolicy,
  routeThroughMesh,
  createMeshPolicy,
  listMeshPolicies,
  updateMeshPolicy,
  createBulkheadPartition,
  getMeshHealth,
} from './engine';

export {
  meshRouteSchema,
  meshPolicyCreateSchema,
  meshPolicyUpdateSchema,
  circuitEventSchema,
  bulkheadCreateSchema,
  healthSnapshotSchema,
} from './validation';

export type {
  MeshRouteInput,
  MeshPolicyCreateInput,
  MeshPolicyUpdateInput,
  CircuitEventInput,
  BulkheadCreateInput,
  HealthSnapshotInput,
} from './validation';

export type {
  CircuitState,
  CircuitBreaker,
  LoadBalanceStrategy,
  AgentHealthSnapshot,
  AdaptiveWeights,
  BulkheadPartition,
  RetryPolicy,
  HedgingPolicy,
  MeshPolicy,
  MeshRoutingResult,
  MeshEventType,
  MeshEvent,
} from './types';

export {
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_ADAPTIVE_WEIGHTS,
  DEFAULT_RETRY_POLICY,
  DEFAULT_HEDGING_POLICY,
  DEFAULT_BULKHEAD_CONFIG,
} from './types';
