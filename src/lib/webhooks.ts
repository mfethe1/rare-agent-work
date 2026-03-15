import path from "node:path";
import crypto from "node:crypto";
import { JsonFileStore } from "./data-store";
import { eventBus, type EventType } from "./event-bus";

const WEBHOOKS_FILE = path.join(process.cwd(), "data/webhooks/webhooks.json");
const store = new JsonFileStore<WebhookRecord>(WEBHOOKS_FILE);

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
  secret: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  delivery_count: number;
  last_delivery?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

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

export async function registerWebhook(input: RegisterWebhookInput): Promise<WebhookRecord> {
  if (!isValidUrl(input.url)) {
    throw new Error("Invalid webhook URL");
  }

  const invalidEvents = input.events.filter((e) => !VALID_WEBHOOK_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    throw new Error(`Invalid events: ${invalidEvents.join(", ")}`);
  }
  if (input.events.length === 0) {
    throw new Error("At least one event must be specified");
  }

  return store.transaction(async (webhooks) => {
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
    return { items: webhooks, result: webhook };
  });
}

export async function getAgentWebhooks(agentId: string): Promise<WebhookRecord[]> {
  return store.query((w) => w.agent_id === agentId && w.active);
}

export async function deleteWebhook(id: string, agentId: string): Promise<boolean> {
  return store.transaction(async (webhooks) => {
    const idx = webhooks.findIndex((w) => w.id === id && w.agent_id === agentId);
    if (idx === -1) return { items: webhooks, result: false };

    webhooks[idx].active = false;
    webhooks[idx].updated_at = new Date().toISOString();
    return { items: webhooks, result: true };
  });
}

export async function getWebhookById(id: string): Promise<WebhookRecord | null> {
  return store.getById(id);
}

export async function dispatchWebhookEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const webhooks = await store.getAll();
  const subscribers = webhooks.filter((w) => w.active && w.events.includes(event));

  // Publish to in-memory event bus for SSE subscribers
  eventBus.publish(event as EventType, payload);

  if (subscribers.length === 0) return;

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
      // Update delivery count
      await store.update(webhook.id, {
        delivery_count: webhook.delivery_count + 1,
        last_delivery: new Date().toISOString(),
      });
    } catch {
      // Silently continue — in production we'd retry + track failures
    }
  }
}
