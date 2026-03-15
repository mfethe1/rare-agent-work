import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const WEBHOOKS_FILE = path.join(process.cwd(), "data/webhooks/webhooks.json");

export type WebhookEvent =
  | "news.published"
  | "report.released"
  | "model.updated"
  | "task.created"
  | "task.status_changed";

export const VALID_WEBHOOK_EVENTS: WebhookEvent[] = [
  "news.published",
  "report.released",
  "model.updated",
  "task.created",
  "task.status_changed",
];

export interface WebhookRecord {
  id: string;
  agent_id: string;
  url: string;
  events: WebhookEvent[];
  secret: string; // HMAC secret (stored hashed or as-is for delivery signing)
  active: boolean;
  created_at: string;
  updated_at: string;
  delivery_count: number;
  last_delivery?: string;
}

// ─── File helpers ──────────────────────────────────────────────────────────────

function readWebhooks(): WebhookRecord[] {
  try {
    const raw = fs.readFileSync(WEBHOOKS_FILE, "utf-8");
    return JSON.parse(raw) as WebhookRecord[];
  } catch {
    return [];
  }
}

function writeWebhooks(webhooks: WebhookRecord[]): void {
  const dir = path.dirname(WEBHOOKS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), "utf-8");
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// ─── HMAC signing ──────────────────────────────────────────────────────────────

/**
 * Signs a webhook payload with HMAC-SHA256.
 * Returns a hex string signature.
 */
export function signPayload(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface RegisterWebhookInput {
  agent_id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
}

export function registerWebhook(input: RegisterWebhookInput): WebhookRecord {
  if (!isValidUrl(input.url)) {
    throw new Error("Invalid webhook URL");
  }

  const invalidEvents = input.events.filter(
    (e) => !VALID_WEBHOOK_EVENTS.includes(e),
  );
  if (invalidEvents.length > 0) {
    throw new Error(`Invalid events: ${invalidEvents.join(", ")}`);
  }
  if (input.events.length === 0) {
    throw new Error("At least one event must be specified");
  }

  const webhooks = readWebhooks();

  // Check max 10 webhooks per agent
  const agentWebhooks = webhooks.filter((w) => w.agent_id === input.agent_id && w.active);
  if (agentWebhooks.length >= 10) {
    throw new Error("Maximum of 10 active webhooks per agent");
  }

  const now = new Date().toISOString();
  const webhook: WebhookRecord = {
    id: crypto.randomUUID(),
    agent_id: input.agent_id,
    url: input.url,
    events: input.events,
    secret: input.secret ?? crypto.randomBytes(32).toString("hex"),
    active: true,
    created_at: now,
    updated_at: now,
    delivery_count: 0,
  };

  webhooks.push(webhook);
  writeWebhooks(webhooks);
  return webhook;
}

export function getAgentWebhooks(agentId: string): WebhookRecord[] {
  const webhooks = readWebhooks();
  return webhooks.filter((w) => w.agent_id === agentId && w.active);
}

export function deleteWebhook(id: string, agentId: string): boolean {
  const webhooks = readWebhooks();
  const idx = webhooks.findIndex((w) => w.id === id && w.agent_id === agentId);
  if (idx === -1) return false;

  webhooks[idx].active = false;
  webhooks[idx].updated_at = new Date().toISOString();
  writeWebhooks(webhooks);
  return true;
}

export function getWebhookById(id: string): WebhookRecord | null {
  const webhooks = readWebhooks();
  return webhooks.find((w) => w.id === id) ?? null;
}

/**
 * Dispatch a webhook event to all registered subscribers.
 * This is a fire-and-forget async function suitable for background dispatch.
 */
export async function dispatchWebhookEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const webhooks = readWebhooks();
  const subscribers = webhooks.filter((w) => w.active && w.events.includes(event));

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    payload,
  });

  for (const webhook of subscribers) {
    const signature = signPayload(webhook.secret, body);
    try {
      await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RareAgent-Event": event,
          "X-RareAgent-Signature": `sha256=${signature}`,
          "X-RareAgent-Delivery": crypto.randomUUID(),
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      webhook.delivery_count += 1;
      webhook.last_delivery = new Date().toISOString();
    } catch {
      // Silently continue — in production we'd retry + track failures
    }
  }

  // Update delivery counts
  writeWebhooks(webhooks);
}
