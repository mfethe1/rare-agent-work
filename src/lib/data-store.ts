/**
 * DataStore abstraction for rareagent.work
 * Provides async JSON file storage with file-level locking to prevent race conditions.
 */

import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

// ─── Abstract Interface ────────────────────────────────────────────────────────

export interface DataStore<T extends { id: string }> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(item: T): Promise<T>;
  update(id: string, partial: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  query(filter: (item: T) => boolean): Promise<T[]>;
}

// ─── File-level lock map ───────────────────────────────────────────────────────

const locks = new Map<string, Promise<void>>();

async function withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any in-progress operation on this file
  const existing = locks.get(filePath);
  if (existing) {
    await existing.catch(() => {});
  }

  let resolve!: () => void;
  const lockPromise = new Promise<void>((res) => { resolve = res; });
  locks.set(filePath, lockPromise);

  try {
    return await fn();
  } finally {
    locks.delete(filePath);
    resolve();
  }
}

// ─── JsonFileStore<T> ─────────────────────────────────────────────────────────

/**
 * A JSON file-backed DataStore implementation.
 * T must have an `id: string` field.
 * File stores a JSON array of T.
 */
export class JsonFileStore<T extends { id: string }> implements DataStore<T> {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    // Ensure directory exists synchronously at construction time
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private async readAll(): Promise<T[]> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as T[];
    } catch {
      return [];
    }
  }

  private async writeAll(items: T[]): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await fs.writeFile(this.filePath, JSON.stringify(items, null, 2), "utf-8");
  }

  async getAll(): Promise<T[]> {
    return withLock(this.filePath, () => this.readAll());
  }

  async getById(id: string): Promise<T | null> {
    const items = await this.getAll();
    return items.find((i) => i.id === id) ?? null;
  }

  async create(item: T): Promise<T> {
    return withLock(this.filePath, async () => {
      const items = await this.readAll();
      items.push(item);
      await this.writeAll(items);
      return item;
    });
  }

  async update(id: string, partial: Partial<T>): Promise<T | null> {
    return withLock(this.filePath, async () => {
      const items = await this.readAll();
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return null;
      items[idx] = { ...items[idx], ...partial };
      await this.writeAll(items);
      return items[idx];
    });
  }

  async delete(id: string): Promise<boolean> {
    return withLock(this.filePath, async () => {
      const items = await this.readAll();
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return false;
      items.splice(idx, 1);
      await this.writeAll(items);
      return true;
    });
  }

  async query(filter: (item: T) => boolean): Promise<T[]> {
    const items = await this.getAll();
    return items.filter(filter);
  }

  /**
   * Atomic read-modify-write: runs a transform function under the file lock.
   * Use this for operations that need to read and then write atomically.
   */
  async transaction<R>(fn: (items: T[]) => Promise<{ items: T[]; result: R }>): Promise<R> {
    return withLock(this.filePath, async () => {
      const items = await this.readAll();
      const { items: updated, result } = await fn(items);
      await this.writeAll(updated);
      return result;
    });
  }
}

// ─── Dictionary-based Store (for wallet-style records) ────────────────────────

/**
 * A JSON file-backed store for Record<string, T> (dictionary keyed by agent ID, etc.)
 * T does NOT need an `id` field.
 */
export class JsonDictStore<T> {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private async readAll(): Promise<Record<string, T>> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as Record<string, T>;
    } catch {
      return {};
    }
  }

  private async writeAll(data: Record<string, T>): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async getAll(): Promise<Record<string, T>> {
    return withLock(this.filePath, () => this.readAll());
  }

  async get(key: string): Promise<T | null> {
    const data = await this.getAll();
    return data[key] ?? null;
  }

  async set(key: string, value: T): Promise<void> {
    return withLock(this.filePath, async () => {
      const data = await this.readAll();
      data[key] = value;
      await this.writeAll(data);
    });
  }

  async transaction<R>(fn: (data: Record<string, T>) => Promise<{ data: Record<string, T>; result: R }>): Promise<R> {
    return withLock(this.filePath, async () => {
      const data = await this.readAll();
      const { data: updated, result } = await fn(data);
      await this.writeAll(updated);
      return result;
    });
  }
}
