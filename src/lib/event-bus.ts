/**
 * Simple in-memory event bus for SSE streams.
 * Supports subscribe/publish/unsubscribe for typed events.
 */

export type EventType =
  | "news.published"
  | "report.released"
  | "model.updated"
  | "task.created"
  | "task.status_changed"
  | "space.entry_added";

export interface BusEvent {
  id: string;
  type: EventType;
  data: Record<string, unknown>;
  timestamp: string;
}

export type EventHandler = (event: BusEvent) => void;

class EventBus {
  private subscribers: Map<string, { types: EventType[] | null; handler: EventHandler }> = new Map();

  subscribe(id: string, types: EventType[] | null, handler: EventHandler): () => void {
    this.subscribers.set(id, { types, handler });
    return () => this.unsubscribe(id);
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  publish(type: EventType, data: Record<string, unknown>): void {
    const event: BusEvent = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    for (const [, sub] of this.subscribers) {
      if (sub.types === null || sub.types.includes(type)) {
        try {
          sub.handler(event);
        } catch {
          // Silently ignore handler errors
        }
      }
    }
  }

  subscriberCount(): number {
    return this.subscribers.size;
  }
}

// Singleton event bus — shared across the Node.js process
// Note: this is in-memory only; events are not persisted across restarts
export const eventBus = new EventBus();

export const VALID_EVENT_TYPES: EventType[] = [
  "news.published",
  "report.released",
  "model.updated",
  "task.created",
  "task.status_changed",
  "space.entry_added",
];
