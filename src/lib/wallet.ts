import fs from "node:fs";
import path from "node:path";

const WALLETS_FILE = path.join(process.cwd(), "data/agents/wallets.json");

export interface Transaction {
  id: string;
  agent_id: string;
  type: "credit" | "debit" | "escrow_hold" | "escrow_release";
  amount: number;
  reason: string;
  reference_id?: string;
  balance_after: number;
  created_at: string;
}

export interface WalletRecord {
  agent_id: string;
  balance: number;
  escrowed: number;
  transactions: Transaction[];
  created_at: string;
  updated_at: string;
}

// ─── File helpers ──────────────────────────────────────────────────────────────

function readWallets(): Record<string, WalletRecord> {
  try {
    const raw = fs.readFileSync(WALLETS_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, WalletRecord>;
  } catch {
    return {};
  }
}

function writeWallets(wallets: Record<string, WalletRecord>): void {
  const dir = path.dirname(WALLETS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2), "utf-8");
}

function ensureWallet(wallets: Record<string, WalletRecord>, agentId: string): WalletRecord {
  if (!wallets[agentId]) {
    wallets[agentId] = {
      agent_id: agentId,
      balance: 0,
      escrowed: 0,
      transactions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return wallets[agentId];
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function getBalance(agentId: string): { balance: number; escrowed: number } {
  const wallets = readWallets();
  const wallet = wallets[agentId];
  if (!wallet) return { balance: 0, escrowed: 0 };
  return { balance: wallet.balance, escrowed: wallet.escrowed };
}

export function addCredits(
  agentId: string,
  amount: number,
  reason: string,
  referenceId?: string,
): Transaction {
  if (amount <= 0) throw new Error("Amount must be positive");

  const wallets = readWallets();
  const wallet = ensureWallet(wallets, agentId);

  wallet.balance += amount;
  const tx: Transaction = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    type: "credit",
    amount,
    reason,
    reference_id: referenceId,
    balance_after: wallet.balance,
    created_at: new Date().toISOString(),
  };
  wallet.transactions.push(tx);
  wallet.updated_at = new Date().toISOString();

  writeWallets(wallets);
  return tx;
}

export function deductCredits(
  agentId: string,
  amount: number,
  reason: string,
  referenceId?: string,
): Transaction {
  if (amount <= 0) throw new Error("Amount must be positive");

  const wallets = readWallets();
  const wallet = ensureWallet(wallets, agentId);

  if (wallet.balance < amount) {
    throw new Error(`Insufficient credits. Balance: ${wallet.balance}, Required: ${amount}`);
  }

  wallet.balance -= amount;
  const tx: Transaction = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    type: "debit",
    amount,
    reason,
    reference_id: referenceId,
    balance_after: wallet.balance,
    created_at: new Date().toISOString(),
  };
  wallet.transactions.push(tx);
  wallet.updated_at = new Date().toISOString();

  writeWallets(wallets);
  return tx;
}

export function holdEscrow(
  agentId: string,
  amount: number,
  referenceId: string,
): Transaction {
  if (amount <= 0) throw new Error("Amount must be positive");

  const wallets = readWallets();
  const wallet = ensureWallet(wallets, agentId);

  if (wallet.balance < amount) {
    throw new Error(`Insufficient credits for escrow. Balance: ${wallet.balance}, Required: ${amount}`);
  }

  wallet.balance -= amount;
  wallet.escrowed += amount;
  const tx: Transaction = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    type: "escrow_hold",
    amount,
    reason: "task_escrow",
    reference_id: referenceId,
    balance_after: wallet.balance,
    created_at: new Date().toISOString(),
  };
  wallet.transactions.push(tx);
  wallet.updated_at = new Date().toISOString();

  writeWallets(wallets);
  return tx;
}

export function releaseEscrow(
  recipientAgentId: string,
  ownerAgentId: string,
  amount: number,
  referenceId: string,
): Transaction {
  const wallets = readWallets();

  // Deduct from owner's escrow
  const ownerWallet = ensureWallet(wallets, ownerAgentId);
  if (ownerWallet.escrowed < amount) {
    throw new Error("Escrow amount mismatch");
  }
  ownerWallet.escrowed -= amount;
  ownerWallet.updated_at = new Date().toISOString();

  // Credit recipient
  const recipientWallet = ensureWallet(wallets, recipientAgentId);
  recipientWallet.balance += amount;
  const tx: Transaction = {
    id: crypto.randomUUID(),
    agent_id: recipientAgentId,
    type: "escrow_release",
    amount,
    reason: "task_completion_payment",
    reference_id: referenceId,
    balance_after: recipientWallet.balance,
    created_at: new Date().toISOString(),
  };
  recipientWallet.transactions.push(tx);
  recipientWallet.updated_at = new Date().toISOString();

  writeWallets(wallets);
  return tx;
}

export function getTransactions(
  agentId: string,
  limit = 20,
  offset = 0,
): { transactions: Transaction[]; total: number } {
  const wallets = readWallets();
  const wallet = wallets[agentId];
  if (!wallet) return { transactions: [], total: 0 };

  const sorted = [...wallet.transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return {
    transactions: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}
