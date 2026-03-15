/**
 * A2A Federation Protocol — Test Suite
 *
 * Tests the cross-platform federation layer including:
 *   - Peer registration and handshake validation
 *   - Trust bridging (effective trust computation)
 *   - Capability sync processing
 *   - Federated agent discovery
 *   - Federated task lifecycle
 *   - Validation schemas
 */

import { describe, it, expect } from 'vitest';
import { computeEffectiveTrust } from '@/lib/a2a/federation/engine';
import {
  peerCreateSchema,
  peerListSchema,
  peerAcceptSchema,
  federatedAgentSearchSchema,
  federatedTaskSubmitSchema,
  capabilitySyncSchema,
  peerSuspendSchema,
} from '@/lib/a2a/federation/validation';
import type {
  PeerStatus,
  InboundTrustPolicy,
  FederationPeer,
  FederatedAgent,
  RemoteAgentManifest,
  PeeringRequest,
  CapabilitySyncPayload,
} from '@/lib/a2a/federation/types';

// ──────────────────────────────────────────────
// Trust Bridging
// ──────────────────────────────────────────────

describe('computeEffectiveTrust', () => {
  describe('inherit policy', () => {
    it('maps partner → verified (never grants partner to remote agents)', () => {
      expect(computeEffectiveTrust('partner', 'inherit', 'verified')).toBe('verified');
    });

    it('preserves verified as verified', () => {
      expect(computeEffectiveTrust('verified', 'inherit', 'verified')).toBe('verified');
    });

    it('preserves untrusted as untrusted', () => {
      expect(computeEffectiveTrust('untrusted', 'inherit', 'verified')).toBe('untrusted');
    });

    it('respects max_inbound_trust ceiling', () => {
      expect(computeEffectiveTrust('partner', 'inherit', 'untrusted')).toBe('untrusted');
      expect(computeEffectiveTrust('verified', 'inherit', 'untrusted')).toBe('untrusted');
    });
  });

  describe('downgrade policy', () => {
    it('downgrades partner → verified', () => {
      expect(computeEffectiveTrust('partner', 'downgrade', 'verified')).toBe('verified');
    });

    it('downgrades verified → untrusted', () => {
      expect(computeEffectiveTrust('verified', 'downgrade', 'verified')).toBe('untrusted');
    });

    it('keeps untrusted as untrusted', () => {
      expect(computeEffectiveTrust('untrusted', 'downgrade', 'verified')).toBe('untrusted');
    });

    it('respects max_inbound_trust ceiling', () => {
      expect(computeEffectiveTrust('partner', 'downgrade', 'untrusted')).toBe('untrusted');
    });
  });

  describe('verify_each policy', () => {
    it('always starts as untrusted regardless of remote trust', () => {
      expect(computeEffectiveTrust('partner', 'verify_each', 'verified')).toBe('untrusted');
      expect(computeEffectiveTrust('verified', 'verify_each', 'verified')).toBe('untrusted');
      expect(computeEffectiveTrust('untrusted', 'verify_each', 'verified')).toBe('untrusted');
    });
  });
});

// ──────────────────────────────────────────────
// Validation Schemas — Peer Management
// ──────────────────────────────────────────────

describe('peerCreateSchema', () => {
  it('validates a minimal peer creation request', () => {
    const result = peerCreateSchema.safeParse({
      name: 'AgentHub',
      endpoint: 'https://agenthub.ai/api/a2a/federation',
      public_key: 'dGVzdC1wdWJsaWMta2V5LWJhc2U2NHVybC1lbmNvZGVk',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inbound_trust_policy).toBe('downgrade');
      expect(result.data.max_inbound_trust).toBe('verified');
      expect(result.data.outbound_routing_enabled).toBe(true);
      expect(result.data.inbound_routing_enabled).toBe(true);
      expect(result.data.shared_capabilities).toEqual([]);
    }
  });

  it('validates a full peer creation request', () => {
    const result = peerCreateSchema.safeParse({
      name: 'AgentHub',
      endpoint: 'https://agenthub.ai/api/a2a/federation',
      public_key: 'dGVzdC1wdWJsaWMta2V5LWJhc2U2NHVybC1lbmNvZGVk',
      inbound_trust_policy: 'inherit',
      max_inbound_trust: 'untrusted',
      outbound_routing_enabled: false,
      inbound_routing_enabled: true,
      shared_capabilities: ['news.query', 'report.generate'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inbound_trust_policy).toBe('inherit');
      expect(result.data.max_inbound_trust).toBe('untrusted');
      expect(result.data.outbound_routing_enabled).toBe(false);
    }
  });

  it('rejects missing name', () => {
    const result = peerCreateSchema.safeParse({
      endpoint: 'https://agenthub.ai/api/a2a/federation',
      public_key: 'dGVzdA',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid endpoint URL', () => {
    const result = peerCreateSchema.safeParse({
      name: 'Test',
      endpoint: 'not-a-url',
      public_key: 'dGVzdC1wdWJsaWMta2V5LWJhc2U2NHVybC1lbmNvZGVk',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid trust policy', () => {
    const result = peerCreateSchema.safeParse({
      name: 'Test',
      endpoint: 'https://example.com',
      public_key: 'dGVzdC1wdWJsaWMta2V5LWJhc2U2NHVybC1lbmNvZGVk',
      inbound_trust_policy: 'trust_everything',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short public key', () => {
    const result = peerCreateSchema.safeParse({
      name: 'Test',
      endpoint: 'https://example.com',
      public_key: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('peerListSchema', () => {
  it('accepts empty params with defaults', () => {
    const result = peerListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts valid status filter', () => {
    const result = peerListSchema.safeParse({ status: 'active' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = peerListSchema.safeParse({ status: 'unknown' });
    expect(result.success).toBe(false);
  });

  it('coerces string limit/offset', () => {
    const result = peerListSchema.safeParse({ limit: '25', offset: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
      expect(result.data.offset).toBe(10);
    }
  });
});

// ──────────────────────────────────────────────
// Validation Schemas — Peering Handshake
// ──────────────────────────────────────────────

describe('peerAcceptSchema', () => {
  const validRequest: PeeringRequest = {
    protocol_version: '1.0',
    platform_name: 'AgentHub',
    endpoint: 'https://agenthub.ai/api/a2a/federation',
    public_key: 'dGVzdC1wdWJsaWMta2V5LWJhc2U2NHVybC1lbmNvZGVk',
    shared_capabilities: ['news.query'],
    nonce: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    timestamp: '2026-03-14T12:00:00Z',
    signature: 'sig_abc123',
  };

  it('validates a well-formed peering request', () => {
    const result = peerAcceptSchema.safeParse({ peering_request: validRequest });
    expect(result.success).toBe(true);
  });

  it('rejects wrong protocol version', () => {
    const result = peerAcceptSchema.safeParse({
      peering_request: { ...validRequest, protocol_version: '2.0' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing nonce', () => {
    const { nonce, ...withoutNonce } = validRequest;
    const result = peerAcceptSchema.safeParse({ peering_request: withoutNonce });
    expect(result.success).toBe(false);
  });

  it('rejects missing signature', () => {
    const { signature, ...withoutSig } = validRequest;
    const result = peerAcceptSchema.safeParse({ peering_request: withoutSig });
    expect(result.success).toBe(false);
  });

  it('rejects invalid timestamp format', () => {
    const result = peerAcceptSchema.safeParse({
      peering_request: { ...validRequest, timestamp: 'not-a-date' },
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation Schemas — Federated Agent Search
// ──────────────────────────────────────────────

describe('federatedAgentSearchSchema', () => {
  it('accepts empty params with defaults', () => {
    const result = federatedAgentSearchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.available_only).toBe(true);
      expect(result.data.limit).toBe(50);
    }
  });

  it('accepts capability filter', () => {
    const result = federatedAgentSearchSchema.safeParse({ capability: 'news.query' });
    expect(result.success).toBe(true);
  });

  it('accepts peer_id filter', () => {
    const result = federatedAgentSearchSchema.safeParse({
      peer_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid peer_id', () => {
    const result = federatedAgentSearchSchema.safeParse({ peer_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('coerces string available_only', () => {
    const result = federatedAgentSearchSchema.safeParse({ available_only: 'true' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.available_only).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────
// Validation Schemas — Federated Task
// ──────────────────────────────────────────────

describe('federatedTaskSubmitSchema', () => {
  it('validates a complete task submission', () => {
    const result = federatedTaskSubmitSchema.safeParse({
      local_task_id: '550e8400-e29b-41d4-a716-446655440000',
      peer_id: '550e8400-e29b-41d4-a716-446655440001',
      remote_agent_id: 'agent-on-peer',
      intent: 'news.query',
      payload: { topic: 'AI' },
      timeout_ms: 10000,
      trace_context: '00-abc123-def456-01',
    });
    expect(result.success).toBe(true);
  });

  it('applies default timeout', () => {
    const result = federatedTaskSubmitSchema.safeParse({
      local_task_id: '550e8400-e29b-41d4-a716-446655440000',
      peer_id: '550e8400-e29b-41d4-a716-446655440001',
      remote_agent_id: 'agent-on-peer',
      intent: 'report.generate',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeout_ms).toBe(30_000);
      expect(result.data.payload).toEqual({});
    }
  });

  it('rejects timeout below 1 second', () => {
    const result = federatedTaskSubmitSchema.safeParse({
      local_task_id: '550e8400-e29b-41d4-a716-446655440000',
      peer_id: '550e8400-e29b-41d4-a716-446655440001',
      remote_agent_id: 'agent-on-peer',
      intent: 'test',
      timeout_ms: 500,
    });
    expect(result.success).toBe(false);
  });

  it('rejects timeout above 5 minutes', () => {
    const result = federatedTaskSubmitSchema.safeParse({
      local_task_id: '550e8400-e29b-41d4-a716-446655440000',
      peer_id: '550e8400-e29b-41d4-a716-446655440001',
      remote_agent_id: 'agent-on-peer',
      intent: 'test',
      timeout_ms: 600_000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(federatedTaskSubmitSchema.safeParse({}).success).toBe(false);
    expect(federatedTaskSubmitSchema.safeParse({ local_task_id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation Schemas — Capability Sync
// ──────────────────────────────────────────────

describe('capabilitySyncSchema', () => {
  const validSync: CapabilitySyncPayload = {
    protocol_version: '1.0',
    timestamp: '2026-03-14T12:00:00Z',
    agents: [
      {
        remote_agent_id: 'agent-1',
        name: 'News Agent',
        description: 'Queries news feeds',
        capabilities: [
          {
            id: 'news.query',
            description: 'Query curated AI news',
            input_modes: ['application/json'],
            output_modes: ['application/json'],
          },
        ],
        remote_trust_level: 'verified',
        key_fingerprint: 'abc123',
        available: true,
      },
    ],
    signature: 'sig_sync_abc',
  };

  it('validates a well-formed sync payload', () => {
    const result = capabilitySyncSchema.safeParse(validSync);
    expect(result.success).toBe(true);
  });

  it('accepts empty agent list', () => {
    const result = capabilitySyncSchema.safeParse({
      ...validSync,
      agents: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts multiple agents', () => {
    const result = capabilitySyncSchema.safeParse({
      ...validSync,
      agents: [
        validSync.agents[0],
        { ...validSync.agents[0], remote_agent_id: 'agent-2', name: 'Report Agent' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agents).toHaveLength(2);
    }
  });

  it('rejects missing signature', () => {
    const { signature, ...withoutSig } = validSync;
    const result = capabilitySyncSchema.safeParse(withoutSig);
    expect(result.success).toBe(false);
  });

  it('rejects invalid trust level in agent manifest', () => {
    const result = capabilitySyncSchema.safeParse({
      ...validSync,
      agents: [{ ...validSync.agents[0], remote_trust_level: 'admin' }],
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation Schemas — Peer Suspend
// ──────────────────────────────────────────────

describe('peerSuspendSchema', () => {
  it('validates a reason', () => {
    const result = peerSuspendSchema.safeParse({ reason: 'Trust violation detected' });
    expect(result.success).toBe(true);
  });

  it('rejects empty reason', () => {
    const result = peerSuspendSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing reason', () => {
    const result = peerSuspendSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Type Completeness Checks
// ──────────────────────────────────────────────

describe('federation type definitions', () => {
  it('PeerStatus has all expected values', () => {
    const statuses: PeerStatus[] = ['pending', 'active', 'suspended', 'revoked'];
    expect(statuses).toHaveLength(4);
  });

  it('InboundTrustPolicy has all expected values', () => {
    const policies: InboundTrustPolicy[] = ['inherit', 'downgrade', 'verify_each'];
    expect(policies).toHaveLength(3);
  });

  it('FederationPeer has required shape', () => {
    const peer: FederationPeer = {
      id: 'test-id',
      name: 'Test Peer',
      endpoint: 'https://test.ai/api/a2a/federation',
      public_key: 'key',
      fingerprint: 'fp',
      status: 'active',
      inbound_trust_policy: 'downgrade',
      max_inbound_trust: 'verified',
      outbound_routing_enabled: true,
      inbound_routing_enabled: true,
      last_sync_at: null,
      sync_failure_count: 0,
      created_at: '2026-03-14T00:00:00Z',
      updated_at: '2026-03-14T00:00:00Z',
    };
    expect(peer.status).toBe('active');
  });

  it('FederatedAgent has required shape', () => {
    const agent: FederatedAgent = {
      id: 'local-id',
      peer_id: 'peer-id',
      remote_agent_id: 'remote-agent-1',
      name: 'Remote News Agent',
      description: 'Queries news',
      capabilities: [{
        id: 'news.query',
        description: 'Query news',
        input_modes: ['application/json'],
        output_modes: ['application/json'],
      }],
      effective_trust: 'untrusted',
      available: true,
      synced_at: '2026-03-14T00:00:00Z',
      created_at: '2026-03-14T00:00:00Z',
    };
    expect(agent.effective_trust).toBe('untrusted');
  });

  it('RemoteAgentManifest has required shape', () => {
    const manifest: RemoteAgentManifest = {
      remote_agent_id: 'agent-1',
      name: 'Agent',
      description: 'Does things',
      capabilities: [],
      remote_trust_level: 'verified',
      key_fingerprint: 'fp123',
      available: true,
    };
    expect(manifest.remote_trust_level).toBe('verified');
  });
});

// ──────────────────────────────────────────────
// Trust Bridging Edge Cases
// ──────────────────────────────────────────────

describe('trust bridging edge cases', () => {
  it('all policy × trust level × max_trust combinations produce valid output', () => {
    const policies: InboundTrustPolicy[] = ['inherit', 'downgrade', 'verify_each'];
    const remoteTrusts = ['untrusted', 'verified', 'partner'] as const;
    const maxTrusts = ['untrusted', 'verified'] as const;

    for (const policy of policies) {
      for (const remote of remoteTrusts) {
        for (const max of maxTrusts) {
          const result = computeEffectiveTrust(remote, policy, max);
          expect(['untrusted', 'verified']).toContain(result);
          // Result should never exceed max
          const RANK = { untrusted: 0, verified: 1 };
          expect(RANK[result]).toBeLessThanOrEqual(RANK[max]);
        }
      }
    }
  });

  it('downgrade policy never elevates trust', () => {
    // An untrusted agent should stay untrusted under downgrade
    expect(computeEffectiveTrust('untrusted', 'downgrade', 'verified')).toBe('untrusted');
  });

  it('verify_each is the most conservative policy', () => {
    // Should always return untrusted
    const remoteTrusts = ['untrusted', 'verified', 'partner'] as const;
    for (const remote of remoteTrusts) {
      expect(computeEffectiveTrust(remote, 'verify_each', 'verified')).toBe('untrusted');
    }
  });
});
