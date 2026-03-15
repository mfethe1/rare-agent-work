/**
 * A2A Billing Ledger — Unit Tests
 *
 * Tests the pure cost computation logic and validation schemas.
 * Database-dependent functions (deposit, settle, etc.) are tested
 * via integration tests.
 */

import {
  depositSchema,
  settleTaskSchema,
  costEstimateSchema,
  transactionListSchema,
} from '@/lib/a2a/billing';

// ──────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────

describe('depositSchema', () => {
  it('accepts a valid deposit', () => {
    const result = depositSchema.safeParse({ amount: 100 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(100);
      expect(result.data.currency).toBe('credits');
    }
  });

  it('rejects zero amount', () => {
    const result = depositSchema.safeParse({ amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = depositSchema.safeParse({ amount: -50 });
    expect(result.success).toBe(false);
  });

  it('rejects amount over 1 million', () => {
    const result = depositSchema.safeParse({ amount: 1_000_001 });
    expect(result.success).toBe(false);
  });

  it('accepts custom currency', () => {
    const result = depositSchema.safeParse({ amount: 50, currency: 'USD' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('USD');
    }
  });

  it('accepts optional description and idempotency key', () => {
    const result = depositSchema.safeParse({
      amount: 100,
      description: 'Top-up',
      idempotency_key: 'txn-abc-123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Top-up');
      expect(result.data.idempotency_key).toBe('txn-abc-123');
    }
  });
});

describe('settleTaskSchema', () => {
  it('accepts valid UUIDs', () => {
    const result = settleTaskSchema.safeParse({
      task_id: '550e8400-e29b-41d4-a716-446655440000',
      contract_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID task_id', () => {
    const result = settleTaskSchema.safeParse({
      task_id: 'not-a-uuid',
      contract_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = settleTaskSchema.safeParse({ task_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(false);
  });
});

describe('costEstimateSchema', () => {
  it('accepts valid contract_id UUID', () => {
    const result = costEstimateSchema.safeParse({
      contract_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID', () => {
    const result = costEstimateSchema.safeParse({ contract_id: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('transactionListSchema', () => {
  it('provides defaults', () => {
    const result = transactionListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts valid transaction type filter', () => {
    const result = transactionListSchema.safeParse({ type: 'charge' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid transaction type', () => {
    const result = transactionListSchema.safeParse({ type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts valid status filter', () => {
    const result = transactionListSchema.safeParse({ status: 'settled' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = transactionListSchema.safeParse({ status: 'bogus' });
    expect(result.success).toBe(false);
  });

  it('accepts pagination params', () => {
    const result = transactionListSchema.safeParse({ limit: 25, offset: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
      expect(result.data.offset).toBe(50);
    }
  });

  it('rejects limit over 100', () => {
    const result = transactionListSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('accepts contract_id filter', () => {
    const result = transactionListSchema.safeParse({
      contract_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID contract_id', () => {
    const result = transactionListSchema.safeParse({ contract_id: 'not-uuid' });
    expect(result.success).toBe(false);
  });
});
