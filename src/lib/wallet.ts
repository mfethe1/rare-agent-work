import path from "node:path";
import { JsonDictStore } from "./data-store";

const WALLETS_FILE = path.join(process.cwd(), "data/agents/wallets.json");
const store = new JsonDictStore<WalletRecord>(WALLETS_FILE);

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeWallet(agentId: string): WalletRecord {
  return {
    agent_id: agentId,
    balance: 0,
    escrowed: 0,
    transactions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getBalance(agentId: string): Promise<{ balance: number; escrowed: number }> {
  const wallet = await store.get(agentId);
  if (!wallet) return { balance: 0, escrowed: 0 };
  return { balance: wallet.balance, escrowed: wallet.escrowed };
}

export async function addCredits(
  agentId: string,
  amount: number,
  reason: string,
  referenceId?: string,
): Promise<Transaction> {
  if (amount <= 0) throw new Error("Amount must be positive");

  return store.transaction(async (data) => {
    if (!data[agentId]) data[agentId] = makeWallet(agentId);
    const wallet = data[agentId];

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

    return { data, result: tx };
  });
}

export async function deductCredits(
  agentId: string,
  amount: number,
  reason: string,
  referenceId?: string,
): Promise<Transaction> {
  if (amount <= 0) throw new Error("Amount must be positive");

  return store.transaction(async (data) => {
    if (!data[agentId]) data[agentId] = makeWallet(agentId);
    const wallet = data[agentId];

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

    return { data, result: tx };
  });
}

export async function holdEscrow(
  agentId: string,
  amount: number,
  referenceId: string,
): Promise<Transaction> {
  if (amount <= 0) throw new Error("Amount must be positive");

  return store.transaction(async (data) => {
    if (!data[agentId]) data[agentId] = makeWallet(agentId);
    const wallet = data[agentId];

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

    return { data, result: tx };
  });
}

export async function releaseEscrow(
  recipientAgentId: string,
  ownerAgentId: string,
  amount: number,
  referenceId: string,
): Promise<Transaction> {
  return store.transaction(async (data) => {
    if (!data[ownerAgentId]) data[ownerAgentId] = makeWallet(ownerAgentId);
    if (!data[recipientAgentId]) data[recipientAgentId] = makeWallet(recipientAgentId);

    const ownerWallet = data[ownerAgentId];
    if (ownerWallet.escrowed < amount) {
      throw new Error("Escrow amount mismatch");
    }
    ownerWallet.escrowed -= amount;
    ownerWallet.updated_at = new Date().toISOString();

    const recipientWallet = data[recipientAgentId];
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

    return { data, result: tx };
  });
}

export async function getTransactions(
  agentId: string,
  limit = 20,
  offset = 0,
): Promise<{ transactions: Transaction[]; total: number }> {
  const wallet = await store.get(agentId);
  if (!wallet) return { transactions: [], total: 0 };

  const sorted = [...wallet.transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return {
    transactions: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}

/**
 * Get recent deposits for rate limiting checks.
 */
export async function getRecentDeposits(
  agentId: string,
  windowMs: number,
): Promise<Transaction[]> {
  const wallet = await store.get(agentId);
  if (!wallet) return [];

  const cutoff = Date.now() - windowMs;
  return wallet.transactions.filter(
    (tx) =>
      tx.type === "credit" &&
      tx.reason === "manual_deposit" &&
      new Date(tx.created_at).getTime() > cutoff,
  );
}
