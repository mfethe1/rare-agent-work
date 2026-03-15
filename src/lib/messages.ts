/**
 * Agent-to-Agent Messaging System
 * Round 28
 */

import path from "node:path";
import { JsonFileStore } from "./data-store";

const MESSAGES_FILE = path.join(process.cwd(), "data/messages/messages.json");
const store = new JsonFileStore<Message>(MESSAGES_FILE);

export interface Message {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  subject: string;
  body: string;
  read: boolean;
  thread_id?: string;
  reply_to?: string;
  created_at: string;
}

export interface SendMessageInput {
  from_agent_id: string;
  to_agent_id: string;
  subject: string;
  body: string;
  thread_id?: string;
  reply_to?: string;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function sendMessage(input: SendMessageInput): Promise<Message> {
  const msg: Message = {
    id: crypto.randomUUID(),
    from_agent_id: input.from_agent_id,
    to_agent_id: input.to_agent_id,
    subject: input.subject.trim(),
    body: input.body.trim(),
    read: false,
    thread_id: input.thread_id ?? crypto.randomUUID(), // auto-create thread_id for new messages
    reply_to: input.reply_to,
    created_at: new Date().toISOString(),
  };
  return store.create(msg);
}

export interface ListMessagesFilter {
  agent_id: string;
  read?: boolean;
  from_agent?: string;
  limit?: number;
  offset?: number;
}

export async function listInbox(filter: ListMessagesFilter): Promise<{
  messages: Message[];
  total: number;
  unread_count: number;
}> {
  let items = await store.query((m) => m.to_agent_id === filter.agent_id);

  const unread_count = items.filter((m) => !m.read).length;
  const total = items.length;

  if (filter.read !== undefined) {
    items = items.filter((m) => m.read === filter.read);
  }
  if (filter.from_agent) {
    items = items.filter((m) => m.from_agent_id === filter.from_agent);
  }

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const limit = Math.min(filter.limit ?? 20, 100);
  const offset = filter.offset ?? 0;
  const page = items.slice(offset, offset + limit);

  return { messages: page, total, unread_count };
}

export async function getMessageById(id: string): Promise<Message | null> {
  const all = await store.getAll();
  return all.find((m) => m.id === id) ?? null;
}

export async function markMessageRead(id: string, agentId: string): Promise<Message | null> {
  return store.transaction(async (items) => {
    const idx = items.findIndex((m) => m.id === id && (m.to_agent_id === agentId || m.from_agent_id === agentId));
    if (idx === -1) return { items, result: null };
    items[idx] = { ...items[idx], read: true };
    return { items, result: items[idx] };
  });
}

export async function getThread(threadId: string): Promise<Message[]> {
  const items = await store.query((m) => m.thread_id === threadId);
  return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
