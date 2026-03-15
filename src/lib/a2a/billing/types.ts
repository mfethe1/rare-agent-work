/**
 * A2A Token Economy & Billing Ledger — Types
 *
 * The economic backbone of the agent ecosystem. Agents hold wallets with
 * credit balances. When tasks complete under a service contract, the
 * platform automatically settles the charge: debiting the consumer and
 * crediting the provider. Governance spend-limits are enforced against
 * real wallet state, not abstract policies.
 *
 * Wallet lifecycle:
 *   created (on agent registration or first deposit) → active → frozen (on suspension)
 *
 * Transaction lifecycle:
 *   pending → settled | failed | reversed
 *
 * Settlement flow:
 *   task.completed → find active contract → compute cost → hold (pending tx)
 *   → debit consumer wallet → credit provider wallet → settled
 */

// ──────────────────────────────────────────────
// Wallet
// ──────────────────────────────────────────────

export type WalletStatus = 'active' | 'frozen' | 'closed';

/** An agent's credit wallet on the platform. */
export interface AgentWallet {
  /** Platform-assigned wallet ID (UUID). */
  id: string;
  /** The agent who owns this wallet. */
  agent_id: string;
  /** Currency denomination (platform credits or ISO 4217). */
  currency: string;
  /** Current available balance (can be spent). */
  balance: number;
  /** Amount currently held in pending transactions. */
  held_balance: number;
  /** Total credits ever deposited or earned. */
  lifetime_credits: number;
  /** Total debits ever charged or withdrawn. */
  lifetime_debits: number;
  /** Wallet status. Frozen wallets cannot transact. */
  status: WalletStatus;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Transactions
// ──────────────────────────────────────────────

export type TransactionType =
  | 'deposit'       // Credits added (top-up, platform grant)
  | 'withdrawal'    // Credits removed (cash-out)
  | 'charge'        // Debit for a task under a contract
  | 'earning'       // Credit for providing a service
  | 'hold'          // Temporary hold before settlement
  | 'hold_release'  // Release of a hold (settlement or cancellation)
  | 'refund';       // Reversal of a charge

export type TransactionStatus = 'pending' | 'settled' | 'failed' | 'reversed';

/** An immutable ledger entry recording a credit or debit. */
export interface LedgerTransaction {
  /** Platform-assigned transaction ID (UUID). */
  id: string;
  /** Wallet this transaction affects. */
  wallet_id: string;
  /** Agent who owns the wallet. */
  agent_id: string;
  /** Transaction type. */
  type: TransactionType;
  /** Signed amount: positive = credit, negative = debit. */
  amount: number;
  /** Currency. */
  currency: string;
  /** Current status. */
  status: TransactionStatus;
  /** Contract under which this transaction occurred. */
  contract_id?: string;
  /** Task that triggered this transaction. */
  task_id?: string;
  /** Counterparty agent (for charges/earnings). */
  counterparty_agent_id?: string;
  /** Human-readable description. */
  description: string;
  /** Reference to a related transaction (e.g., refund → original charge). */
  reference_tx_id?: string;
  /** Idempotency key to prevent duplicate transactions. */
  idempotency_key?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
  created_at: string;
  settled_at?: string;
}

// ──────────────────────────────────────────────
// Settlement
// ──────────────────────────────────────────────

/** Result of settling a task under a contract. */
export interface SettlementResult {
  /** Whether settlement succeeded. */
  success: boolean;
  /** Consumer debit transaction ID. */
  debit_tx_id?: string;
  /** Provider credit transaction ID. */
  credit_tx_id?: string;
  /** Amount settled. */
  amount?: number;
  /** Currency. */
  currency?: string;
  /** Contract used for pricing. */
  contract_id?: string;
  /** Error if settlement failed. */
  error?: string;
}

/** Cost computation result before settlement. */
export interface CostEstimate {
  /** Computed cost based on contract pricing. */
  amount: number;
  /** Currency. */
  currency: string;
  /** Pricing model used. */
  pricing_model: string;
  /** Which tier applied (for tiered pricing). */
  tier_index?: number;
  /** Tasks completed so far in the contract (for tiered pricing). */
  tasks_completed_so_far: number;
}

// ──────────────────────────────────────────────
// Spend Tracking (for governance integration)
// ──────────────────────────────────────────────

/** Agent's spending summary for a given period. */
export interface SpendSummary {
  agent_id: string;
  currency: string;
  /** Total spent today. */
  daily_spend: number;
  /** Total spent this billing period. */
  period_spend: number;
  /** Available balance. */
  available_balance: number;
  /** Held balance. */
  held_balance: number;
  /** Whether the agent has exceeded governance spend limits. */
  over_daily_limit: boolean;
  /** The daily limit from governance policy (null if none). */
  daily_limit?: number;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** GET /api/a2a/billing/wallet — get own wallet. */
export interface WalletResponse {
  wallet: AgentWallet;
}

/** POST /api/a2a/billing/deposit — deposit credits. */
export interface DepositRequest {
  amount: number;
  currency?: string;
  description?: string;
  idempotency_key?: string;
}

export interface DepositResponse {
  transaction_id: string;
  wallet_id: string;
  new_balance: number;
  amount: number;
  currency: string;
}

/** POST /api/a2a/billing/settle — settle a completed task. */
export interface SettleTaskRequest {
  task_id: string;
  contract_id: string;
}

export interface SettleTaskResponse {
  settlement: SettlementResult;
}

/** GET /api/a2a/billing/transactions — list transactions. */
export interface TransactionListResponse {
  transactions: LedgerTransaction[];
  count: number;
}

/** GET /api/a2a/billing/spend — get spend summary. */
export interface SpendSummaryResponse {
  spend: SpendSummary;
}

/** POST /api/a2a/billing/estimate — estimate cost for a task. */
export interface CostEstimateRequest {
  contract_id: string;
}

export interface CostEstimateResponse {
  estimate: CostEstimate;
}
