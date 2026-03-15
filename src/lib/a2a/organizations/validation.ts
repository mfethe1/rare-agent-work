/**
 * Zod validation schemas for Agent Organizations endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

const orgRoleSchema = z.enum(['owner', 'admin', 'operator', 'member', 'viewer']);

const orgPermissionSchema = z.enum([
  'org.manage', 'org.dissolve',
  'members.invite', 'members.remove', 'members.role_assign',
  'billing.spend', 'billing.manage',
  'policy.manage',
  'tasks.submit', 'tasks.view',
  'contracts.negotiate', 'collaboration.manage',
  'audit.view',
]);

const collaborationBillingSchema = z.enum([
  'sender_pays', 'receiver_pays', 'split', 'free',
]);

const orgSettingsSchema = z.object({
  max_members: z.number().int().min(2).max(10000).optional(),
  trust_inheritance_enabled: z.boolean().optional(),
  default_daily_spend_limit: z.number().min(0).max(1_000_000).optional(),
  policy_inheritance_enabled: z.boolean().optional(),
  require_approval: z.boolean().optional(),
}).optional();

// ── Create Organization ────────────────────────────────────────────────────

export const createOrgSchema = z.object({
  handle: trimmed(64)
    .min(3)
    .regex(/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/, 'Handle must be lowercase alphanumeric with hyphens, min 3 chars'),
  name: trimmed(200).min(1),
  description: trimmed(2000).min(1),
  callback_url: trimmed(2000).url().optional(),
  settings: orgSettingsSchema,
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

// ── Update Organization ────────────────────────────────────────────────────

export const updateOrgSchema = z.object({
  name: trimmed(200).min(1).optional(),
  description: trimmed(2000).min(1).optional(),
  callback_url: trimmed(2000).url().optional(),
  settings: orgSettingsSchema,
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

// ── List Organizations ─────────────────────────────────────────────────────

export const listOrgsSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'dissolved']).optional(),
  member_agent_id: trimmed(100).optional(),
  query: trimmed(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListOrgsInput = z.infer<typeof listOrgsSchema>;

// ── Invite Member ──────────────────────────────────────────────────────────

export const inviteMemberSchema = z.object({
  agent_id: trimmed(100).min(1),
  role: orgRoleSchema.refine(r => r !== 'owner', { message: 'Cannot invite as owner' }),
  daily_spend_limit: z.number().min(0).max(1_000_000).optional(),
  extra_permissions: z.array(orgPermissionSchema).max(20).optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// ── Update Member ──────────────────────────────────────────────────────────

export const updateMemberSchema = z.object({
  role: orgRoleSchema.refine(r => r !== 'owner', { message: 'Cannot assign owner role via update' }).optional(),
  daily_spend_limit: z.number().min(0).max(1_000_000).optional(),
  extra_permissions: z.array(orgPermissionSchema).max(20).optional(),
  revoked_permissions: z.array(orgPermissionSchema).max(20).optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ── List Members ───────────────────────────────────────────────────────────

export const listMembersSchema = z.object({
  status: z.enum(['invited', 'active', 'suspended', 'departed']).optional(),
  role: orgRoleSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ListMembersInput = z.infer<typeof listMembersSchema>;

// ── Propose Collaboration ──────────────────────────────────────────────────

export const proposeCollaborationSchema = z.object({
  responder_org_id: trimmed(100).min(1),
  purpose: trimmed(2000).min(1),
  shared_capabilities: z.array(trimmed(200)).min(1).max(50),
  mutual_trust_level: z.enum(['untrusted', 'verified', 'partner']).default('verified'),
  billing_mode: collaborationBillingSchema.default('sender_pays'),
  daily_spend_cap: z.number().min(0).max(1_000_000).optional(),
  expires_in_days: z.number().int().min(1).max(365).default(90),
});

export type ProposeCollaborationInput = z.infer<typeof proposeCollaborationSchema>;

// ── Accept Collaboration ───────────────────────────────────────────────────

export const acceptCollaborationSchema = z.object({
  shared_capabilities: z.array(trimmed(200)).min(1).max(50),
});

export type AcceptCollaborationInput = z.infer<typeof acceptCollaborationSchema>;

// ── List Collaborations ────────────────────────────────────────────────────

export const listCollaborationsSchema = z.object({
  status: z.enum(['proposed', 'active', 'suspended', 'terminated']).optional(),
  partner_org_id: trimmed(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListCollaborationsInput = z.infer<typeof listCollaborationsSchema>;

// ── Org Audit ──────────────────────────────────────────────────────────────

export const orgAuditSchema = z.object({
  action: z.string().optional(),
  actor_agent_id: trimmed(100).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export type OrgAuditInput = z.infer<typeof orgAuditSchema>;
