/**
 * A2A Agent Organizations Engine
 *
 * Implements organizational hierarchy for agent fleets:
 *
 * 1. **Organization CRUD** — Create, update, suspend, dissolve orgs. Each org
 *    registers as a first-class agent in the registry with the union of member
 *    capabilities.
 *
 * 2. **Membership Management** — Invite, accept, update roles, suspend, remove
 *    members. RBAC enforced at every mutation. Role hierarchy prevents
 *    privilege escalation.
 *
 * 3. **Trust Inheritance** — Members inherit the org's trust level when
 *    trust_inheritance_enabled is true and their personal level is lower.
 *
 * 4. **Cross-Org Collaboration** — Organizations can establish bilateral
 *    collaboration agreements with shared capabilities, mutual trust, and
 *    billing terms.
 *
 * 5. **Audit Trail** — Every mutation is recorded for compliance and
 *    transparency.
 */

import { getServiceDb } from '../auth';
import type {
  Organization,
  OrgMember,
  OrgCollaboration,
  OrgAuditEntry,
  OrgRole,
  OrgPermission,
  OrgStatus,
  OrgSettings,
  MembershipStatus,
  CollaborationStatus,
  OrgAuditAction,
} from './types';
import { ROLE_PERMISSIONS, ROLE_RANK, DEFAULT_ORG_SETTINGS } from './types';
import type {
  CreateOrgInput,
  UpdateOrgInput,
  ListOrgsInput,
  InviteMemberInput,
  UpdateMemberInput,
  ListMembersInput,
  ProposeCollaborationInput,
  AcceptCollaborationInput,
  ListCollaborationsInput,
  OrgAuditInput,
} from './validation';

// ── Helpers ─────────────────────────────────────────────────────────────────

type Result<T> = T | { error: string; status_code: number };

function err(message: string, status_code: number): { error: string; status_code: number } {
  return { error: message, status_code };
}

/** Check if a member has a specific permission (role defaults + extras - revoked). */
export function hasPermission(member: OrgMember, permission: OrgPermission): boolean {
  if (member.revoked_permissions.includes(permission)) return false;
  if (member.extra_permissions.includes(permission)) return true;
  return ROLE_PERMISSIONS[member.role].includes(permission);
}

/** Get the effective permissions for a member. */
export function getEffectivePermissions(member: OrgMember): OrgPermission[] {
  const base = new Set(ROLE_PERMISSIONS[member.role]);
  for (const p of member.extra_permissions) base.add(p);
  for (const p of member.revoked_permissions) base.delete(p);
  return Array.from(base);
}

/** Record an audit entry. */
async function audit(
  org_id: string,
  actor_agent_id: string,
  action: OrgAuditAction,
  details: Record<string, unknown> = {},
  target_agent_id?: string,
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;
  await db.from('a2a_org_audit').insert({
    org_id,
    actor_agent_id,
    action,
    target_agent_id: target_agent_id ?? null,
    details,
  });
}

/** Get the calling agent's membership in an org, or null. */
async function getMembership(org_id: string, agent_id: string): Promise<OrgMember | null> {
  const db = getServiceDb();
  if (!db) return null;
  const { data } = await db
    .from('a2a_org_members')
    .select('*')
    .eq('org_id', org_id)
    .eq('agent_id', agent_id)
    .eq('status', 'active')
    .single();
  if (!data) return null;
  return {
    ...data,
    extra_permissions: data.extra_permissions ?? [],
    revoked_permissions: data.revoked_permissions ?? [],
  } as OrgMember;
}

/** Recompute the org's aggregate capabilities from active members. */
async function refreshOrgCapabilities(org_id: string): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  // Get all active member agent IDs
  const { data: members } = await db
    .from('a2a_org_members')
    .select('agent_id')
    .eq('org_id', org_id)
    .eq('status', 'active');

  if (!members || members.length === 0) {
    await db.from('a2a_organizations').update({ capabilities: [] }).eq('id', org_id);
    return;
  }

  const agentIds = members.map(m => m.agent_id);
  const { data: agents } = await db
    .from('agent_registry')
    .select('capabilities')
    .in('id', agentIds)
    .eq('is_active', true);

  const capSet = new Set<string>();
  for (const agent of agents ?? []) {
    for (const cap of agent.capabilities ?? []) {
      if (typeof cap === 'object' && cap.id) capSet.add(cap.id);
      else if (typeof cap === 'string') capSet.add(cap);
    }
  }

  const capabilities = Array.from(capSet);
  await db.from('a2a_organizations').update({ capabilities }).eq('id', org_id);

  // Also update the org's agent registry entry
  const { data: org } = await db
    .from('a2a_organizations')
    .select('agent_id')
    .eq('id', org_id)
    .single();

  if (org?.agent_id) {
    const capObjects = capabilities.map(id => ({
      id,
      description: `Provided by org member`,
      input_modes: ['application/json'],
      output_modes: ['application/json'],
    }));
    await db
      .from('agent_registry')
      .update({ capabilities: capObjects })
      .eq('id', org.agent_id);
  }
}

// ── Create Organization ─────────────────────────────────────────────────────

interface CreateOrgParams {
  creator_agent_id: string;
  input: CreateOrgInput;
}

export async function createOrg({ creator_agent_id, input }: CreateOrgParams): Promise<
  Result<{ organization: Organization; membership: OrgMember }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  // Verify creator exists
  const { data: creator } = await db
    .from('agent_registry')
    .select('id, name, capabilities')
    .eq('id', creator_agent_id)
    .eq('is_active', true)
    .single();

  if (!creator) return err('Creator agent not found or inactive', 404);

  // Check handle uniqueness
  const { data: existing } = await db
    .from('a2a_organizations')
    .select('id')
    .eq('handle', input.handle)
    .maybeSingle();

  if (existing) return err(`Handle "${input.handle}" is already taken`, 409);

  const now = new Date().toISOString();
  const settings: OrgSettings = { ...DEFAULT_ORG_SETTINGS, ...input.settings };

  // Register the org as a first-class agent in the registry
  const orgAgentName = `org:${input.handle}`;
  const { data: orgAgent, error: agentErr } = await db
    .from('agent_registry')
    .insert({
      name: orgAgentName,
      description: `Organization: ${input.name} — ${input.description}`,
      callback_url: input.callback_url ?? null,
      capabilities: [],
      trust_level: 'verified',
      is_active: true,
    })
    .select('id')
    .single();

  if (agentErr || !orgAgent) return err('Failed to register org agent', 500);

  // Create the organization
  const { data: org, error: orgErr } = await db
    .from('a2a_organizations')
    .insert({
      handle: input.handle,
      name: input.name,
      description: input.description,
      status: 'active' as OrgStatus,
      trust_level: 'verified',
      callback_url: input.callback_url ?? null,
      capabilities: [],
      settings,
      agent_id: orgAgent.id,
      created_by: creator_agent_id,
    })
    .select('*')
    .single();

  if (orgErr || !org) return err('Failed to create organization', 500);

  // Add creator as owner
  const { data: membership, error: memErr } = await db
    .from('a2a_org_members')
    .insert({
      org_id: org.id,
      agent_id: creator_agent_id,
      role: 'owner' as OrgRole,
      status: 'active' as MembershipStatus,
      daily_spend_limit: null,
      extra_permissions: [],
      revoked_permissions: [],
      invited_by: creator_agent_id,
      joined_at: now,
    })
    .select('*')
    .single();

  if (memErr || !membership) return err('Failed to add creator as owner', 500);

  await refreshOrgCapabilities(org.id);
  await audit(org.id, creator_agent_id, 'org.created', { handle: input.handle, name: input.name });

  return {
    organization: org as Organization,
    membership: {
      ...membership,
      extra_permissions: membership.extra_permissions ?? [],
      revoked_permissions: membership.revoked_permissions ?? [],
    } as OrgMember,
  };
}

// ── Get Organization Detail ─────────────────────────────────────────────────

export async function getOrgDetail(org_id: string): Promise<
  Result<{ organization: Organization; members: OrgMember[]; member_count: number }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: org } = await db
    .from('a2a_organizations')
    .select('*')
    .eq('id', org_id)
    .single();

  if (!org) return err('Organization not found', 404);

  const { data: members, count } = await db
    .from('a2a_org_members')
    .select('*', { count: 'exact' })
    .eq('org_id', org_id)
    .in('status', ['active', 'invited']);

  return {
    organization: org as Organization,
    members: (members ?? []).map(m => ({
      ...m,
      extra_permissions: m.extra_permissions ?? [],
      revoked_permissions: m.revoked_permissions ?? [],
    })) as OrgMember[],
    member_count: count ?? 0,
  };
}

// ── List Organizations ──────────────────────────────────────────────────────

export async function listOrgs(input: ListOrgsInput): Promise<
  Result<{ organizations: Organization[]; count: number }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  let query = db.from('a2a_organizations').select('*', { count: 'exact' });

  if (input.status) query = query.eq('status', input.status);
  if (input.query) query = query.or(`name.ilike.%${input.query}%,handle.ilike.%${input.query}%`);

  if (input.member_agent_id) {
    // Get org IDs where this agent is an active member
    const { data: memberships } = await db
      .from('a2a_org_members')
      .select('org_id')
      .eq('agent_id', input.member_agent_id)
      .eq('status', 'active');

    const orgIds = (memberships ?? []).map(m => m.org_id);
    if (orgIds.length === 0) return { organizations: [], count: 0 };
    query = query.in('id', orgIds);
  }

  query = query.order('created_at', { ascending: false });
  query = query.range(input.offset, input.offset + input.limit - 1);

  const { data, count } = await query;

  return {
    organizations: (data ?? []) as Organization[],
    count: count ?? 0,
  };
}

// ── Update Organization ─────────────────────────────────────────────────────

interface UpdateOrgParams {
  org_id: string;
  actor_agent_id: string;
  input: UpdateOrgInput;
}

export async function updateOrg({ org_id, actor_agent_id, input }: UpdateOrgParams): Promise<
  Result<{ organization: Organization }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const member = await getMembership(org_id, actor_agent_id);
  if (!member) return err('Not a member of this organization', 403);
  if (!hasPermission(member, 'org.manage')) return err('Insufficient permissions: org.manage required', 403);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name) updates.name = input.name;
  if (input.description) updates.description = input.description;
  if (input.callback_url) updates.callback_url = input.callback_url;

  if (input.settings) {
    const { data: current } = await db
      .from('a2a_organizations')
      .select('settings')
      .eq('id', org_id)
      .single();

    updates.settings = { ...(current?.settings ?? DEFAULT_ORG_SETTINGS), ...input.settings };
  }

  const { data: org, error: updateErr } = await db
    .from('a2a_organizations')
    .update(updates)
    .eq('id', org_id)
    .select('*')
    .single();

  if (updateErr || !org) return err('Failed to update organization', 500);

  await audit(org_id, actor_agent_id, 'org.updated', { changes: Object.keys(updates) });

  return { organization: org as Organization };
}

// ── Dissolve Organization ───────────────────────────────────────────────────

export async function dissolveOrg(org_id: string, actor_agent_id: string): Promise<
  Result<{ organization: Organization }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const member = await getMembership(org_id, actor_agent_id);
  if (!member) return err('Not a member of this organization', 403);
  if (!hasPermission(member, 'org.dissolve')) return err('Insufficient permissions: org.dissolve required', 403);

  const now = new Date().toISOString();

  // Mark all members as departed
  await db
    .from('a2a_org_members')
    .update({ status: 'departed' as MembershipStatus, updated_at: now })
    .eq('org_id', org_id)
    .in('status', ['active', 'invited', 'suspended']);

  // Terminate active collaborations
  await db
    .from('a2a_org_collaborations')
    .update({ status: 'terminated' as CollaborationStatus, updated_at: now })
    .or(`proposer_org_id.eq.${org_id},responder_org_id.eq.${org_id}`)
    .in('status', ['proposed', 'active']);

  // Dissolve the org
  const { data: org } = await db
    .from('a2a_organizations')
    .update({ status: 'dissolved' as OrgStatus, updated_at: now })
    .eq('id', org_id)
    .select('*')
    .single();

  if (!org) return err('Failed to dissolve organization', 500);

  // Deactivate the org's agent registry entry
  if (org.agent_id) {
    await db.from('agent_registry').update({ is_active: false }).eq('id', org.agent_id);
  }

  await audit(org_id, actor_agent_id, 'org.dissolved');

  return { organization: org as Organization };
}

// ── Invite Member ───────────────────────────────────────────────────────────

interface InviteMemberParams {
  org_id: string;
  actor_agent_id: string;
  input: InviteMemberInput;
}

export async function inviteMember({ org_id, actor_agent_id, input }: InviteMemberParams): Promise<
  Result<{ membership: OrgMember }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  // Check actor permissions
  const actor = await getMembership(org_id, actor_agent_id);
  if (!actor) return err('Not a member of this organization', 403);
  if (!hasPermission(actor, 'members.invite')) return err('Insufficient permissions: members.invite required', 403);

  // Cannot invite to a role higher than your own
  if (ROLE_RANK[input.role as OrgRole] >= ROLE_RANK[actor.role]) {
    return err('Cannot invite to a role equal to or higher than your own', 403);
  }

  // Verify target agent exists
  const { data: target } = await db
    .from('agent_registry')
    .select('id')
    .eq('id', input.agent_id)
    .eq('is_active', true)
    .single();

  if (!target) return err('Target agent not found or inactive', 404);

  // Check if already a member
  const { data: existingMember } = await db
    .from('a2a_org_members')
    .select('id, status')
    .eq('org_id', org_id)
    .eq('agent_id', input.agent_id)
    .in('status', ['active', 'invited'])
    .maybeSingle();

  if (existingMember) return err('Agent is already a member or has a pending invite', 409);

  // Check max members
  const { data: org } = await db
    .from('a2a_organizations')
    .select('settings, status')
    .eq('id', org_id)
    .single();

  if (!org || org.status !== 'active') return err('Organization is not active', 400);

  const { count: memberCount } = await db
    .from('a2a_org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org_id)
    .in('status', ['active', 'invited']);

  const maxMembers = (org.settings as OrgSettings)?.max_members ?? DEFAULT_ORG_SETTINGS.max_members;
  if ((memberCount ?? 0) >= maxMembers) return err(`Organization has reached max members (${maxMembers})`, 400);

  const { data: membership, error: memErr } = await db
    .from('a2a_org_members')
    .insert({
      org_id,
      agent_id: input.agent_id,
      role: input.role,
      status: 'invited' as MembershipStatus,
      daily_spend_limit: input.daily_spend_limit ?? null,
      extra_permissions: input.extra_permissions ?? [],
      revoked_permissions: [],
      invited_by: actor_agent_id,
    })
    .select('*')
    .single();

  if (memErr || !membership) return err('Failed to create membership', 500);

  await audit(org_id, actor_agent_id, 'member.invited', { role: input.role }, input.agent_id);

  return {
    membership: {
      ...membership,
      extra_permissions: membership.extra_permissions ?? [],
      revoked_permissions: membership.revoked_permissions ?? [],
    } as OrgMember,
  };
}

// ── Accept Invite ───────────────────────────────────────────────────────────

export async function acceptInvite(org_id: string, agent_id: string): Promise<
  Result<{ membership: OrgMember }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const now = new Date().toISOString();

  const { data: membership } = await db
    .from('a2a_org_members')
    .select('*')
    .eq('org_id', org_id)
    .eq('agent_id', agent_id)
    .eq('status', 'invited')
    .single();

  if (!membership) return err('No pending invitation found', 404);

  const { data: updated, error: updateErr } = await db
    .from('a2a_org_members')
    .update({ status: 'active' as MembershipStatus, joined_at: now, updated_at: now })
    .eq('id', membership.id)
    .select('*')
    .single();

  if (updateErr || !updated) return err('Failed to accept invite', 500);

  await refreshOrgCapabilities(org_id);
  await audit(org_id, agent_id, 'member.joined', { role: updated.role });

  return {
    membership: {
      ...updated,
      extra_permissions: updated.extra_permissions ?? [],
      revoked_permissions: updated.revoked_permissions ?? [],
    } as OrgMember,
  };
}

// ── Update Member ───────────────────────────────────────────────────────────

interface UpdateMemberParams {
  org_id: string;
  target_agent_id: string;
  actor_agent_id: string;
  input: UpdateMemberInput;
}

export async function updateMember({ org_id, target_agent_id, actor_agent_id, input }: UpdateMemberParams): Promise<
  Result<{ membership: OrgMember }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const actor = await getMembership(org_id, actor_agent_id);
  if (!actor) return err('Not a member of this organization', 403);
  if (!hasPermission(actor, 'members.role_assign')) return err('Insufficient permissions', 403);

  const target = await getMembership(org_id, target_agent_id);
  if (!target) return err('Target member not found', 404);

  // Cannot modify a member with equal or higher rank
  if (ROLE_RANK[target.role] >= ROLE_RANK[actor.role]) {
    return err('Cannot modify a member with equal or higher rank', 403);
  }

  // Cannot promote to a role equal or higher than your own
  if (input.role && ROLE_RANK[input.role as OrgRole] >= ROLE_RANK[actor.role]) {
    return err('Cannot promote to a role equal to or higher than your own', 403);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.role) updates.role = input.role;
  if (input.daily_spend_limit !== undefined) updates.daily_spend_limit = input.daily_spend_limit;
  if (input.extra_permissions) updates.extra_permissions = input.extra_permissions;
  if (input.revoked_permissions) updates.revoked_permissions = input.revoked_permissions;

  const { data: updated, error: updateErr } = await db
    .from('a2a_org_members')
    .update(updates)
    .eq('id', target.id)
    .select('*')
    .single();

  if (updateErr || !updated) return err('Failed to update member', 500);

  await audit(org_id, actor_agent_id, 'member.role_changed', {
    changes: Object.keys(updates).filter(k => k !== 'updated_at'),
    new_role: input.role,
  }, target_agent_id);

  return {
    membership: {
      ...updated,
      extra_permissions: updated.extra_permissions ?? [],
      revoked_permissions: updated.revoked_permissions ?? [],
    } as OrgMember,
  };
}

// ── Remove Member ───────────────────────────────────────────────────────────

export async function removeMember(org_id: string, target_agent_id: string, actor_agent_id: string): Promise<
  Result<{ removed: true; agent_id: string }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const actor = await getMembership(org_id, actor_agent_id);
  if (!actor) return err('Not a member of this organization', 403);
  if (!hasPermission(actor, 'members.remove')) return err('Insufficient permissions', 403);

  const target = await getMembership(org_id, target_agent_id);
  if (!target) return err('Target member not found', 404);

  // Cannot remove a member with equal or higher rank (unless self-departing)
  if (target_agent_id !== actor_agent_id && ROLE_RANK[target.role] >= ROLE_RANK[actor.role]) {
    return err('Cannot remove a member with equal or higher rank', 403);
  }

  // Cannot remove the last owner
  if (target.role === 'owner') {
    const { count } = await db
      .from('a2a_org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('role', 'owner')
      .eq('status', 'active');

    if ((count ?? 0) <= 1) return err('Cannot remove the last owner', 400);
  }

  await db
    .from('a2a_org_members')
    .update({ status: 'departed' as MembershipStatus, updated_at: new Date().toISOString() })
    .eq('id', target.id);

  await refreshOrgCapabilities(org_id);
  await audit(org_id, actor_agent_id, 'member.removed', {}, target_agent_id);

  return { removed: true, agent_id: target_agent_id };
}

// ── List Members ────────────────────────────────────────────────────────────

export async function listMembers(org_id: string, input: ListMembersInput): Promise<
  Result<{ members: OrgMember[]; count: number }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  let query = db.from('a2a_org_members').select('*', { count: 'exact' }).eq('org_id', org_id);

  if (input.status) query = query.eq('status', input.status);
  if (input.role) query = query.eq('role', input.role);
  query = query.order('created_at', { ascending: true });
  query = query.range(input.offset, input.offset + input.limit - 1);

  const { data, count } = await query;

  return {
    members: (data ?? []).map(m => ({
      ...m,
      extra_permissions: m.extra_permissions ?? [],
      revoked_permissions: m.revoked_permissions ?? [],
    })) as OrgMember[],
    count: count ?? 0,
  };
}

// ── Effective Trust Level ───────────────────────────────────────────────────

const TRUST_RANK: Record<string, number> = { untrusted: 0, verified: 1, partner: 2 };
const TRUST_BY_RANK = ['untrusted', 'verified', 'partner'] as const;

/**
 * Compute the effective trust level for an agent, considering org membership.
 * Returns the higher of the agent's personal trust and their org's trust.
 */
export async function getEffectiveTrustLevel(agent_id: string): Promise<
  Result<{ trust_level: string; source: 'personal' | 'organization'; org_id?: string }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: agent } = await db
    .from('agent_registry')
    .select('trust_level')
    .eq('id', agent_id)
    .single();

  if (!agent) return err('Agent not found', 404);

  const personalTrust = agent.trust_level ?? 'untrusted';

  // Find the agent's active org memberships
  const { data: memberships } = await db
    .from('a2a_org_members')
    .select('org_id')
    .eq('agent_id', agent_id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) {
    return { trust_level: personalTrust, source: 'personal' };
  }

  const orgIds = memberships.map(m => m.org_id);
  const { data: orgs } = await db
    .from('a2a_organizations')
    .select('id, trust_level, settings')
    .in('id', orgIds)
    .eq('status', 'active');

  let bestTrust = personalTrust;
  let bestOrgId: string | undefined;
  let source: 'personal' | 'organization' = 'personal';

  for (const org of orgs ?? []) {
    const settings = org.settings as OrgSettings;
    if (!settings.trust_inheritance_enabled) continue;

    if ((TRUST_RANK[org.trust_level] ?? 0) > (TRUST_RANK[bestTrust] ?? 0)) {
      bestTrust = org.trust_level;
      bestOrgId = org.id;
      source = 'organization';
    }
  }

  return { trust_level: bestTrust, source, org_id: bestOrgId };
}

// ── Cross-Org Collaboration ─────────────────────────────────────────────────

interface ProposeCollaborationParams {
  proposer_org_id: string;
  actor_agent_id: string;
  input: ProposeCollaborationInput;
}

export async function proposeCollaboration({ proposer_org_id, actor_agent_id, input }: ProposeCollaborationParams): Promise<
  Result<{ collaboration: OrgCollaboration }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const actor = await getMembership(proposer_org_id, actor_agent_id);
  if (!actor) return err('Not a member of this organization', 403);
  if (!hasPermission(actor, 'collaboration.manage')) {
    return err('Insufficient permissions: collaboration.manage required', 403);
  }

  // Verify responder org exists and is active
  const { data: responder } = await db
    .from('a2a_organizations')
    .select('id, status')
    .eq('id', input.responder_org_id)
    .single();

  if (!responder || responder.status !== 'active') {
    return err('Responder organization not found or inactive', 404);
  }

  if (proposer_org_id === input.responder_org_id) {
    return err('Cannot collaborate with yourself', 400);
  }

  // Check for existing active/proposed collaboration
  const { data: existing } = await db
    .from('a2a_org_collaborations')
    .select('id')
    .or(`and(proposer_org_id.eq.${proposer_org_id},responder_org_id.eq.${input.responder_org_id}),and(proposer_org_id.eq.${input.responder_org_id},responder_org_id.eq.${proposer_org_id})`)
    .in('status', ['proposed', 'active'])
    .maybeSingle();

  if (existing) return err('Active or pending collaboration already exists between these orgs', 409);

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + input.expires_in_days * 86400000).toISOString();

  const { data: collab, error: collabErr } = await db
    .from('a2a_org_collaborations')
    .insert({
      proposer_org_id,
      responder_org_id: input.responder_org_id,
      status: 'proposed' as CollaborationStatus,
      purpose: input.purpose,
      shared_capabilities_proposer: input.shared_capabilities,
      shared_capabilities_responder: [],
      mutual_trust_level: input.mutual_trust_level,
      billing_mode: input.billing_mode,
      daily_spend_cap: input.daily_spend_cap ?? null,
      proposed_at: now,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (collabErr || !collab) return err('Failed to create collaboration proposal', 500);

  await audit(proposer_org_id, actor_agent_id, 'collaboration.proposed', {
    responder_org_id: input.responder_org_id,
    purpose: input.purpose,
  });

  return { collaboration: collab as OrgCollaboration };
}

// ── Accept Collaboration ────────────────────────────────────────────────────

interface AcceptCollaborationParams {
  collaboration_id: string;
  actor_agent_id: string;
  input: AcceptCollaborationInput;
}

export async function acceptCollaboration({ collaboration_id, actor_agent_id, input }: AcceptCollaborationParams): Promise<
  Result<{ collaboration: OrgCollaboration }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const { data: collab } = await db
    .from('a2a_org_collaborations')
    .select('*')
    .eq('id', collaboration_id)
    .eq('status', 'proposed')
    .single();

  if (!collab) return err('Collaboration not found or not in proposed state', 404);

  // Actor must be a member of the responder org with collaboration.manage permission
  const actor = await getMembership(collab.responder_org_id, actor_agent_id);
  if (!actor) return err('Not a member of the responder organization', 403);
  if (!hasPermission(actor, 'collaboration.manage')) {
    return err('Insufficient permissions: collaboration.manage required', 403);
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateErr } = await db
    .from('a2a_org_collaborations')
    .update({
      status: 'active' as CollaborationStatus,
      shared_capabilities_responder: input.shared_capabilities,
      activated_at: now,
      updated_at: now,
    })
    .eq('id', collaboration_id)
    .select('*')
    .single();

  if (updateErr || !updated) return err('Failed to accept collaboration', 500);

  await audit(collab.responder_org_id, actor_agent_id, 'collaboration.accepted', {
    proposer_org_id: collab.proposer_org_id,
    collaboration_id,
  });

  return { collaboration: updated as OrgCollaboration };
}

// ── Terminate Collaboration ─────────────────────────────────────────────────

export async function terminateCollaboration(
  collaboration_id: string,
  org_id: string,
  actor_agent_id: string,
): Promise<Result<{ collaboration: OrgCollaboration }>> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const actor = await getMembership(org_id, actor_agent_id);
  if (!actor) return err('Not a member of this organization', 403);
  if (!hasPermission(actor, 'collaboration.manage')) {
    return err('Insufficient permissions', 403);
  }

  const { data: collab } = await db
    .from('a2a_org_collaborations')
    .select('*')
    .eq('id', collaboration_id)
    .or(`proposer_org_id.eq.${org_id},responder_org_id.eq.${org_id}`)
    .in('status', ['proposed', 'active'])
    .single();

  if (!collab) return err('Collaboration not found or already terminated', 404);

  const { data: updated } = await db
    .from('a2a_org_collaborations')
    .update({ status: 'terminated' as CollaborationStatus, updated_at: new Date().toISOString() })
    .eq('id', collaboration_id)
    .select('*')
    .single();

  if (!updated) return err('Failed to terminate collaboration', 500);

  await audit(org_id, actor_agent_id, 'collaboration.terminated', { collaboration_id });

  return { collaboration: updated as OrgCollaboration };
}

// ── List Collaborations ─────────────────────────────────────────────────────

export async function listCollaborations(org_id: string, input: ListCollaborationsInput): Promise<
  Result<{ collaborations: OrgCollaboration[]; count: number }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  let query = db
    .from('a2a_org_collaborations')
    .select('*', { count: 'exact' })
    .or(`proposer_org_id.eq.${org_id},responder_org_id.eq.${org_id}`);

  if (input.status) query = query.eq('status', input.status);
  if (input.partner_org_id) {
    query = query.or(`proposer_org_id.eq.${input.partner_org_id},responder_org_id.eq.${input.partner_org_id}`);
  }

  query = query.order('proposed_at', { ascending: false });
  query = query.range(input.offset, input.offset + input.limit - 1);

  const { data, count } = await query;

  return {
    collaborations: (data ?? []) as OrgCollaboration[],
    count: count ?? 0,
  };
}

// ── Org Audit Log ───────────────────────────────────────────────────────────

export async function queryOrgAudit(org_id: string, input: OrgAuditInput): Promise<
  Result<{ entries: OrgAuditEntry[]; count: number }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  let query = db
    .from('a2a_org_audit')
    .select('*', { count: 'exact' })
    .eq('org_id', org_id);

  if (input.action) query = query.eq('action', input.action);
  if (input.actor_agent_id) query = query.eq('actor_agent_id', input.actor_agent_id);
  query = query.order('created_at', { ascending: false });
  query = query.range(input.offset, input.offset + input.limit - 1);

  const { data, count } = await query;

  return {
    entries: (data ?? []) as OrgAuditEntry[],
    count: count ?? 0,
  };
}
