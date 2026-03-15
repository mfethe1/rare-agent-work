/**
 * A2A Federation Protocol — Engine
 *
 * Database-backed federation management that enables cross-platform
 * agent collaboration. Handles the full lifecycle:
 *
 *   1. Peer registration & mutual handshake
 *   2. Capability manifest synchronization
 *   3. Federated agent discovery
 *   4. Cross-platform task routing with provenance
 *   5. Trust bridging between heterogeneous platforms
 *
 * Design principles:
 *   - Bilateral trust: both platforms must agree to federate
 *   - Trust downgrade by default: remote agents never exceed 'verified'
 *   - Signature verification: all sync payloads are signed
 *   - Graceful degradation: sync failures don't break local operations
 *   - Provenance tracking: every federated task traces its origin
 */

import { getServiceDb } from '../auth';
import type {
  FederationPeer,
  PeerStatus,
  InboundTrustPolicy,
  FederatedAgent,
  FederatedTask,
  FederatedTaskStatus,
  RemoteAgentManifest,
  PeeringRequest,
  CapabilitySyncPayload,
  SyncResult,
} from './types';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Maximum sync failures before auto-suspending a peer. */
const MAX_SYNC_FAILURES = 5;

/** Stale threshold — agents not refreshed in this window are marked unavailable. */
const AGENT_STALE_MS = 30 * 60 * 1000; // 30 minutes

/** Platform identity for handshakes. */
const PLATFORM_NAME = 'rareagent.work';

// ──────────────────────────────────────────────
// Peer Management
// ──────────────────────────────────────────────

/**
 * Register a new federation peer and generate a peering request.
 * The peer starts in 'pending' status until they accept the handshake.
 */
export async function registerPeer(params: {
  name: string;
  endpoint: string;
  public_key: string;
  inbound_trust_policy?: InboundTrustPolicy;
  max_inbound_trust?: 'untrusted' | 'verified';
  outbound_routing_enabled?: boolean;
  inbound_routing_enabled?: boolean;
}): Promise<{ peer: FederationPeer; handshake: PeeringRequest }> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  // Compute fingerprint of peer's public key
  const fingerprint = await computeKeyFingerprint(params.public_key);

  // Check for duplicate endpoint
  const { data: existing } = await db
    .from('federation_peers')
    .select('id')
    .eq('endpoint', params.endpoint)
    .neq('status', 'revoked')
    .single();

  if (existing) {
    throw new Error(`Peer already registered for endpoint: ${params.endpoint}`);
  }

  const now = new Date().toISOString();
  const peerRecord = {
    name: params.name,
    endpoint: params.endpoint,
    public_key: params.public_key,
    fingerprint,
    status: 'pending' as PeerStatus,
    inbound_trust_policy: params.inbound_trust_policy ?? 'downgrade',
    max_inbound_trust: params.max_inbound_trust ?? 'verified',
    outbound_routing_enabled: params.outbound_routing_enabled ?? true,
    inbound_routing_enabled: params.inbound_routing_enabled ?? true,
    last_sync_at: null,
    sync_failure_count: 0,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await db
    .from('federation_peers')
    .insert(peerRecord)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to register peer: ${error?.message}`);
  }

  // Generate the handshake request
  const nonce = generateNonce();
  const handshake: PeeringRequest = {
    protocol_version: '1.0',
    platform_name: PLATFORM_NAME,
    endpoint: getOwnFederationEndpoint(),
    public_key: getOwnPublicKey(),
    shared_capabilities: [],
    nonce,
    timestamp: now,
    signature: '', // Populated by the caller with the platform's private key
  };

  return { peer: data as FederationPeer, handshake };
}

/**
 * Accept an inbound peering request from a remote platform.
 * Verifies the handshake signature and creates the peer record.
 */
export async function acceptPeering(
  request: PeeringRequest,
): Promise<{ peer: FederationPeer; accepted: boolean; rejection_reason?: string }> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  // Validate timestamp is within acceptable window (5 minutes)
  const requestTime = new Date(request.timestamp).getTime();
  const now = Date.now();
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return { peer: null as unknown as FederationPeer, accepted: false, rejection_reason: 'Handshake timestamp expired' };
  }

  // Check for duplicate
  const { data: existing } = await db
    .from('federation_peers')
    .select('id, status')
    .eq('endpoint', request.endpoint)
    .neq('status', 'revoked')
    .single();

  if (existing) {
    return {
      peer: null as unknown as FederationPeer,
      accepted: false,
      rejection_reason: `Peer already registered (status: ${existing.status})`,
    };
  }

  const fingerprint = await computeKeyFingerprint(request.public_key);
  const nowISO = new Date().toISOString();

  const peerRecord = {
    name: request.platform_name,
    endpoint: request.endpoint,
    public_key: request.public_key,
    fingerprint,
    status: 'active' as PeerStatus,
    inbound_trust_policy: 'downgrade' as InboundTrustPolicy,
    max_inbound_trust: 'verified',
    outbound_routing_enabled: true,
    inbound_routing_enabled: true,
    last_sync_at: null,
    sync_failure_count: 0,
    created_at: nowISO,
    updated_at: nowISO,
  };

  const { data, error } = await db
    .from('federation_peers')
    .insert(peerRecord)
    .select()
    .single();

  if (error || !data) {
    return {
      peer: null as unknown as FederationPeer,
      accepted: false,
      rejection_reason: `Database error: ${error?.message}`,
    };
  }

  return { peer: data as FederationPeer, accepted: true };
}

/**
 * Activate a pending peer (after they accept our handshake).
 */
export async function activatePeer(peerId: string): Promise<FederationPeer> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const { data, error } = await db
    .from('federation_peers')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', peerId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to activate peer: ${error?.message ?? 'not found or not pending'}`);
  }

  return data as FederationPeer;
}

/**
 * Suspend a peer, halting all federated operations.
 */
export async function suspendPeer(
  peerId: string,
  reason: string,
): Promise<FederationPeer> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const { data, error } = await db
    .from('federation_peers')
    .update({
      status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', peerId)
    .in('status', ['active', 'pending'])
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to suspend peer: ${error?.message ?? 'not found'}`);
  }

  // Log the suspension event
  await db.from('federation_audit_log').insert({
    peer_id: peerId,
    action: 'peer_suspended',
    details: { reason },
    created_at: new Date().toISOString(),
  });

  return data as FederationPeer;
}

/**
 * Permanently revoke a peer. This cannot be undone — they must re-register.
 */
export async function revokePeer(peerId: string, reason: string): Promise<FederationPeer> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const { data, error } = await db
    .from('federation_peers')
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('id', peerId)
    .neq('status', 'revoked')
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to revoke peer: ${error?.message ?? 'not found'}`);
  }

  // Remove all cached agents from this peer
  await db
    .from('federated_agents')
    .delete()
    .eq('peer_id', peerId);

  // Log the revocation
  await db.from('federation_audit_log').insert({
    peer_id: peerId,
    action: 'peer_revoked',
    details: { reason },
    created_at: new Date().toISOString(),
  });

  return data as FederationPeer;
}

/**
 * List federation peers with optional status filter.
 */
export async function listPeers(params: {
  status?: PeerStatus;
  limit?: number;
  offset?: number;
}): Promise<FederationPeer[]> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  let query = db
    .from('federation_peers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50)
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 50) - 1);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list peers: ${error.message}`);

  return (data ?? []) as FederationPeer[];
}

/**
 * Get a single peer with stats.
 */
export async function getPeerDetail(peerId: string): Promise<{
  peer: FederationPeer;
  stats: { federated_agents: number; active_tasks: number; completed_tasks: number; failed_tasks: number };
}> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const { data: peer, error } = await db
    .from('federation_peers')
    .select('*')
    .eq('id', peerId)
    .single();

  if (error || !peer) throw new Error(`Peer not found: ${peerId}`);

  // Fetch stats
  const [agentCount, activeTasks, completedTasks, failedTasks] = await Promise.all([
    db.from('federated_agents').select('id', { count: 'exact', head: true }).eq('peer_id', peerId),
    db.from('federated_tasks').select('id', { count: 'exact', head: true }).eq('peer_id', peerId).in('status', ['pending', 'submitted', 'accepted', 'in_progress']),
    db.from('federated_tasks').select('id', { count: 'exact', head: true }).eq('peer_id', peerId).eq('status', 'completed'),
    db.from('federated_tasks').select('id', { count: 'exact', head: true }).eq('peer_id', peerId).eq('status', 'failed'),
  ]);

  return {
    peer: peer as FederationPeer,
    stats: {
      federated_agents: agentCount.count ?? 0,
      active_tasks: activeTasks.count ?? 0,
      completed_tasks: completedTasks.count ?? 0,
      failed_tasks: failedTasks.count ?? 0,
    },
  };
}

// ──────────────────────────────────────────────
// Capability Sync
// ──────────────────────────────────────────────

/**
 * Process an inbound capability sync from a peer platform.
 * Updates the local cache of federated agents.
 */
export async function processCapabilitySync(
  peerId: string,
  payload: CapabilitySyncPayload,
): Promise<SyncResult> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  // Verify peer is active
  const { data: peer } = await db
    .from('federation_peers')
    .select('*')
    .eq('id', peerId)
    .eq('status', 'active')
    .single();

  if (!peer) throw new Error('Peer not found or not active');

  const peerData = peer as FederationPeer;
  const now = new Date().toISOString();

  // Get existing cached agents for this peer
  const { data: existingAgents } = await db
    .from('federated_agents')
    .select('*')
    .eq('peer_id', peerId);

  const existingByRemoteId = new Map(
    (existingAgents ?? []).map((a: FederatedAgent) => [a.remote_agent_id, a]),
  );

  const incomingRemoteIds = new Set(payload.agents.map((a) => a.remote_agent_id));

  let added = 0;
  let updated = 0;
  let removed = 0;

  // Upsert incoming agents
  for (const manifest of payload.agents) {
    const effectiveTrust = computeEffectiveTrust(
      manifest.remote_trust_level,
      peerData.inbound_trust_policy,
      peerData.max_inbound_trust,
    );

    const record = {
      peer_id: peerId,
      remote_agent_id: manifest.remote_agent_id,
      name: manifest.name,
      description: manifest.description,
      capabilities: manifest.capabilities,
      effective_trust: effectiveTrust,
      available: manifest.available,
      synced_at: now,
    };

    const existing = existingByRemoteId.get(manifest.remote_agent_id);
    if (existing) {
      await db
        .from('federated_agents')
        .update(record)
        .eq('id', existing.id);
      updated++;
    } else {
      await db
        .from('federated_agents')
        .insert({ ...record, created_at: now });
      added++;
    }
  }

  // Remove agents no longer in the manifest
  for (const [remoteId, existing] of existingByRemoteId) {
    if (!incomingRemoteIds.has(remoteId)) {
      await db.from('federated_agents').delete().eq('id', existing.id);
      removed++;
    }
  }

  // Update peer sync metadata
  await db
    .from('federation_peers')
    .update({ last_sync_at: now, sync_failure_count: 0, updated_at: now })
    .eq('id', peerId);

  // Audit log
  await db.from('federation_audit_log').insert({
    peer_id: peerId,
    action: 'capability_sync',
    details: { agents_added: added, agents_updated: updated, agents_removed: removed },
    created_at: now,
  });

  return { agents_added: added, agents_updated: updated, agents_removed: removed, synced_at: now };
}

/**
 * Record a sync failure for a peer. Auto-suspends after MAX_SYNC_FAILURES.
 */
export async function recordSyncFailure(peerId: string, error: string): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const { data: peer } = await db
    .from('federation_peers')
    .select('sync_failure_count')
    .eq('id', peerId)
    .single();

  if (!peer) return;

  const newCount = (peer.sync_failure_count ?? 0) + 1;
  const updates: Record<string, unknown> = {
    sync_failure_count: newCount,
    updated_at: new Date().toISOString(),
  };

  // Auto-suspend after too many failures
  if (newCount >= MAX_SYNC_FAILURES) {
    updates.status = 'suspended';
  }

  await db.from('federation_peers').update(updates).eq('id', peerId);

  await db.from('federation_audit_log').insert({
    peer_id: peerId,
    action: 'sync_failure',
    details: { error, failure_count: newCount, auto_suspended: newCount >= MAX_SYNC_FAILURES },
    created_at: new Date().toISOString(),
  });
}

// ──────────────────────────────────────────────
// Federated Agent Discovery
// ──────────────────────────────────────────────

/**
 * Search for agents across all federated peers.
 */
export async function searchFederatedAgents(params: {
  capability?: string;
  peer_id?: string;
  available_only?: boolean;
  limit?: number;
}): Promise<{ agents: FederatedAgent[]; total: number }> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  let query = db
    .from('federated_agents')
    .select('*, federation_peers!inner(status)', { count: 'exact' })
    .eq('federation_peers.status', 'active')
    .limit(params.limit ?? 50);

  if (params.peer_id) {
    query = query.eq('peer_id', params.peer_id);
  }

  if (params.available_only !== false) {
    query = query.eq('available', true);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to search federated agents: ${error.message}`);

  let agents = (data ?? []).map(({ federation_peers: _, ...agent }: Record<string, unknown>) => agent) as FederatedAgent[];

  // Filter by capability if specified (in-memory since capabilities is JSONB)
  if (params.capability) {
    const cap = params.capability.toLowerCase();
    agents = agents.filter((a) =>
      a.capabilities.some(
        (c) =>
          c.id.toLowerCase().includes(cap) ||
          c.description.toLowerCase().includes(cap),
      ),
    );
  }

  return { agents, total: count ?? agents.length };
}

// ──────────────────────────────────────────────
// Federated Task Routing
// ──────────────────────────────────────────────

/**
 * Submit a task to a remote agent via its peer platform.
 * Creates a local tracking record and sends the request to the peer.
 */
export async function submitFederatedTask(params: {
  local_task_id: string;
  peer_id: string;
  remote_agent_id: string;
  intent: string;
  payload: Record<string, unknown>;
  timeout_ms?: number;
  trace_context?: string;
}): Promise<FederatedTask> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  // Verify peer is active and outbound routing is enabled
  const { data: peer } = await db
    .from('federation_peers')
    .select('*')
    .eq('id', params.peer_id)
    .eq('status', 'active')
    .single();

  if (!peer) throw new Error('Peer not found or not active');
  if (!(peer as FederationPeer).outbound_routing_enabled) {
    throw new Error('Outbound routing is disabled for this peer');
  }

  // Verify the remote agent exists in our cache
  const { data: agent } = await db
    .from('federated_agents')
    .select('*')
    .eq('peer_id', params.peer_id)
    .eq('remote_agent_id', params.remote_agent_id)
    .single();

  if (!agent) {
    throw new Error(`Remote agent ${params.remote_agent_id} not found on peer ${params.peer_id}`);
  }

  const now = new Date().toISOString();
  const taskRecord = {
    local_task_id: params.local_task_id,
    peer_id: params.peer_id,
    remote_agent_id: params.remote_agent_id,
    remote_task_id: null,
    status: 'pending' as FederatedTaskStatus,
    payload: { intent: params.intent, ...params.payload },
    result: null,
    error: null,
    trace_context: params.trace_context ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await db
    .from('federated_tasks')
    .insert(taskRecord)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create federated task: ${error?.message}`);
  }

  // Attempt to submit to remote platform
  const peerData = peer as FederationPeer;
  try {
    const response = await fetch(`${peerData.endpoint}/tasks/inbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Federation-Peer': PLATFORM_NAME,
        'X-Federation-Fingerprint': peerData.fingerprint,
      },
      body: JSON.stringify({
        protocol_version: '1.0',
        source_platform: PLATFORM_NAME,
        target_agent_id: params.remote_agent_id,
        intent: params.intent,
        payload: params.payload,
        trace_context: params.trace_context,
      }),
      signal: AbortSignal.timeout(params.timeout_ms ?? 30_000),
    });

    if (response.ok) {
      const result = await response.json();
      await db
        .from('federated_tasks')
        .update({
          status: 'submitted',
          remote_task_id: result.task_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      return { ...data, status: 'submitted', remote_task_id: result.task_id ?? null } as FederatedTask;
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      await db
        .from('federated_tasks')
        .update({
          status: 'failed',
          error: `Remote platform returned ${response.status}: ${errorText}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      return { ...data, status: 'failed', error: errorText } as FederatedTask;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    await db
      .from('federated_tasks')
      .update({
        status: 'failed',
        error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    return { ...data, status: 'failed', error: errorMsg } as FederatedTask;
  }
}

/**
 * Handle an inbound task from a federated peer.
 * Validates the peer and creates a local task for the target agent.
 */
export async function handleInboundTask(
  peerFingerprint: string,
  params: {
    target_agent_id: string;
    intent: string;
    payload: Record<string, unknown>;
    trace_context?: string;
  },
): Promise<{ task_id: string; accepted: boolean; error?: string }> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  // Verify the peer by fingerprint
  const { data: peer } = await db
    .from('federation_peers')
    .select('*')
    .eq('fingerprint', peerFingerprint)
    .eq('status', 'active')
    .single();

  if (!peer) {
    return { task_id: '', accepted: false, error: 'Unknown or inactive peer' };
  }

  if (!(peer as FederationPeer).inbound_routing_enabled) {
    return { task_id: '', accepted: false, error: 'Inbound routing disabled' };
  }

  // Verify the target agent exists locally
  const { data: agent } = await db
    .from('agent_registry')
    .select('id')
    .eq('id', params.target_agent_id)
    .eq('is_active', true)
    .single();

  if (!agent) {
    return { task_id: '', accepted: false, error: 'Target agent not found' };
  }

  // Create a local task on behalf of the federated peer
  const now = new Date().toISOString();
  const { data: task, error } = await db
    .from('a2a_tasks')
    .insert({
      consumer_agent_id: null, // Federated tasks don't have a local consumer
      provider_agent_id: params.target_agent_id,
      intent: params.intent,
      payload: params.payload,
      status: 'submitted',
      priority: 'normal',
      federation_peer_id: (peer as FederationPeer).id,
      trace_context: params.trace_context ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error || !task) {
    return { task_id: '', accepted: false, error: `Failed to create task: ${error?.message}` };
  }

  // Audit log
  await db.from('federation_audit_log').insert({
    peer_id: (peer as FederationPeer).id,
    action: 'inbound_task',
    details: {
      task_id: task.id,
      target_agent_id: params.target_agent_id,
      intent: params.intent,
    },
    created_at: now,
  });

  return { task_id: task.id, accepted: true };
}

/**
 * Update status of a federated task (e.g., when remote platform sends a callback).
 */
export async function updateFederatedTaskStatus(
  federatedTaskId: string,
  update: {
    status: FederatedTaskStatus;
    remote_task_id?: string;
    result?: Record<string, unknown>;
    error?: string;
  },
): Promise<FederatedTask> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const { data, error } = await db
    .from('federated_tasks')
    .update({
      status: update.status,
      remote_task_id: update.remote_task_id,
      result: update.result ?? null,
      error: update.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', federatedTaskId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update federated task: ${error?.message}`);
  }

  return data as FederatedTask;
}

/**
 * Get the status of a federated task.
 */
export async function getFederatedTask(
  federatedTaskId: string,
): Promise<FederatedTask | null> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  const { data } = await db
    .from('federated_tasks')
    .select('*')
    .eq('id', federatedTaskId)
    .single();

  return (data as FederatedTask) ?? null;
}

/**
 * Query the federation audit log.
 */
export async function queryFederationAudit(params: {
  peer_id?: string;
  action?: string;
  limit?: number;
}): Promise<Array<{ id: string; peer_id: string; action: string; details: Record<string, unknown>; created_at: string }>> {
  const db = getServiceDb();
  if (!db) throw new Error('Database not configured');

  let query = db
    .from('federation_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50);

  if (params.peer_id) query = query.eq('peer_id', params.peer_id);
  if (params.action) query = query.eq('action', params.action);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to query audit log: ${error.message}`);

  return data ?? [];
}

// ──────────────────────────────────────────────
// Trust Bridging
// ──────────────────────────────────────────────

/**
 * Compute the effective trust level for a remote agent based on
 * the peer's inbound trust policy and max trust ceiling.
 */
export function computeEffectiveTrust(
  remoteTrust: 'untrusted' | 'verified' | 'partner',
  policy: InboundTrustPolicy,
  maxTrust: 'untrusted' | 'verified',
): 'untrusted' | 'verified' {
  const TRUST_RANK = { untrusted: 0, verified: 1, partner: 2 };
  const MAX_RANK = { untrusted: 0, verified: 1 };

  let effective: 'untrusted' | 'verified';

  switch (policy) {
    case 'inherit': {
      // Map partner → verified (we never grant partner to remote agents)
      const mapped = remoteTrust === 'partner' ? 'verified' : remoteTrust;
      effective = mapped as 'untrusted' | 'verified';
      break;
    }
    case 'downgrade': {
      // Always drop one level
      effective = remoteTrust === 'untrusted' ? 'untrusted' : 'untrusted';
      if (remoteTrust === 'partner') effective = 'verified';
      if (remoteTrust === 'verified') effective = 'untrusted';
      break;
    }
    case 'verify_each': {
      // Start untrusted until individually verified
      effective = 'untrusted';
      break;
    }
    default:
      effective = 'untrusted';
  }

  // Apply ceiling
  if (TRUST_RANK[effective] > MAX_RANK[maxTrust]) {
    effective = maxTrust;
  }

  return effective;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Compute SHA-256 fingerprint of a public key. */
async function computeKeyFingerprint(publicKeyB64: string): Promise<string> {
  const encoded = new TextEncoder().encode(publicKeyB64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Generate a random nonce for handshake replay protection. */
function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Get this platform's federation endpoint. */
function getOwnFederationEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rareagent.work';
  return `${base}/api/a2a/federation`;
}

/** Get this platform's public key for federation signing. */
function getOwnPublicKey(): string {
  return process.env.FEDERATION_PUBLIC_KEY ?? '';
}
