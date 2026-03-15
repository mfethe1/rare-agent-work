import fs from "node:fs";
import path from "node:path";

export interface AgentRecord {
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

// ─── File helpers ──────────────────────────────────────────────────────────────

function readAgents(): AgentRecord[] {
  try {
    const raw = fs.readFileSync(AGENTS_FILE, "utf-8");
    return JSON.parse(raw) as AgentRecord[];
  } catch {
    return [];
  }
}

function writeAgents(agents: AgentRecord[]): void {
  const dir = path.dirname(AGENTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), "utf-8");
}

// ─── Key generation ────────────────────────────────────────────────────────────

/**
 * Generates a new `ra_` prefixed API key.
 * Format: ra_<random-uuid-without-hyphens><random-suffix>
 */
export function generateApiKey(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  // Add extra entropy via a second random segment
  const extra = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `ra_${uuid}${extra}`;
}

/**
 * SHA-256 hashes an API key for secure storage.
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifies a raw API key against the stored hashed keys.
 * Returns the matching AgentRecord or null.
 */
export async function verifyApiKey(key: string): Promise<AgentRecord | null> {
  if (!key || !key.startsWith("ra_")) return null;

  const hashed = await hashApiKey(key);
  const agents = readAgents();
  return agents.find((a) => a.hashed_key === hashed) ?? null;
}

// ─── Agent CRUD ────────────────────────────────────────────────────────────────

export interface RegisterAgentInput {
  name: string;
  description: string;
  capabilities: string[];
  callback_url?: string;
}

/**
 * Registers a new agent. Returns the agent record + the raw API key.
 * The raw key is returned only once — it is NOT stored in plaintext.
 */
export async function registerAgent(
  input: RegisterAgentInput,
): Promise<{ agent: AgentRecord; api_key: string }> {
  const rawKey = generateApiKey();
  const hashed = await hashApiKey(rawKey);

  const agent: AgentRecord = {
    agent_id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    capabilities: input.capabilities,
    callback_url: input.callback_url,
    hashed_key: hashed,
    created_at: new Date().toISOString(),
    scopes: deriveScopes(input.capabilities),
  };

  const agents = readAgents();
  agents.push(agent);
  writeAgents(agents);

  return { agent, api_key: rawKey };
}

/**
 * Derives OAuth-style scopes from declared capabilities.
 */
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
