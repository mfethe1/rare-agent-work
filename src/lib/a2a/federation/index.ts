/**
 * A2A Federation Protocol — Public API
 *
 * Cross-platform agent collaboration enabling rareagent.work to participate
 * in a decentralized network of A2A-compliant platforms.
 */

export {
  registerPeer,
  acceptPeering,
  activatePeer,
  suspendPeer,
  revokePeer,
  listPeers,
  getPeerDetail,
  processCapabilitySync,
  recordSyncFailure,
  searchFederatedAgents,
  submitFederatedTask,
  handleInboundTask,
  updateFederatedTaskStatus,
  getFederatedTask,
  queryFederationAudit,
  computeEffectiveTrust,
} from './engine';

export {
  peerCreateSchema,
  peerListSchema,
  peerAcceptSchema,
  federatedAgentSearchSchema,
  federatedTaskSubmitSchema,
  capabilitySyncSchema,
  peerSuspendSchema,
} from './validation';

export type {
  PeerCreateInput,
  PeerListInput,
  PeerAcceptInput,
  FederatedAgentSearchInput,
  FederatedTaskSubmitInput,
  CapabilitySyncInput,
  PeerSuspendInput,
} from './validation';

export type {
  PeerStatus,
  InboundTrustPolicy,
  FederationPeer,
  FederatedAgent,
  FederatedTask,
  FederatedTaskStatus,
  RemoteAgentManifest,
  RemoteAgentCapability,
  PeeringRequest,
  PeeringResponse,
  CapabilitySyncPayload,
  SyncResult,
  PeerCreateRequest,
  PeerCreateResponse,
  PeerListResponse,
  PeerDetailResponse,
  PeerAcceptRequest,
  PeerAcceptResponse,
  FederatedAgentSearchRequest,
  FederatedAgentSearchResponse,
  FederatedTaskSubmitRequest,
  FederatedTaskSubmitResponse,
  FederatedTaskStatusResponse,
  SyncTriggerResponse,
} from './types';
