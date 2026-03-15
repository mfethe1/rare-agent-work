/**
 * Zod validation schemas for A2A Billing Ledger endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// Deposit — POST /api/a2a/billing/deposit
// ──────────────────────────────────────────────

export const depositSchema = z.object({
  amount: z.number().positive('Deposit amount must be positive').max(1_000_000),
  currency: trimmed(16).default('credits'),
  description: trimmed(500).optional(),
  idempotency_key: trimmed(128).optional(),
});

export type DepositInput = z.infer<typeof depositSchema>;

// ──────────────────────────────────────────────
// Settle Task — POST /api/a2a/billing/settle
// ──────────────────────────────────────────────

export const settleTaskSchema = z.object({
  task_id: z.string().uuid('Task ID must be a valid UUID'),
  contract_id: z.string().uuid('Contract ID must be a valid UUID'),
});

export type SettleTaskInput = z.infer<typeof settleTaskSchema>;

// ──────────────────────────────────────────────
// Cost Estimate — POST /api/a2a/billing/estimate
// ──────────────────────────────────────────────

export const costEstimateSchema = z.object({
  contract_id: z.string().uuid('Contract ID must be a valid UUID'),
});

export type CostEstimateInput = z.infer<typeof costEstimateSchema>;

// ──────────────────────────────────────────────
// Transaction List — GET /api/a2a/billing/transactions
// ──────────────────────────────────────────────

export const transactionListSchema = z.object({
  type: z.enum(['deposit', 'withdrawal', 'charge', 'earning', 'hold', 'hold_release', 'refund']).optional(),
  status: z.enum(['pending', 'settled', 'failed', 'reversed']).optional(),
  contract_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type TransactionListInput = z.infer<typeof transactionListSchema>;
