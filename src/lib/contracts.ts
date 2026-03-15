import path from "node:path";
import { JsonFileStore } from "./data-store";

const CONTRACTS_FILE = path.join(process.cwd(), "data/contracts/contracts.json");
const store = new JsonFileStore<Contract>(CONTRACTS_FILE);

export type ContractStatus =
  | "proposed"
  | "accepted"
  | "active"
  | "completed"
  | "breached"
  | "disputed";

export interface ContractSLA {
  max_response_time_hours: number;
  availability_percent?: number;
}

export interface ContractTerms {
  delivery_deadline: string;
  quality_threshold: number; // 1-5 min rating
  retry_limit: number;
  escrow_amount: number;
  penalty_on_breach?: number;
  sla: ContractSLA;
}

export interface BreachReport {
  reason: string;
  evidence: string;
  reported_by: string;
  reported_at: string;
}

export interface Contract {
  id: string;
  proposer_id: string;
  counterparty_id: string;
  task_id?: string;
  terms: ContractTerms;
  status: ContractStatus;
  breach_report?: BreachReport;
  created_at: string;
  accepted_at?: string;
  updated_at: string;
}

export interface ProposeContractInput {
  proposer_id: string;
  counterparty_id: string;
  task_id?: string;
  terms: ContractTerms;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function proposeContract(input: ProposeContractInput): Promise<Contract> {
  const now = new Date().toISOString();

  const contract: Contract = {
    id: crypto.randomUUID(),
    proposer_id: input.proposer_id,
    counterparty_id: input.counterparty_id,
    task_id: input.task_id,
    terms: input.terms,
    status: "proposed",
    created_at: now,
    updated_at: now,
  };

  return store.create(contract);
}

export async function getAgentContracts(agentId: string): Promise<Contract[]> {
  return store.query(
    (c) => c.proposer_id === agentId || c.counterparty_id === agentId,
  );
}

export async function getContractById(id: string): Promise<Contract | null> {
  return store.getById(id);
}

export async function acceptContract(contractId: string, agentId: string): Promise<Contract> {
  return store.transaction(async (contracts) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Contract not found");
    if (contract.counterparty_id !== agentId) {
      throw new Error("Only the counterparty can accept this contract");
    }
    if (contract.status !== "proposed") {
      throw new Error(`Cannot accept a contract with status: ${contract.status}`);
    }

    const now = new Date().toISOString();
    contract.status = "active";
    contract.accepted_at = now;
    contract.updated_at = now;

    return { items: contracts, result: contract };
  });
}

export async function reportBreach(
  contractId: string,
  agentId: string,
  input: { reason: string; evidence: string },
): Promise<Contract> {
  return store.transaction(async (contracts) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Contract not found");

    const isParty =
      contract.proposer_id === agentId || contract.counterparty_id === agentId;
    if (!isParty) {
      throw new Error("Only contract parties can report a breach");
    }
    if (!["active", "accepted"].includes(contract.status)) {
      throw new Error(`Cannot report breach on a contract with status: ${contract.status}`);
    }

    const now = new Date().toISOString();
    contract.status = "breached";
    contract.breach_report = {
      reason: input.reason,
      evidence: input.evidence,
      reported_by: agentId,
      reported_at: now,
    };
    contract.updated_at = now;

    return { items: contracts, result: contract };
  });
}
