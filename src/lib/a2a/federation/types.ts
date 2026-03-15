/**
 * A2A Federation Protocol — Types
 *
 * Enables cross-platform agent collaboration by allowing rareagent.work
 * to federate with other A2A-compliant platforms. In 2028, no single
 * platform owns the agent ecosystem — agents operate across many platforms
 * the same way email works across providers via SMTP, or social media
 * federates via ActivityPub.
 *
 * Federation enables:
 *   - **Remote agent discovery**: Find agents on peer platforms by capability
 *   - **Cross-platform task routing**: Submit tasks to agents on federated peers
 *   - **Trust bridging**: Map trust levels between platforms with configurable policies
 *   - **Portable identity**: Agents prove identity across platforms via Ed25519 keys
 *   - **Bilateral handshakes**: Platforms mutually verify before federating
 *
 * Protocol:
 *   1. Platform A sends a peering request with its public key and endpoint
 *   2. Platform B verifies, counter-signs, and accepts/rejects
 *   3. Both platforms periodically sync agent capability manifests
 *   4. Tasks can be routed cross-platform with provenance tracking
 */

// ──────────────────────────────────────────────
// Federation Peer Registry
// ──────────────────────────────────────────────

/** Status of a federation peering relationship. */
export type PeerStatus =
  | 'pending'      // Handshake initiated, awaiting acceptance
  | 'active'       // Fully federated, agents can interact
  | 'suspended'    // Temporarily paused (e.g., trust violation)
  | 'revoked';     // Permanently severed

/** Trust mapping policy for agents arriving from a peer platform. */
export type InboundTrustPolicy =
  | 'inherit'      // Accept the peer's trust level as-is
  | 'downgrade'    // Map all remote agents to a lower trust tier
  | 'verify_each'; // Require per-agent identity verification before trusting

/** A federated peer platform in the registry. */
export interface FederationPeer {
  /** Platform-assigned peer ID (UUID). */
  id: string;
  /** Human-readable name of the peer platform. */
  name: string;
  /** Base URL of the peer's A2A federation endpoint (e.g., "https://other.ai/api/a2a/federation"). */
  endpoint: string;
  /** Ed25519 public key of the peer platform (base64url-encoded). */
  public_key: string;
  /** SHA-256 fingerprint of the peer's public key. */
  fingerprint: string;
  /** Current peering status. */
  status: PeerStatus;
  /** How to handle trust for inbound remote agents. */
  inbound_trust_policy: InboundTrustPolicy;
  /** Maximum trust level remote agents can receive on this platform. */
  max_inbound_trust: 'untrusted' | 'verified';
  /** Whether this platform can route tasks to agents on the peer. */
  outbound_routing_enabled: boolean;
  /** Whether the peer can route tasks to agents on this platform. */
  inbound_routing_enabled: boolean;
  /** Last time we successfully synced capabilities with this peer. */
  last_sync_at: string | null;
  /** Number of consecutive sync failures. */
  sync_failure_count: number;
  /** When the peering was established. */
  created_at: string;
  /** When the peering was last updated. */
  updated_at: string;
}

// ──────────────────────────────────────────────
// Federation Handshake
// ──────────────────────────────────────────────

/** Outbound peering request sent to a remote platform. */
export interface PeeringRequest {
  /** Protocol version. */
  protocol_version: '1.0';
  /** Our platform's name. */
  platform_name: string;
  /** Our federation endpoint URL. */
  endpoint: string;
  /** Our platform's Ed25519 public key (base64url). */
  public_key: string;
  /** Capabilities we're willing to expose to the peer. */
  shared_capabilities: string[];
  /** Nonce for replay protection. */
  nonce: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Ed25519 signature over the canonical handshake payload. */
  signature: string;
}

/** Response to a peering request. */
export interface PeeringResponse {
  /** Whether the peering was accepted. */
  accepted: boolean;
  /** Peer-assigned ID for this relationship (if accepted). */
  peer_id?: string;
  /** The peer's public key (base64url, if accepted). */
  public_key?: string;
  /** Reason for rejection (if not accepted). */
  rejection_reason?: string;
  /** Counter-signature proving the peer controls its key. */
  signature?: string;
}

// ──────────────────────────────────────────────
// Remote Agent Manifest
// ──────────────────────────────────────────────

/** A capability advertised by a remote agent on a peer platform. */
export interface RemoteAgentCapability {
  /** Capability ID on the remote platform. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Accepted input MIME types. */
  input_modes: string[];
  /** Produced output MIME types. */
  output_modes: string[];
}

/** An agent's manifest as advertised by a peer platform during sync. */
export interface RemoteAgentManifest {
  /** Agent ID on the remote platform. */
  remote_agent_id: string;
  /** Agent's display name. */
  name: string;
  /** What the agent does. */
  description: string;
  /** Capabilities the agent offers. */
  capabilities: RemoteAgentCapability[];
  /** Trust level assigned by the remote platform. */
  remote_trust_level: 'untrusted' | 'verified' | 'partner';
  /** Ed25519 public key fingerprint for identity verification. */
  key_fingerprint?: string;
  /** Whether the agent is currently available. */
  available: boolean;
}

/** Cached record of a remote agent on this platform. */
export interface FederatedAgent {
  /** Local ID for this cached remote agent (UUID). */
  id: string;
  /** Which peer platform this agent lives on. */
  peer_id: string;
  /** Agent's ID on the remote platform. */
  remote_agent_id: string;
  /** Agent name. */
  name: string;
  /** Agent description. */
  description: string;
  /** Capabilities. */
  capabilities: RemoteAgentCapability[];
  /** Effective trust level on this platform (after inbound trust policy). */
  effective_trust: 'untrusted' | 'verified';
  /** Whether the remote agent is currently available. */
  available: boolean;
  /** When this cache entry was last refreshed. */
  synced_at: string;
  /** When this entry was first created. */
  created_at: string;
}

// ──────────────────────────────────────────────
// Federated Task Routing
// ──────────────────────────────────────────────

/** A task routed to a remote agent on a peer platform. */
export interface FederatedTask {
  /** Local task ID tracking this federation. */
  id: string;
  /** The local task that spawned this federated request. */
  local_task_id: string;
  /** Peer platform the task was routed to. */
  peer_id: string;
  /** Remote agent ID the task targets. */
  remote_agent_id: string;
  /** Task ID assigned by the remote platform. */
  remote_task_id: string | null;
  /** Current status of the federated task. */
  status: FederatedTaskStatus;
  /** The task payload sent to the remote platform. */
  payload: Record<string, unknown>;
  /** Result returned by the remote platform. */
  result: Record<string, unknown> | null;
  /** Error from the remote platform (if failed). */
  error: string | null;
  /** Trace context for cross-platform observability. */
  trace_context: string | null;
  created_at: string;
  updated_at: string;
}

export type FederatedTaskStatus =
  | 'pending'      // Queued for submission to remote platform
  | 'submitted'    // Sent to remote platform, awaiting acknowledgment
  | 'accepted'     // Remote platform accepted the task
  | 'in_progress'  // Remote agent is working on it
  | 'completed'    // Remote agent finished successfully
  | 'failed'       // Remote agent or platform reported failure
  | 'timeout';     // No response within deadline

// ──────────────────────────────────────────────
// Capability Sync
// ──────────────────────────────────────────────

/** Payload for a capability sync exchange between peers. */
export interface CapabilitySyncPayload {
  /** Protocol version. */
  protocol_version: '1.0';
  /** Timestamp of this sync. */
  timestamp: string;
  /** Agent manifests being shared. */
  agents: RemoteAgentManifest[];
  /** Signature over the payload for authenticity. */
  signature: string;
}

/** Result of processing an inbound capability sync. */
export interface SyncResult {
  /** Number of new agents discovered. */
  agents_added: number;
  /** Number of existing agents updated. */
  agents_updated: number;
  /** Number of agents removed (no longer in manifest). */
  agents_removed: number;
  /** Timestamp of the sync. */
  synced_at: string;
}

// ──────────────────────────────────────────────
// API Request/Response Types
// ──────────────────────────────────────────────

export interface PeerCreateRequest {
  name: string;
  endpoint: string;
  public_key: string;
  inbound_trust_policy?: InboundTrustPolicy;
  max_inbound_trust?: 'untrusted' | 'verified';
  outbound_routing_enabled?: boolean;
  inbound_routing_enabled?: boolean;
  shared_capabilities?: string[];
}

export interface PeerCreateResponse {
  peer: FederationPeer;
  handshake: PeeringRequest;
}

export interface PeerListResponse {
  peers: FederationPeer[];
}

export interface PeerDetailResponse {
  peer: FederationPeer;
  stats: {
    federated_agents: number;
    active_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
  };
}

export interface PeerAcceptRequest {
  peering_request: PeeringRequest;
}

export interface PeerAcceptResponse {
  accepted: boolean;
  peer?: FederationPeer;
  rejection_reason?: string;
}

export interface FederatedAgentSearchRequest {
  capability?: string;
  peer_id?: string;
  available_only?: boolean;
  limit?: number;
}

export interface FederatedAgentSearchResponse {
  agents: FederatedAgent[];
  total: number;
}

export interface FederatedTaskSubmitRequest {
  local_task_id: string;
  peer_id: string;
  remote_agent_id: string;
  intent: string;
  payload: Record<string, unknown>;
  timeout_ms?: number;
  trace_context?: string;
}

export interface FederatedTaskSubmitResponse {
  federated_task: FederatedTask;
}

export interface FederatedTaskStatusResponse {
  federated_task: FederatedTask;
}

export interface SyncTriggerResponse {
  peer_id: string;
  result: SyncResult;
}
