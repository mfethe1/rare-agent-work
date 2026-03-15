/**
 * A2A Federation Protocol — Validation Schemas
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// Peer Management
// ──────────────────────────────────────────────

export const peerCreateSchema = z.object({
  name: z.string().min(1).max(200),
  endpoint: z.string().url(),
  public_key: z.string().min(32).max(256),
  inbound_trust_policy: z.enum(['inherit', 'downgrade', 'verify_each']).default('downgrade'),
  max_inbound_trust: z.enum(['untrusted', 'verified']).default('verified'),
  outbound_routing_enabled: z.boolean().default(true),
  inbound_routing_enabled: z.boolean().default(true),
  shared_capabilities: z.array(z.string()).default([]),
});
export type PeerCreateInput = z.infer<typeof peerCreateSchema>;

export const peerListSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'revoked']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PeerListInput = z.infer<typeof peerListSchema>;

export const peerAcceptSchema = z.object({
  peering_request: z.object({
    protocol_version: z.literal('1.0'),
    platform_name: z.string().min(1),
    endpoint: z.string().url(),
    public_key: z.string().min(32).max(256),
    shared_capabilities: z.array(z.string()),
    nonce: z.string().min(16).max(128),
    timestamp: z.string().datetime(),
    signature: z.string().min(1),
  }),
});
export type PeerAcceptInput = z.infer<typeof peerAcceptSchema>;

// ──────────────────────────────────────────────
// Federated Agent Discovery
// ──────────────────────────────────────────────

export const federatedAgentSearchSchema = z.object({
  capability: z.string().optional(),
  peer_id: z.string().uuid().optional(),
  available_only: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(true),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type FederatedAgentSearchInput = z.infer<typeof federatedAgentSearchSchema>;

// ──────────────────────────────────────────────
// Federated Task Submission
// ──────────────────────────────────────────────

export const federatedTaskSubmitSchema = z.object({
  local_task_id: z.string().uuid(),
  peer_id: z.string().uuid(),
  remote_agent_id: z.string().min(1),
  intent: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()).default({}),
  timeout_ms: z.number().int().min(1000).max(300_000).default(30_000),
  trace_context: z.string().optional(),
});
export type FederatedTaskSubmitInput = z.infer<typeof federatedTaskSubmitSchema>;

// ──────────────────────────────────────────────
// Capability Sync
// ──────────────────────────────────────────────

export const capabilitySyncSchema = z.object({
  protocol_version: z.literal('1.0'),
  timestamp: z.string().datetime(),
  agents: z.array(
    z.object({
      remote_agent_id: z.string().min(1),
      name: z.string().min(1),
      description: z.string(),
      capabilities: z.array(
        z.object({
          id: z.string().min(1),
          description: z.string(),
          input_modes: z.array(z.string()),
          output_modes: z.array(z.string()),
        }),
      ),
      remote_trust_level: z.enum(['untrusted', 'verified', 'partner']),
      key_fingerprint: z.string().optional(),
      available: z.boolean(),
    }),
  ),
  signature: z.string().min(1),
});
export type CapabilitySyncInput = z.infer<typeof capabilitySyncSchema>;

// ──────────────────────────────────────────────
// Peer Status Updates
// ──────────────────────────────────────────────

export const peerSuspendSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type PeerSuspendInput = z.infer<typeof peerSuspendSchema>;
