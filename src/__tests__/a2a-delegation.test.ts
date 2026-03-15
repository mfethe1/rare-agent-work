/**
 * A2A Agent Delegation & Scoped Authorization — Unit Tests
 *
 * Tests validation schemas for the delegation system. Database-dependent
 * functions (createDelegation, checkAuthorization, etc.) are tested via
 * integration tests.
 */

import {
  delegationCreateSchema,
  delegationListSchema,
  delegationCheckSchema,
} from '@/lib/a2a/delegation';

// ──────────────────────────────────────────────
// Validation: delegationCreateSchema
// ──────────────────────────────────────────────

describe('delegationCreateSchema', () => {
  const validDelegation = {
    delegate_agent_id: '550e8400-e29b-41d4-a716-446655440000',
    scopes: ['task.submit', 'task.read'],
    reason: 'Delegating task management to worker agent',
    expires_at: '2028-12-31T23:59:59Z',
  };

  it('accepts a valid minimal delegation', () => {
    const result = delegationCreateSchema.safeParse(validDelegation);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scopes).toEqual(['task.submit', 'task.read']);
      expect(result.data.allow_subdelegation).toBe(false);
      expect(result.data.max_chain_depth).toBe(2);
    }
  });

  it('accepts a full delegation with all fields', () => {
    const result = delegationCreateSchema.safeParse({
      ...validDelegation,
      resource_ids: ['550e8400-e29b-41d4-a716-446655440001'],
      spend_limit_per_action: 100,
      spend_limit_total: 1000,
      allow_subdelegation: true,
      max_chain_depth: 3,
      starts_at: '2028-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allow_subdelegation).toBe(true);
      expect(result.data.max_chain_depth).toBe(3);
      expect(result.data.spend_limit_per_action).toBe(100);
    }
  });

  it('rejects missing delegate_agent_id', () => {
    const { delegate_agent_id, ...rest } = validDelegation;
    const result = delegationCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for delegate_agent_id', () => {
    const result = delegationCreateSchema.safeParse({
      ...validDelegation,
      delegate_agent_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty scopes array', () => {
    const result = delegationCreateSchema.safeParse({ ...validDelegation, scopes: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid scope values', () => {
    const result = delegationCreateSchema.safeParse({
      ...validDelegation,
      scopes: ['invalid.action'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid scope values', () => {
    const allScopes = [
      'task.submit', 'task.update', 'task.read',
      'billing.read', 'billing.spend',
      'contract.negotiate', 'contract.read',
      'auction.bid', 'auction.create',
      'context.read', 'context.write',
      'channel.send', 'profile.read', 'workflow.trigger',
    ];
    const result = delegationCreateSchema.safeParse({ ...validDelegation, scopes: allScopes });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scopes).toHaveLength(14);
    }
  });

  it('rejects missing reason', () => {
    const { reason, ...rest } = validDelegation;
    const result = delegationCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty reason', () => {
    const result = delegationCreateSchema.safeParse({ ...validDelegation, reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing expires_at', () => {
    const { expires_at, ...rest } = validDelegation;
    const result = delegationCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid date for expires_at', () => {
    const result = delegationCreateSchema.safeParse({
      ...validDelegation,
      expires_at: 'next-week',
    });
    expect(result.success).toBe(false);
  });

  it('rejects max_chain_depth over 5', () => {
    const result = delegationCreateSchema.safeParse({
      ...validDelegation,
      max_chain_depth: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative max_chain_depth', () => {
    const result = delegationCreateSchema.safeParse({
      ...validDelegation,
      max_chain_depth: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative spend_limit_per_action', () => {
    const result = delegationCreateSchema.safeParse({
      ...validDelegation,
      spend_limit_per_action: -100,
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero max_chain_depth (no sub-delegation)', () => {
    const result = delegationCreateSchema.safeParse({
      ...validDelegation,
      max_chain_depth: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Validation: delegationListSchema
// ──────────────────────────────────────────────

describe('delegationListSchema', () => {
  it('accepts empty query (defaults applied)', () => {
    const result = delegationListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts role filter', () => {
    const result = delegationListSchema.safeParse({ role: 'grantor' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = delegationListSchema.safeParse({ role: 'admin' });
    expect(result.success).toBe(false);
  });

  it('accepts status filter', () => {
    const result = delegationListSchema.safeParse({ status: 'active' });
    expect(result.success).toBe(true);
  });

  it('accepts scope filter', () => {
    const result = delegationListSchema.safeParse({ scope: 'task.submit' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid scope', () => {
    const result = delegationListSchema.safeParse({ scope: 'invalid.action' });
    expect(result.success).toBe(false);
  });

  it('rejects limit over 100', () => {
    const result = delegationListSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: delegationCheckSchema
// ──────────────────────────────────────────────

describe('delegationCheckSchema', () => {
  const validCheck = {
    delegate_agent_id: '550e8400-e29b-41d4-a716-446655440000',
    grantor_agent_id: '550e8400-e29b-41d4-a716-446655440001',
    action: 'task.submit',
  };

  it('accepts a valid check request', () => {
    const result = delegationCheckSchema.safeParse(validCheck);
    expect(result.success).toBe(true);
  });

  it('accepts check with resource_id', () => {
    const result = delegationCheckSchema.safeParse({
      ...validCheck,
      resource_id: '550e8400-e29b-41d4-a716-446655440002',
    });
    expect(result.success).toBe(true);
  });

  it('accepts check with spend_amount', () => {
    const result = delegationCheckSchema.safeParse({
      ...validCheck,
      action: 'billing.spend',
      spend_amount: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing delegate_agent_id', () => {
    const { delegate_agent_id, ...rest } = validCheck;
    const result = delegationCheckSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing grantor_agent_id', () => {
    const { grantor_agent_id, ...rest } = validCheck;
    const result = delegationCheckSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid action', () => {
    const result = delegationCheckSchema.safeParse({
      ...validCheck,
      action: 'invalid.action',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative spend_amount', () => {
    const result = delegationCheckSchema.safeParse({
      ...validCheck,
      spend_amount: -10,
    });
    expect(result.success).toBe(false);
  });
});
