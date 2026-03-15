/**
 * A2A Token Economy & Billing Engine
 *
 * Manages agent wallets, ledger transactions, cost computation from
 * contract pricing models, task settlement, and governance spend-limit
 * enforcement. All balance mutations are atomic (single-row updates
 * with balance checks) to prevent overdrafts.
 */

import { getServiceDb } from '../auth';
import type {
  AgentWallet,
  WalletStatus,
  LedgerTransaction,
  TransactionType,
  TransactionStatus,
  SettlementResult,
  CostEstimate,
  SpendSummary,
} from './types';
import type { ServiceContract, ContractPricing, ContractCompliance } from '../contracts/types';
import type { DepositInput, SettleTaskInput, TransactionListInput } from './validation';

// ──────────────────────────────────────────────
// Wallet Operations
// ──────────────────────────────────────────────

/**
 * Get or create a wallet for an agent. Every agent gets exactly one
 * wallet per currency (defaulting to 'credits').
 */
export async function getOrCreateWallet(
  agent_id: string,
  currency = 'credits',
): Promise<AgentWallet | null> {
  const db = getServiceDb();
  if (!db) return null;

  // Try to fetch existing wallet
  const { data: existing } = await db
    .from('a2a_wallets')
    .select('*')
    .eq('agent_id', agent_id)
    .eq('currency', currency)
    .single();

  if (existing) return existing as AgentWallet;

  // Create new wallet with zero balance
  const { data: created, error } = await db
    .from('a2a_wallets')
    .insert({
      agent_id,
      currency,
      balance: 0,
      held_balance: 0,
      lifetime_credits: 0,
      lifetime_debits: 0,
      status: 'active',
    })
    .select('*')
    .single();

  if (error || !created) return null;
  return created as AgentWallet;
}

/** Get an agent's wallet (without auto-creating). */
export async function getWallet(agent_id: string, currency = 'credits'): Promise<AgentWallet | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data } = await db
    .from('a2a_wallets')
    .select('*')
    .eq('agent_id', agent_id)
    .eq('currency', currency)
    .single();

  return (data as AgentWallet) ?? null;
}

/** Freeze or unfreeze a wallet (used by kill switch integration). */
export async function setWalletStatus(
  agent_id: string,
  status: WalletStatus,
  currency = 'credits',
): Promise<boolean> {
  const db = getServiceDb();
  if (!db) return false;

  const { error } = await db
    .from('a2a_wallets')
    .update({ status })
    .eq('agent_id', agent_id)
    .eq('currency', currency);

  return !error;
}

// ──────────────────────────────────────────────
// Deposit (Credit)
// ──────────────────────────────────────────────

interface DepositParams {
  agent_id: string;
  input: DepositInput;
}

export async function deposit({ agent_id, input }: DepositParams): Promise<{
  transaction_id: string;
  wallet_id: string;
  new_balance: number;
  amount: number;
  currency: string;
} | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const wallet = await getOrCreateWallet(agent_id, input.currency);
  if (!wallet) return { error: 'Failed to initialize wallet', status_code: 500 };
  if (wallet.status === 'frozen') return { error: 'Wallet is frozen', status_code: 403 };
  if (wallet.status === 'closed') return { error: 'Wallet is closed', status_code: 403 };

  // Idempotency check
  if (input.idempotency_key) {
    const { data: existing } = await db
      .from('a2a_ledger_transactions')
      .select('id')
      .eq('idempotency_key', input.idempotency_key)
      .eq('wallet_id', wallet.id)
      .single();

    if (existing) {
      return { error: 'Duplicate transaction (idempotency key already used)', status_code: 409 };
    }
  }

  // Create transaction
  const { data: tx, error: txErr } = await db
    .from('a2a_ledger_transactions')
    .insert({
      wallet_id: wallet.id,
      agent_id,
      type: 'deposit' as TransactionType,
      amount: input.amount,
      currency: input.currency,
      status: 'settled' as TransactionStatus,
      description: input.description ?? 'Credit deposit',
      idempotency_key: input.idempotency_key ?? null,
      settled_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (txErr || !tx) return { error: 'Failed to record transaction', status_code: 500 };

  // Update wallet balance atomically
  const newBalance = wallet.balance + input.amount;
  const newLifetimeCredits = wallet.lifetime_credits + input.amount;

  const { error: updateErr } = await db
    .from('a2a_wallets')
    .update({
      balance: newBalance,
      lifetime_credits: newLifetimeCredits,
    })
    .eq('id', wallet.id)
    .eq('balance', wallet.balance); // Optimistic concurrency check

  if (updateErr) return { error: 'Balance update conflict — please retry', status_code: 409 };

  return {
    transaction_id: tx.id,
    wallet_id: wallet.id,
    new_balance: newBalance,
    amount: input.amount,
    currency: input.currency,
  };
}

// ──────────────────────────────────────────────
// Cost Computation
// ──────────────────────────────────────────────

/**
 * Compute the cost of the next task under a contract's pricing model.
 * For tiered pricing, we count tasks already completed to determine
 * which tier applies.
 */
export async function computeCost(contract_id: string): Promise<CostEstimate | null> {
  const db = getServiceDb();
  if (!db) return null;

  const { data: contract } = await db
    .from('a2a_service_contracts')
    .select('*')
    .eq('id', contract_id)
    .single();

  if (!contract) return null;

  const pricing = contract.pricing as ContractPricing;
  const compliance = (contract.compliance as ContractCompliance) ?? { tasks_completed: 0 };
  const tasksSoFar = compliance.tasks_completed ?? 0;

  switch (pricing.model) {
    case 'free':
      return {
        amount: 0,
        currency: pricing.currency,
        pricing_model: 'free',
        tasks_completed_so_far: tasksSoFar,
      };

    case 'per_task':
      return {
        amount: pricing.per_task_cost ?? 0,
        currency: pricing.currency,
        pricing_model: 'per_task',
        tasks_completed_so_far: tasksSoFar,
      };

    case 'subscription':
      // Subscription: no per-task cost, settled via periodic billing
      return {
        amount: 0,
        currency: pricing.currency,
        pricing_model: 'subscription',
        tasks_completed_so_far: tasksSoFar,
      };

    case 'tiered': {
      const tiers = pricing.tiers ?? [];
      if (tiers.length === 0) {
        return { amount: 0, currency: pricing.currency, pricing_model: 'tiered', tasks_completed_so_far: tasksSoFar };
      }

      // Find which tier the next task falls into
      const nextTaskNumber = tasksSoFar + 1;
      let tierIndex = tiers.length - 1; // Default to highest tier
      for (let i = 0; i < tiers.length; i++) {
        if (nextTaskNumber <= tiers[i].up_to_tasks) {
          tierIndex = i;
          break;
        }
      }

      return {
        amount: tiers[tierIndex].cost_per_task,
        currency: pricing.currency,
        pricing_model: 'tiered',
        tier_index: tierIndex,
        tasks_completed_so_far: tasksSoFar,
      };
    }

    default:
      return null;
  }
}

// ──────────────────────────────────────────────
// Task Settlement
// ──────────────────────────────────────────────

/**
 * Settle a completed task: debit consumer, credit provider.
 *
 * This is the core economic mechanism. Called after a task completes
 * under a service contract. Enforces:
 * 1. Contract exists and is active
 * 2. Task exists and is completed
 * 3. Consumer has sufficient balance
 * 4. Consumer's governance spend limits are not exceeded
 */
export async function settleTask(
  agent_id: string,
  input: SettleTaskInput,
): Promise<SettlementResult> {
  const db = getServiceDb();
  if (!db) return { success: false, error: 'Service unavailable' };

  // 1. Verify task exists and is completed
  const { data: task } = await db
    .from('a2a_tasks')
    .select('id, status, sender_agent_id, target_agent_id')
    .eq('id', input.task_id)
    .single();

  if (!task) return { success: false, error: 'Task not found' };
  if (task.status !== 'completed') return { success: false, error: `Task status is "${task.status}", expected "completed"` };

  // 2. Verify contract exists and is active
  const { data: contract } = await db
    .from('a2a_service_contracts')
    .select('*')
    .eq('id', input.contract_id)
    .eq('status', 'active')
    .single();

  if (!contract) return { success: false, error: 'Active contract not found' };

  // Verify the agent is a party to the contract
  const consumerId = contract.consumer_agent_id as string;
  const providerId = contract.provider_agent_id as string;
  if (agent_id !== consumerId && agent_id !== providerId) {
    return { success: false, error: 'You are not a party to this contract' };
  }

  // Verify the task parties match the contract parties
  if (task.sender_agent_id !== consumerId || task.target_agent_id !== providerId) {
    return { success: false, error: 'Task parties do not match contract parties' };
  }

  // 3. Check for duplicate settlement
  const { data: existingTx } = await db
    .from('a2a_ledger_transactions')
    .select('id')
    .eq('task_id', input.task_id)
    .eq('type', 'charge')
    .eq('status', 'settled')
    .single();

  if (existingTx) return { success: false, error: 'Task already settled' };

  // 4. Compute cost
  const estimate = await computeCost(input.contract_id);
  if (!estimate) return { success: false, error: 'Failed to compute cost' };

  // Free tasks don't need settlement
  if (estimate.amount === 0) {
    return {
      success: true,
      amount: 0,
      currency: estimate.currency,
      contract_id: input.contract_id,
    };
  }

  // 5. Get consumer wallet and check balance
  const consumerWallet = await getOrCreateWallet(consumerId, estimate.currency);
  if (!consumerWallet) return { success: false, error: 'Consumer wallet unavailable' };
  if (consumerWallet.status !== 'active') return { success: false, error: 'Consumer wallet is not active' };
  if (consumerWallet.balance < estimate.amount) {
    return { success: false, error: `Insufficient balance: need ${estimate.amount} ${estimate.currency}, have ${consumerWallet.balance}` };
  }

  // 6. Check governance spend limits
  const spendCheck = await checkDailySpendLimit(consumerId, estimate.amount, estimate.currency);
  if (!spendCheck.allowed) {
    return { success: false, error: spendCheck.reason };
  }

  // 7. Get provider wallet
  const providerWallet = await getOrCreateWallet(providerId, estimate.currency);
  if (!providerWallet) return { success: false, error: 'Provider wallet unavailable' };
  if (providerWallet.status !== 'active') return { success: false, error: 'Provider wallet is not active' };

  // 8. Create paired transactions (debit consumer, credit provider)
  const now = new Date().toISOString();

  const { data: debitTx, error: debitTxErr } = await db
    .from('a2a_ledger_transactions')
    .insert({
      wallet_id: consumerWallet.id,
      agent_id: consumerId,
      type: 'charge' as TransactionType,
      amount: -estimate.amount,
      currency: estimate.currency,
      status: 'settled' as TransactionStatus,
      contract_id: input.contract_id,
      task_id: input.task_id,
      counterparty_agent_id: providerId,
      description: `Task charge under contract ${input.contract_id.slice(0, 8)}`,
      settled_at: now,
    })
    .select('id')
    .single();

  if (debitTxErr || !debitTx) return { success: false, error: 'Failed to record debit transaction' };

  const { data: creditTx, error: creditTxErr } = await db
    .from('a2a_ledger_transactions')
    .insert({
      wallet_id: providerWallet.id,
      agent_id: providerId,
      type: 'earning' as TransactionType,
      amount: estimate.amount,
      currency: estimate.currency,
      status: 'settled' as TransactionStatus,
      contract_id: input.contract_id,
      task_id: input.task_id,
      counterparty_agent_id: consumerId,
      description: `Task earning under contract ${input.contract_id.slice(0, 8)}`,
      reference_tx_id: debitTx.id,
      settled_at: now,
    })
    .select('id')
    .single();

  if (creditTxErr || !creditTx) {
    // Rollback debit transaction
    await db
      .from('a2a_ledger_transactions')
      .update({ status: 'failed' })
      .eq('id', debitTx.id);
    return { success: false, error: 'Failed to record credit transaction' };
  }

  // 9. Update wallet balances atomically
  const { error: debitErr } = await db
    .from('a2a_wallets')
    .update({
      balance: consumerWallet.balance - estimate.amount,
      lifetime_debits: consumerWallet.lifetime_debits + estimate.amount,
    })
    .eq('id', consumerWallet.id)
    .eq('balance', consumerWallet.balance);

  if (debitErr) {
    // Mark both transactions as failed
    await db.from('a2a_ledger_transactions').update({ status: 'failed' }).eq('id', debitTx.id);
    await db.from('a2a_ledger_transactions').update({ status: 'failed' }).eq('id', creditTx.id);
    return { success: false, error: 'Consumer balance update conflict — please retry' };
  }

  const { error: creditErr } = await db
    .from('a2a_wallets')
    .update({
      balance: providerWallet.balance + estimate.amount,
      lifetime_credits: providerWallet.lifetime_credits + estimate.amount,
    })
    .eq('id', providerWallet.id)
    .eq('balance', providerWallet.balance);

  if (creditErr) {
    // Rollback consumer debit
    await db.from('a2a_wallets').update({ balance: consumerWallet.balance }).eq('id', consumerWallet.id);
    await db.from('a2a_ledger_transactions').update({ status: 'failed' }).eq('id', debitTx.id);
    await db.from('a2a_ledger_transactions').update({ status: 'failed' }).eq('id', creditTx.id);
    return { success: false, error: 'Provider balance update conflict — please retry' };
  }

  return {
    success: true,
    debit_tx_id: debitTx.id,
    credit_tx_id: creditTx.id,
    amount: estimate.amount,
    currency: estimate.currency,
    contract_id: input.contract_id,
  };
}

// ──────────────────────────────────────────────
// Governance Spend Limit Integration
// ──────────────────────────────────────────────

/**
 * Check if an agent's pending charge would exceed their governance
 * daily spend limit. Queries today's settled charges and compares
 * against the spend_limit from the agent's active governance policy.
 */
async function checkDailySpendLimit(
  agent_id: string,
  proposed_amount: number,
  currency: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const db = getServiceDb();
  if (!db) return { allowed: true }; // Fail open if DB unavailable

  // Find agent's governance policy with spend limit
  const { data: policies } = await db
    .from('a2a_governance_policies')
    .select('spend_limit')
    .eq('agent_id', agent_id)
    .eq('is_active', true)
    .not('spend_limit', 'is', null)
    .order('priority', { ascending: false })
    .limit(1);

  if (!policies || policies.length === 0) return { allowed: true }; // No spend limit policy

  const spendLimit = policies[0].spend_limit as { max_daily_spend: number; max_per_action_spend: number; currency: string };

  // Check per-action limit
  if (spendLimit.currency === currency && proposed_amount > spendLimit.max_per_action_spend) {
    return {
      allowed: false,
      reason: `Charge of ${proposed_amount} ${currency} exceeds per-action spend limit of ${spendLimit.max_per_action_spend} ${currency}`,
    };
  }

  // Check daily limit: sum today's charges
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: todayCharges } = await db
    .from('a2a_ledger_transactions')
    .select('amount')
    .eq('agent_id', agent_id)
    .eq('type', 'charge')
    .eq('status', 'settled')
    .eq('currency', currency)
    .gte('settled_at', todayStart.toISOString());

  const dailySpent = (todayCharges ?? []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  if (spendLimit.currency === currency && dailySpent + proposed_amount > spendLimit.max_daily_spend) {
    return {
      allowed: false,
      reason: `Daily spend would reach ${dailySpent + proposed_amount} ${currency}, exceeding limit of ${spendLimit.max_daily_spend} ${currency}`,
    };
  }

  return { allowed: true };
}

// ──────────────────────────────────────────────
// Transaction Queries
// ──────────────────────────────────────────────

interface ListTransactionsParams {
  agent_id: string;
  input: TransactionListInput;
}

export async function listTransactions({ agent_id, input }: ListTransactionsParams): Promise<{
  transactions: LedgerTransaction[];
  count: number;
}> {
  const db = getServiceDb();
  if (!db) return { transactions: [], count: 0 };

  let query = db
    .from('a2a_ledger_transactions')
    .select('*', { count: 'exact' })
    .eq('agent_id', agent_id);

  if (input.type) query = query.eq('type', input.type);
  if (input.status) query = query.eq('status', input.status);
  if (input.contract_id) query = query.eq('contract_id', input.contract_id);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  return {
    transactions: (data as LedgerTransaction[]) ?? [],
    count: count ?? 0,
  };
}

// ──────────────────────────────────────────────
// Spend Summary (for governance UI / agents)
// ──────────────────────────────────────────────

export async function getSpendSummary(agent_id: string, currency = 'credits'): Promise<SpendSummary | null> {
  const db = getServiceDb();
  if (!db) return null;

  const wallet = await getWallet(agent_id, currency);

  // Today's charges
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: todayCharges } = await db
    .from('a2a_ledger_transactions')
    .select('amount')
    .eq('agent_id', agent_id)
    .eq('type', 'charge')
    .eq('status', 'settled')
    .eq('currency', currency)
    .gte('settled_at', todayStart.toISOString());

  const dailySpend = (todayCharges ?? []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  // Period charges (last 30 days)
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 30);

  const { data: periodCharges } = await db
    .from('a2a_ledger_transactions')
    .select('amount')
    .eq('agent_id', agent_id)
    .eq('type', 'charge')
    .eq('status', 'settled')
    .eq('currency', currency)
    .gte('settled_at', periodStart.toISOString());

  const periodSpend = (periodCharges ?? []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  // Check governance daily limit
  let dailyLimit: number | undefined;
  let overDailyLimit = false;

  const { data: policies } = await db
    .from('a2a_governance_policies')
    .select('spend_limit')
    .eq('agent_id', agent_id)
    .eq('is_active', true)
    .not('spend_limit', 'is', null)
    .order('priority', { ascending: false })
    .limit(1);

  if (policies && policies.length > 0) {
    const spendLimit = policies[0].spend_limit as { max_daily_spend: number; currency: string };
    if (spendLimit.currency === currency) {
      dailyLimit = spendLimit.max_daily_spend;
      overDailyLimit = dailySpend > dailyLimit;
    }
  }

  return {
    agent_id,
    currency,
    daily_spend: Math.round(dailySpend * 100) / 100,
    period_spend: Math.round(periodSpend * 100) / 100,
    available_balance: wallet?.balance ?? 0,
    held_balance: wallet?.held_balance ?? 0,
    over_daily_limit: overDailyLimit,
    daily_limit: dailyLimit,
  };
}
