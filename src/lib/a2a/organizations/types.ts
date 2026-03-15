/**
 * A2A Agent Organizations — Types
 *
 * In the 2028 agentic future, agents don't operate in isolation. Companies,
 * DAOs, and collectives deploy fleets of specialized agents that need:
 *
 * - **Shared Identity** — An organization is a first-class principal. External
 *   agents interact with "Acme Corp" without knowing which internal agent
 *   handles the request.
 *
 * - **Hierarchical RBAC** — Owners set org-wide policies; admins manage
 *   membership; operators run day-to-day tasks; members execute work;
 *   viewers audit. Permissions cascade from org → team → agent.
 *
 * - **Trust Inheritance** — Member agents inherit the organization's trust
 *   level (if higher than their own). This lets a verified org onboard new
 *   agents without each needing individual vetting.
 *
 * - **Shared Billing** — Organizations have a shared wallet. Member agents
 *   can charge to the org wallet within spend limits set by their role.
 *
 * - **Policy Inheritance** — Governance policies defined at the org level
 *   apply to all members, ensuring consistent autonomy controls.
 *
 * - **Cross-Org Collaboration** — Organizations can establish formal
 *   collaboration agreements, enabling their agents to interoperate with
 *   pre-negotiated trust and billing terms.
 *
 * Key lifecycle: pending → active → suspended → dissolved
 */

// ── Organization Lifecycle ─────────────────────────────────────────────────

export type OrgStatus =
  | 'pending'     // Created, awaiting activation (e.g., verification)
  | 'active'      // Fully operational
  | 'suspended'   // Temporarily disabled (policy violation, billing, etc.)
  | 'dissolved';  // Terminal state — all members released

// ── Member Roles & Permissions ─────────────────────────────────────────────

/**
 * Hierarchical roles with descending privilege:
 *
 * owner > admin > operator > member > viewer
 *
 * Each role inherits all permissions of the roles below it.
 */
export type OrgRole =
  | 'owner'     // Full control: dissolve org, transfer ownership, manage admins
  | 'admin'     // Manage members, set policies, manage billing
  | 'operator'  // Submit tasks on behalf of org, manage day-to-day operations
  | 'member'    // Execute tasks, use org capabilities, charge to org wallet
  | 'viewer';   // Read-only: audit logs, org profile, member list

/** Granular permissions that can be assigned or revoked per-member. */
export type OrgPermission =
  | 'org.manage'           // Update org profile, settings
  | 'org.dissolve'         // Dissolve the organization
  | 'members.invite'       // Invite new members
  | 'members.remove'       // Remove members
  | 'members.role_assign'  // Change member roles
  | 'billing.spend'        // Charge to org wallet
  | 'billing.manage'       // Deposit, set spend limits
  | 'policy.manage'        // Create/update org governance policies
  | 'tasks.submit'         // Submit tasks on behalf of org
  | 'tasks.view'           // View org task history
  | 'contracts.negotiate'  // Negotiate contracts on behalf of org
  | 'collaboration.manage' // Manage cross-org collaboration agreements
  | 'audit.view';          // View audit logs

/** Default permissions for each role. */
export const ROLE_PERMISSIONS: Record<OrgRole, OrgPermission[]> = {
  owner: [
    'org.manage', 'org.dissolve',
    'members.invite', 'members.remove', 'members.role_assign',
    'billing.spend', 'billing.manage',
    'policy.manage',
    'tasks.submit', 'tasks.view',
    'contracts.negotiate', 'collaboration.manage',
    'audit.view',
  ],
  admin: [
    'org.manage',
    'members.invite', 'members.remove', 'members.role_assign',
    'billing.spend', 'billing.manage',
    'policy.manage',
    'tasks.submit', 'tasks.view',
    'contracts.negotiate', 'collaboration.manage',
    'audit.view',
  ],
  operator: [
    'billing.spend',
    'tasks.submit', 'tasks.view',
    'contracts.negotiate',
    'audit.view',
  ],
  member: [
    'billing.spend',
    'tasks.submit', 'tasks.view',
    'audit.view',
  ],
  viewer: [
    'tasks.view',
    'audit.view',
  ],
};

/** Numeric rank for role hierarchy comparison. Higher = more privileged. */
export const ROLE_RANK: Record<OrgRole, number> = {
  owner: 5,
  admin: 4,
  operator: 3,
  member: 2,
  viewer: 1,
};

// ── Organization ───────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  /** Unique, URL-safe handle (e.g., "acme-corp"). */
  handle: string;
  /** Display name. */
  name: string;
  description: string;
  status: OrgStatus;
  /** Trust level inherited by members (if their personal level is lower). */
  trust_level: 'untrusted' | 'verified' | 'partner';
  /** Optional: org-level callback URL for task delivery. */
  callback_url?: string;
  /** Union of all member capabilities, auto-computed. */
  capabilities: string[];
  /** Org-wide settings. */
  settings: OrgSettings;
  /** Agent ID of the org in the agent registry (org acts as an agent). */
  agent_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrgSettings {
  /** Max members allowed. */
  max_members: number;
  /** Whether new members auto-inherit org trust level. */
  trust_inheritance_enabled: boolean;
  /** Default spend limit (credits) per member per day. 0 = unlimited. */
  default_daily_spend_limit: number;
  /** Whether org-level governance policies apply to all members. */
  policy_inheritance_enabled: boolean;
  /** Require admin approval for new member joins. */
  require_approval: boolean;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  max_members: 100,
  trust_inheritance_enabled: true,
  default_daily_spend_limit: 1000,
  policy_inheritance_enabled: true,
  require_approval: true,
};

// ── Organization Membership ────────────────────────────────────────────────

export type MembershipStatus =
  | 'invited'     // Invitation sent, awaiting acceptance
  | 'active'      // Full participating member
  | 'suspended'   // Temporarily disabled
  | 'departed';   // Left or was removed

export interface OrgMember {
  id: string;
  org_id: string;
  agent_id: string;
  role: OrgRole;
  status: MembershipStatus;
  /** Per-member daily spend limit (overrides org default if set). */
  daily_spend_limit?: number;
  /** Additional permissions beyond role defaults. */
  extra_permissions: OrgPermission[];
  /** Permissions explicitly revoked from role defaults. */
  revoked_permissions: OrgPermission[];
  invited_by: string;
  joined_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Cross-Organization Collaboration ───────────────────────────────────────

export type CollaborationStatus =
  | 'proposed'   // One org proposed, awaiting response
  | 'active'     // Both orgs agreed
  | 'suspended'  // Temporarily paused
  | 'terminated'; // Ended by either party

export interface OrgCollaboration {
  id: string;
  /** The org that proposed the collaboration. */
  proposer_org_id: string;
  /** The org that receives the proposal. */
  responder_org_id: string;
  status: CollaborationStatus;
  /** Human-readable purpose of the collaboration. */
  purpose: string;
  /** Capabilities that the proposer shares with the responder. */
  shared_capabilities_proposer: string[];
  /** Capabilities that the responder shares with the proposer. */
  shared_capabilities_responder: string[];
  /** Trust level applied to cross-org agent interactions. */
  mutual_trust_level: 'untrusted' | 'verified' | 'partner';
  /** Billing arrangement for cross-org tasks. */
  billing_mode: CollaborationBillingMode;
  /** Optional: max cross-org spend per day. */
  daily_spend_cap?: number;
  proposed_at: string;
  activated_at?: string;
  expires_at?: string;
  updated_at: string;
}

export type CollaborationBillingMode =
  | 'sender_pays'    // The org whose agent initiates pays
  | 'receiver_pays'  // The org whose agent fulfills pays
  | 'split'          // 50/50 split
  | 'free';          // No charges for cross-org tasks

// ── Org Audit Log ──────────────────────────────────────────────────────────

export type OrgAuditAction =
  | 'org.created'
  | 'org.updated'
  | 'org.suspended'
  | 'org.dissolved'
  | 'member.invited'
  | 'member.joined'
  | 'member.role_changed'
  | 'member.suspended'
  | 'member.removed'
  | 'member.departed'
  | 'policy.created'
  | 'policy.updated'
  | 'collaboration.proposed'
  | 'collaboration.accepted'
  | 'collaboration.terminated'
  | 'billing.spend'
  | 'settings.updated';

export interface OrgAuditEntry {
  id: string;
  org_id: string;
  actor_agent_id: string;
  action: OrgAuditAction;
  target_agent_id?: string;
  details: Record<string, unknown>;
  created_at: string;
}

// ── API Request/Response Shapes ────────────────────────────────────────────

// -- Create Org --
export interface CreateOrgRequest {
  handle: string;
  name: string;
  description: string;
  callback_url?: string;
  settings?: Partial<OrgSettings>;
}

export interface CreateOrgResponse {
  organization: Organization;
  membership: OrgMember;
}

// -- Update Org --
export interface UpdateOrgRequest {
  name?: string;
  description?: string;
  callback_url?: string;
  settings?: Partial<OrgSettings>;
}

export interface UpdateOrgResponse {
  organization: Organization;
}

// -- List Orgs --
export interface ListOrgsResponse {
  organizations: Organization[];
  count: number;
}

// -- Org Detail --
export interface OrgDetailResponse {
  organization: Organization;
  members: OrgMember[];
  member_count: number;
}

// -- Invite Member --
export interface InviteMemberRequest {
  agent_id: string;
  role: OrgRole;
  daily_spend_limit?: number;
  extra_permissions?: OrgPermission[];
}

export interface InviteMemberResponse {
  membership: OrgMember;
}

// -- Accept Invite --
export interface AcceptInviteResponse {
  membership: OrgMember;
}

// -- Update Member --
export interface UpdateMemberRequest {
  role?: OrgRole;
  daily_spend_limit?: number;
  extra_permissions?: OrgPermission[];
  revoked_permissions?: OrgPermission[];
}

export interface UpdateMemberResponse {
  membership: OrgMember;
}

// -- Remove Member --
export interface RemoveMemberResponse {
  removed: true;
  agent_id: string;
}

// -- List Members --
export interface ListMembersResponse {
  members: OrgMember[];
  count: number;
}

// -- Propose Collaboration --
export interface ProposeCollaborationRequest {
  responder_org_id: string;
  purpose: string;
  shared_capabilities: string[];
  mutual_trust_level?: 'untrusted' | 'verified' | 'partner';
  billing_mode?: CollaborationBillingMode;
  daily_spend_cap?: number;
  expires_in_days?: number;
}

export interface ProposeCollaborationResponse {
  collaboration: OrgCollaboration;
}

// -- Accept Collaboration --
export interface AcceptCollaborationRequest {
  shared_capabilities: string[];
}

export interface AcceptCollaborationResponse {
  collaboration: OrgCollaboration;
}

// -- Terminate Collaboration --
export interface TerminateCollaborationResponse {
  collaboration: OrgCollaboration;
}

// -- List Collaborations --
export interface ListCollaborationsResponse {
  collaborations: OrgCollaboration[];
  count: number;
}

// -- Org Audit --
export interface OrgAuditResponse {
  entries: OrgAuditEntry[];
  count: number;
}
