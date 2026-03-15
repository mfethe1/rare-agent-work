/**
 * Agent Memory-as-a-Service
 * Round 31: Persistent memory storage for agents.
 */

import fs from "node:fs";
import path from "node:path";

const MEMORY_DIR = path.join(process.cwd(), "data/memory");
const MEMORY_FILE = path.join(MEMORY_DIR, "memories.json");

const MAX_MEMORIES_PER_AGENT = 1000;
const MAX_VALUE_BYTES = 100 * 1024; // 100KB

export interface AgentMemory {
  id: string;
  agent_id: string;
  key: string;
  value: unknown;
  namespace: string;
  ttl_hours?: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

// ─── File helpers ──────────────────────────────────────────────────────────────

function loadMemories(): AgentMemory[] {
  try {
    const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
    const all = JSON.parse(raw) as AgentMemory[];
    // Filter expired
    const now = Date.now();
    return all.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now);
  } catch {
    return [];
  }
}

function saveMemories(memories: AgentMemory[]): void {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface ListMemoriesOptions {
  namespace?: string;
  key_prefix?: string;
  page?: number;
  page_size?: number;
}

export async function listMemories(
  agentId: string,
  opts: ListMemoriesOptions = {},
): Promise<{ memories: AgentMemory[]; total: number; page: number; page_size: number }> {
  const all = loadMemories();
  let filtered = all.filter((m) => m.agent_id === agentId);

  if (opts.namespace) {
    filtered = filtered.filter((m) => m.namespace === opts.namespace);
  }
  if (opts.key_prefix) {
    filtered = filtered.filter((m) => m.key.startsWith(opts.key_prefix!));
  }

  const total = filtered.length;
  const page = opts.page ?? 1;
  const page_size = Math.min(opts.page_size ?? 50, 200);
  const start = (page - 1) * page_size;
  const memories = filtered.slice(start, start + page_size);

  return { memories, total, page, page_size };
}

export async function getMemory(agentId: string, key: string): Promise<AgentMemory | null> {
  const all = loadMemories();
  return all.find((m) => m.agent_id === agentId && m.key === key) ?? null;
}

export interface StoreMemoryInput {
  key: string;
  value: unknown;
  namespace?: string;
  ttl_hours?: number;
}

export async function storeMemory(
  agentId: string,
  input: StoreMemoryInput,
): Promise<{ memory: AgentMemory; created: boolean }> {
  // Validate value size
  const valueStr = JSON.stringify(input.value);
  if (Buffer.byteLength(valueStr, "utf-8") > MAX_VALUE_BYTES) {
    throw new Error(`Value exceeds maximum size of ${MAX_VALUE_BYTES / 1024}KB`);
  }

  const all = loadMemories();
  const now = new Date().toISOString();
  const namespace = input.namespace ?? "default";

  // Check if key already exists for this agent
  const existing = all.findIndex((m) => m.agent_id === agentId && m.key === input.key);

  if (existing >= 0) {
    // Update existing
    const updated: AgentMemory = {
      ...all[existing],
      value: input.value,
      namespace,
      ttl_hours: input.ttl_hours,
      updated_at: now,
      expires_at: input.ttl_hours
        ? new Date(Date.now() + input.ttl_hours * 3600000).toISOString()
        : undefined,
    };
    all[existing] = updated;
    saveMemories(all);
    return { memory: updated, created: false };
  }

  // Check per-agent limit
  const agentMemories = all.filter((m) => m.agent_id === agentId);
  if (agentMemories.length >= MAX_MEMORIES_PER_AGENT) {
    throw new Error(`Memory limit reached: max ${MAX_MEMORIES_PER_AGENT} memories per agent`);
  }

  const memory: AgentMemory = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    key: input.key,
    value: input.value,
    namespace,
    ttl_hours: input.ttl_hours,
    created_at: now,
    updated_at: now,
    expires_at: input.ttl_hours
      ? new Date(Date.now() + input.ttl_hours * 3600000).toISOString()
      : undefined,
  };

  all.push(memory);
  saveMemories(all);
  return { memory, created: true };
}

export async function updateMemory(
  agentId: string,
  key: string,
  value: unknown,
  ttl_hours?: number,
): Promise<AgentMemory | null> {
  const valueStr = JSON.stringify(value);
  if (Buffer.byteLength(valueStr, "utf-8") > MAX_VALUE_BYTES) {
    throw new Error(`Value exceeds maximum size of ${MAX_VALUE_BYTES / 1024}KB`);
  }

  const all = loadMemories();
  const idx = all.findIndex((m) => m.agent_id === agentId && m.key === key);
  if (idx < 0) return null;

  const now = new Date().toISOString();
  all[idx] = {
    ...all[idx],
    value,
    updated_at: now,
    ttl_hours,
    expires_at: ttl_hours
      ? new Date(Date.now() + ttl_hours * 3600000).toISOString()
      : all[idx].expires_at,
  };
  saveMemories(all);
  return all[idx];
}

export async function deleteMemory(agentId: string, key: string): Promise<boolean> {
  const all = loadMemories();
  const idx = all.findIndex((m) => m.agent_id === agentId && m.key === key);
  if (idx < 0) return false;
  all.splice(idx, 1);
  saveMemories(all);
  return true;
}

export async function searchMemories(
  agentId: string,
  q: string,
  namespace?: string,
  limit = 20,
): Promise<AgentMemory[]> {
  const all = loadMemories();
  let filtered = all.filter((m) => m.agent_id === agentId);

  if (namespace) {
    filtered = filtered.filter((m) => m.namespace === namespace);
  }

  const query = q.toLowerCase();
  filtered = filtered.filter((m) => JSON.stringify(m.value).toLowerCase().includes(query));

  return filtered.slice(0, Math.min(limit, 100));
}
