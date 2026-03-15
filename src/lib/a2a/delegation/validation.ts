/**
 * Zod validation schemas for A2A Delegation endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

const delegatableActions = [
  'task.submit', 'task.update', 'task.read',
  'billing.read', 'billing.spend',
  'contract.negotiate', 'contract.read',
  'auction.bid', 'auction.create',
  'context.read', 'context.write',
  'channel.send', 'profile.read', 'workflow.trigger',
] as const;

// ──────────────────────────────────────────────
// Create Delegation — POST /api/a2a/delegations
// ──────────────────────────────────────────────

export const delegationCreateSchema = z.object({
  delegate_agent_id: z.string().uuid('delegate_agent_id must be a valid UUID'),
  scopes: z.array(z.enum(delegatableActions)).min(1, 'At least one scope is required'),
  resource_ids: z.array(z.string().uuid()).optional(),
  spend_limit_per_action: z.number().positive().max(1_000_000).optional(),
  spend_limit_total: z.number().positive().max(10_000_000).optional(),
  allow_subdelegation: z.boolean().default(false),
  max_chain_depth: z.number().int().min(0).max(5).default(2),
  reason: trimmed(1000).min(1, 'reason is required'),
  starts_at: z.string().datetime().optional(),
  expires_at: z.string().datetime('expires_at must be ISO-8601'),
});

export type DelegationCreateInput = z.infer<typeof delegationCreateSchema>;

// ──────────────────────────────────────────────
// List Delegations — GET /api/a2a/delegations
// ──────────────────────────────────────────────

export const delegationListSchema = z.object({
  role: z.enum(['grantor', 'delegate']).optional(),
  status: z.enum(['pending', 'active', 'expired', 'revoked']).optional(),
  scope: z.enum(delegatableActions).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type DelegationListInput = z.infer<typeof delegationListSchema>;

// ──────────────────────────────────────────────
// Check Delegation — POST /api/a2a/delegations/check
// ──────────────────────────────────────────────

export const delegationCheckSchema = z.object({
  delegate_agent_id: z.string().uuid(),
  grantor_agent_id: z.string().uuid(),
  action: z.enum(delegatableActions),
  resource_id: z.string().uuid().optional(),
  spend_amount: z.number().positive().optional(),
});

export type DelegationCheckInput = z.infer<typeof delegationCheckSchema>;
