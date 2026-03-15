import path from "node:path";
import { JsonFileStore } from "./data-store";

export interface AgentRecord {
  id: string; // required by DataStore<T>
  agent_id: string;
  name: string;
  description: string;
  capabilities: string[];
  callback_url?: string;
  hashed_key: string;
  created_at: string;
  scopes: string[];
}

const AGENTS_FILE = path.join(process.cwd(), "data/agents/agents.json");
const store = new JsonFileStore<AgentRecord>(AGENTS_FILE);

// ─── Key generation ────────────────────────────────────────────────────────────

export function generateApiKey(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  const extra = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `ra_${uuid}${extra}`;
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyApiKey(key: string): Promise<AgentRecord | null> {
  if (!key || !key.startsWith("ra_")) return null;

  const hashed = await hashApiKey(key);
  const agents = await store.getAll();
  return agents.find((a) => a.hashed_key === hashed) ?? null;
}

// ─── Agent CRUD ────────────────────────────────────────────────────────────────

export interface RegisterAgentInput {
  name: string;
  description: string;
  capabilities: string[];
  callback_url?: string;
}

export async function registerAgent(
  input: RegisterAgentInput,
): Promise<{ agent: AgentRecord; api_key: string }> {
  const rawKey = generateApiKey();
  const hashed = await hashApiKey(rawKey);
  const agentId = crypto.randomUUID();

  const agent: AgentRecord = {
    id: agentId,
    agent_id: agentId,
    name: input.name.trim(),
    description: input.description.trim(),
    capabilities: input.capabilities,
    callback_url: input.callback_url,
    hashed_key: hashed,
    created_at: new Date().toISOString(),
    scopes: deriveScopes(input.capabilities),
  };

  await store.create(agent);
  return { agent, api_key: rawKey };
}

export async function getAgentById(agentId: string): Promise<AgentRecord | null> {
  const agents = await store.getAll();
  return agents.find((a) => a.agent_id === agentId) ?? null;
}

export async function getAllAgents(): Promise<AgentRecord[]> {
  return store.getAll();
}

function deriveScopes(capabilities: string[]): string[] {
  const base = ["read:news", "read:models", "read:reports"];
  const extras: string[] = [];

  for (const cap of capabilities) {
    const c = cap.toLowerCase();
    if (c.includes("write") || c.includes("task") || c.includes("workflow")) {
      extras.push("write:tasks");
    }
    if (c.includes("report") || c.includes("paid")) {
      extras.push("read:reports:full");
    }
    if (c.includes("admin")) {
      extras.push("admin");
    }
  }

  return [...new Set([...base, ...extras])];
}
