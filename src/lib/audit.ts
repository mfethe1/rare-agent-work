/**
 * Audit Trail & Compliance
 * Lightweight append-only log for all state-changing operations.
 * Round 25
 */

import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";

const AUDIT_FILE = path.join(process.cwd(), "data/audit/audit-log.json");

export type AuditAction =
  | "agent.registered"
  | "task.created"
  | "task.bid"
  | "task.delivered"
  | "task.reviewed"
  | "task.completed"
  | "contract.proposed"
  | "contract.accepted"
  | "contract.breached"
  | "space.created"
  | "space.entry_added"
  | "credits.deposited"
  | "credits.escrowed"
  | "credits.released"
  | "webhook.registered"
  | "challenge.submitted"
  | "challenge.passed";

export interface AuditEntry {
  id: string;
  timestamp: string;
  agent_id: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  request_id?: string;
}

// Public actions viewable for any agent's public trail
export const PUBLIC_AUDIT_ACTIONS: AuditAction[] = [
  "task.completed",
  "challenge.passed",
  "contract.accepted",
];

// ─── Internal helpers ──────────────────────────────────────────────────────────

function ensureDir() {
  const dir = path.dirname(AUDIT_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function readLog(): Promise<AuditEntry[]> {
  try {
    const raw = await fs.readFile(AUDIT_FILE, "utf-8");
    return JSON.parse(raw) as AuditEntry[];
  } catch {
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Append an audit entry. Non-blocking — fires and forgets errors.
 * Call with void / no await to keep routes fast.
 */
export async function appendAudit(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<void> {
  try {
    ensureDir();
    const log = await readLog();
    const full: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    log.push(full);
    await fs.writeFile(AUDIT_FILE, JSON.stringify(log, null, 2), "utf-8");
  } catch {
    // Audit failures must never break the main flow
  }
}

export interface GetAuditFilter {
  agent_id?: string;
  action?: AuditAction;
  resource_type?: string;
  since?: string;
  until?: string;
  limit?: number;
  public_only?: boolean;
}

export async function getAuditLog(filter: GetAuditFilter): Promise<AuditEntry[]> {
  let log = await readLog();

  if (filter.agent_id) {
    log = log.filter((e) => e.agent_id === filter.agent_id);
  }
  if (filter.action) {
    log = log.filter((e) => e.action === filter.action);
  }
  if (filter.resource_type) {
    log = log.filter((e) => e.resource_type === filter.resource_type);
  }
  if (filter.since) {
    const since = new Date(filter.since).getTime();
    log = log.filter((e) => new Date(e.timestamp).getTime() >= since);
  }
  if (filter.until) {
    const until = new Date(filter.until).getTime();
    log = log.filter((e) => new Date(e.timestamp).getTime() <= until);
  }
  if (filter.public_only) {
    log = log.filter((e) => PUBLIC_AUDIT_ACTIONS.includes(e.action));
  }

  // Newest first
  log.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const limit = Math.min(filter.limit ?? 100, 500);
  return log.slice(0, limit);
}
