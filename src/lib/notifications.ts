/**
 * Notification System
 * In-app notifications for agents.
 * Round 24
 */

import path from "node:path";
import { JsonFileStore } from "./data-store";
import { eventBus } from "./event-bus";

const NOTIFICATIONS_FILE = path.join(process.cwd(), "data/notifications/notifications.json");
const store = new JsonFileStore<Notification>(NOTIFICATIONS_FILE);

export type NotificationType =
  | "task_match"
  | "bid_received"
  | "delivery_submitted"
  | "review_received"
  | "contract_proposed"
  | "space_invited"
  | "challenge_available"
  | "credits_low";

export interface Notification {
  id: string;
  agent_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function createNotification(
  input: Omit<Notification, "id" | "read" | "created_at">,
): Promise<Notification> {
  const notification: Notification = {
    id: crypto.randomUUID(),
    read: false,
    created_at: new Date().toISOString(),
    ...input,
  };
  const saved = await store.create(notification);
  // Publish to event bus so SSE subscribers can receive notification.created events
  eventBus.publish("notification.created", {
    notification_id: saved.id,
    agent_id: saved.agent_id,
    type: saved.type,
    title: saved.title,
    message: saved.message,
    data: saved.data ?? null,
  });
  return saved;
}

export interface GetNotificationsFilter {
  agent_id: string;
  read?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}

export async function getNotifications(filter: GetNotificationsFilter): Promise<{
  notifications: Notification[];
  unread_count: number;
  total: number;
}> {
  let items = await store.query((n) => n.agent_id === filter.agent_id);

  const unread_count = items.filter((n) => !n.read).length;
  const total = items.length;

  if (filter.read !== undefined) {
    items = items.filter((n) => n.read === filter.read);
  }
  if (filter.type) {
    items = items.filter((n) => n.type === filter.type);
  }

  // Newest first
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const limit = Math.min(filter.limit ?? 20, 100);
  const offset = filter.offset ?? 0;
  const page = items.slice(offset, offset + limit);

  return { notifications: page, unread_count, total };
}

export async function markAsRead(notificationId: string, agentId: string): Promise<Notification | null> {
  return store.transaction(async (items) => {
    const idx = items.findIndex((n) => n.id === notificationId && n.agent_id === agentId);
    if (idx === -1) return { items, result: null };
    items[idx] = { ...items[idx], read: true };
    return { items, result: items[idx] };
  });
}

export async function markAllAsRead(agentId: string): Promise<number> {
  return store.transaction(async (items) => {
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].agent_id === agentId && !items[i].read) {
        items[i] = { ...items[i], read: true };
        count++;
      }
    }
    return { items, result: count };
  });
}

/**
 * Fire-and-forget notification creation (doesn't block callers).
 */
export function notifyAgent(input: Omit<Notification, "id" | "read" | "created_at">): void {
  createNotification(input).catch(() => {});
}
