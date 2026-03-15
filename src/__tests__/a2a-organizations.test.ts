/**
 * A2A Agent Organizations — Unit Tests
 *
 * Tests validation schemas, RBAC permission logic, role hierarchy,
 * and trust level computation. Database-dependent functions (createOrg,
 * inviteMember, etc.) are tested via integration tests.
 */

import {
  createOrgSchema,
  updateOrgSchema,
  listOrgsSchema,
  inviteMemberSchema,
  updateMemberSchema,
  listMembersSchema,
  proposeCollaborationSchema,
  acceptCollaborationSchema,
  listCollaborationsSchema,
  orgAuditSchema,
} from '@/lib/a2a/organizations/validation';

import {
  ROLE_PERMISSIONS,
  ROLE_RANK,
  DEFAULT_ORG_SETTINGS,
} from '@/lib/a2a/organizations/types';

import { hasPermission, getEffectivePermissions } from '@/lib/a2a/organizations/engine';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makeMember(overrides = {}) {
  return {
    id: 'mem-1',
    org_id: 'org-1',
    agent_id: 'agent-1',
    role: 'member',
    status: 'active',
    extra_permissions: [],
    revoked_permissions: [],
    invited_by: 'agent-0',
    created_at: '2028-01-01T00:00:00Z',
    updated_at: '2028-01-01T00:00:00Z',
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// RBAC: hasPermission
// ──────────────────────────────────────────────

describe('hasPermission', () => {
  it('grants role default permissions', () => {
    const admin = makeMember({ role: 'admin' });
    expect(hasPermission(admin, 'org.manage')).toBe(true);
    expect(hasPermission(admin, 'members.invite')).toBe(true);
    expect(hasPermission(admin, 'audit.view')).toBe(true);
  });

  it('denies permissions not in role', () => {
    const viewer = makeMember({ role: 'viewer' });
    expect(hasPermission(viewer, 'org.manage')).toBe(false);
    expect(hasPermission(viewer, 'members.invite')).toBe(false);
    expect(hasPermission(viewer, 'billing.spend')).toBe(false);
  });

  it('grants extra_permissions beyond role defaults', () => {
    const member = makeMember({
      role: 'member',
      extra_permissions: ['members.invite'],
    });
    expect(hasPermission(member, 'members.invite')).toBe(true);
  });

  it('revokes permissions from role defaults', () => {
    const admin = makeMember({
      role: 'admin',
      revoked_permissions: ['org.manage'],
    });
    expect(hasPermission(admin, 'org.manage')).toBe(false);
    // Other admin perms still work
    expect(hasPermission(admin, 'members.invite')).toBe(true);
  });

  it('revoked takes precedence over extra', () => {
    const member = makeMember({
      role: 'member',
      extra_permissions: ['org.manage'],
      revoked_permissions: ['org.manage'],
    });
    expect(hasPermission(member, 'org.manage')).toBe(false);
  });

  it('owner has all permissions', () => {
    const owner = makeMember({ role: 'owner' });
    const allPerms = [
      'org.manage', 'org.dissolve',
      'members.invite', 'members.remove', 'members.role_assign',
      'billing.spend', 'billing.manage',
      'policy.manage',
      'tasks.submit', 'tasks.view',
      'contracts.negotiate', 'collaboration.manage',
      'audit.view',
    ];
    for (const perm of allPerms) {
      expect(hasPermission(owner, perm)).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────
// RBAC: getEffectivePermissions
// ──────────────────────────────────────────────

describe('getEffectivePermissions', () => {
  it('returns role defaults for plain member', () => {
    const member = makeMember({ role: 'member' });
    const perms = getEffectivePermissions(member);
    expect(perms).toEqual(expect.arrayContaining(ROLE_PERMISSIONS.member));
    expect(perms.length).toBe(ROLE_PERMISSIONS.member.length);
  });

  it('adds extra permissions', () => {
    const member = makeMember({
      role: 'viewer',
      extra_permissions: ['billing.spend'],
    });
    const perms = getEffectivePermissions(member);
    expect(perms).toContain('billing.spend');
    expect(perms).toContain('tasks.view');
    expect(perms).toContain('audit.view');
  });

  it('removes revoked permissions', () => {
    const admin = makeMember({
      role: 'admin',
      revoked_permissions: ['org.manage', 'billing.manage'],
    });
    const perms = getEffectivePermissions(admin);
    expect(perms).not.toContain('org.manage');
    expect(perms).not.toContain('billing.manage');
    expect(perms).toContain('members.invite');
  });
});

// ──────────────────────────────────────────────
// Role Hierarchy
// ──────────────────────────────────────────────

describe('ROLE_RANK', () => {
  it('enforces owner > admin > operator > member > viewer', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.operator);
    expect(ROLE_RANK.operator).toBeGreaterThan(ROLE_RANK.member);
    expect(ROLE_RANK.member).toBeGreaterThan(ROLE_RANK.viewer);
  });
});

// ──────────────────────────────────────────────
// Default Settings
// ──────────────────────────────────────────────

describe('DEFAULT_ORG_SETTINGS', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_ORG_SETTINGS.max_members).toBe(100);
    expect(DEFAULT_ORG_SETTINGS.trust_inheritance_enabled).toBe(true);
    expect(DEFAULT_ORG_SETTINGS.default_daily_spend_limit).toBe(1000);
    expect(DEFAULT_ORG_SETTINGS.policy_inheritance_enabled).toBe(true);
    expect(DEFAULT_ORG_SETTINGS.require_approval).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Validation: createOrgSchema
// ──────────────────────────────────────────────

describe('createOrgSchema', () => {
  const valid = {
    handle: 'acme-corp',
    name: 'Acme Corporation',
    description: 'A fleet of specialized AI agents for enterprise automation',
  };

  it('accepts a valid minimal org', () => {
    const result = createOrgSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts with all optional fields', () => {
    const result = createOrgSchema.safeParse({
      ...valid,
      callback_url: 'https://acme.example.com/a2a/callback',
      settings: {
        max_members: 50,
        trust_inheritance_enabled: false,
        default_daily_spend_limit: 500,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects handle with spaces', () => {
    const result = createOrgSchema.safeParse({ ...valid, handle: 'acme corp' });
    expect(result.success).toBe(false);
  });

  it('rejects handle with uppercase', () => {
    const result = createOrgSchema.safeParse({ ...valid, handle: 'Acme-Corp' });
    expect(result.success).toBe(false);
  });

  it('rejects handle shorter than 3 chars', () => {
    const result = createOrgSchema.safeParse({ ...valid, handle: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = createOrgSchema.safeParse({ handle: 'acme', description: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid callback URL', () => {
    const result = createOrgSchema.safeParse({ ...valid, callback_url: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: inviteMemberSchema
// ──────────────────────────────────────────────

describe('inviteMemberSchema', () => {
  it('accepts a valid invite', () => {
    const result = inviteMemberSchema.safeParse({
      agent_id: 'agent-123',
      role: 'member',
    });
    expect(result.success).toBe(true);
  });

  it('accepts invite with spend limit and extra permissions', () => {
    const result = inviteMemberSchema.safeParse({
      agent_id: 'agent-123',
      role: 'operator',
      daily_spend_limit: 200,
      extra_permissions: ['members.invite'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects owner role', () => {
    const result = inviteMemberSchema.safeParse({
      agent_id: 'agent-123',
      role: 'owner',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing agent_id', () => {
    const result = inviteMemberSchema.safeParse({ role: 'member' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: proposeCollaborationSchema
// ──────────────────────────────────────────────

describe('proposeCollaborationSchema', () => {
  const valid = {
    responder_org_id: 'org-456',
    purpose: 'Joint AI research collaboration',
    shared_capabilities: ['report.summarize', 'news.query'],
  };

  it('accepts a valid proposal', () => {
    const result = proposeCollaborationSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mutual_trust_level).toBe('verified');
      expect(result.data.billing_mode).toBe('sender_pays');
      expect(result.data.expires_in_days).toBe(90);
    }
  });

  it('accepts with all options', () => {
    const result = proposeCollaborationSchema.safeParse({
      ...valid,
      mutual_trust_level: 'partner',
      billing_mode: 'split',
      daily_spend_cap: 5000,
      expires_in_days: 365,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty shared_capabilities', () => {
    const result = proposeCollaborationSchema.safeParse({
      ...valid,
      shared_capabilities: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing purpose', () => {
    const result = proposeCollaborationSchema.safeParse({
      responder_org_id: 'org-456',
      shared_capabilities: ['report.summarize'],
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: updateMemberSchema
// ──────────────────────────────────────────────

describe('updateMemberSchema', () => {
  it('accepts role change', () => {
    const result = updateMemberSchema.safeParse({ role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('accepts spend limit change', () => {
    const result = updateMemberSchema.safeParse({ daily_spend_limit: 500 });
    expect(result.success).toBe(true);
  });

  it('rejects owner role assignment', () => {
    const result = updateMemberSchema.safeParse({ role: 'owner' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: listOrgsSchema
// ──────────────────────────────────────────────

describe('listOrgsSchema', () => {
  it('accepts empty params with defaults', () => {
    const result = listOrgsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts all filters', () => {
    const result = listOrgsSchema.safeParse({
      status: 'active',
      member_agent_id: 'agent-1',
      query: 'acme',
      limit: 50,
      offset: 10,
    });
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Validation: orgAuditSchema
// ──────────────────────────────────────────────

describe('orgAuditSchema', () => {
  it('accepts empty params', () => {
    const result = orgAuditSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts action filter', () => {
    const result = orgAuditSchema.safeParse({ action: 'member.joined' });
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Role Permission Coverage
// ──────────────────────────────────────────────

describe('ROLE_PERMISSIONS', () => {
  it('each higher role has a superset of lower role permissions', () => {
    const roles = ['viewer', 'member', 'operator', 'admin', 'owner'];
    for (let i = 1; i < roles.length; i++) {
      const lowerPerms = new Set(ROLE_PERMISSIONS[roles[i - 1]]);
      const higherPerms = new Set(ROLE_PERMISSIONS[roles[i]]);
      for (const perm of lowerPerms) {
        expect(higherPerms.has(perm)).toBe(true);
      }
    }
  });

  it('viewer has minimal permissions', () => {
    expect(ROLE_PERMISSIONS.viewer).toEqual(['tasks.view', 'audit.view']);
  });

  it('owner has all defined permissions', () => {
    expect(ROLE_PERMISSIONS.owner.length).toBe(13);
  });
});
