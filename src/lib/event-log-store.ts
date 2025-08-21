import { EventLogEntry } from "../messages/service-worker-logging-messages";

// Minimal UUIDv4 generator to avoid adding a dependency
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// TODO: Have a common place for all STORAGE_KEYs.
const STORAGE_KEY = "EVENT_LOG_STORE";

export interface EventLogStoreConfig {
  maxEntries?: number;
  retentionMs?: number;
}

export class EventLogStore {
  private buffer: EventLogEntry[] = [];
  private maxEntries: number;
  private retentionMs: number;
  private isDirty = false;
  private flushTimer: number | null = null;

  constructor(config: EventLogStoreConfig = {}) {
    this.maxEntries = config.maxEntries || 10000;
    this.retentionMs = config.retentionMs || 14 * 24 * 60 * 60 * 1000; // 14 days
  }

  normalize(entry: Partial<EventLogEntry>, source?: string): EventLogEntry {
    const now = Date.now();
    return {
      id: entry.id || uuidv4(),
      ts: entry.ts || now,
      level: (entry.level as any) || "info",
      type: entry.type || "unknown",
      message: entry.message || "",
      context: entry.context || {},
      source: entry.source || source || "unknown",
    } as EventLogEntry;
  }

  append(entry: Partial<EventLogEntry>, source?: string) {
    const e = this.normalize(entry, source);
    this.buffer.push(e);
    this.isDirty = true;
    this.trimIfNeeded();
    this.scheduleFlush();
    return e;
  }

  private trimIfNeeded() {
    // Evict oldest if beyond maxEntries
    while (this.buffer.length > this.maxEntries) {
      this.buffer.shift();
    }
    // Trim by retention
    const cutoff = Date.now() - this.retentionMs;
    this.buffer = this.buffer.filter((e) => e.ts >= cutoff);
  }

  query(filters: {
    level?: string[];
    type?: string[];
    fromTs?: number;
    toTs?: number;
    limit?: number;
    offset?: number;
  }) {
    let res = [...this.buffer];
    if (filters.level) {
      const levels = new Set(filters.level);
      res = res.filter((e) => levels.has(e.level));
    }
    if (filters.type) {
      const types = new Set(filters.type);
      res = res.filter((e) => types.has(e.type));
    }
    if (filters.fromTs) {
      res = res.filter((e) => e.ts >= filters.fromTs!);
    }
    if (filters.toTs) {
      res = res.filter((e) => e.ts <= filters.toTs!);
    }
    const total = res.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    res = res.slice(offset, offset + limit);
    return { entries: res, total };
  }

  async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const raw = result[STORAGE_KEY];
      if (raw && Array.isArray(raw)) {
        this.buffer = raw as EventLogEntry[];
        this.trimIfNeeded();
      }
    } catch (error) {
      console.error("EventLogStore: failed to load from storage:", error);
    }
  }

  async flushToStorage(): Promise<void> {
    if (!this.isDirty) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: this.buffer });
      this.isDirty = false;
    } catch (error) {
      console.error("EventLogStore: failed to flush to storage:", error);
      // On error (quota), try to evict oldest and retry once
      if (this.buffer.length > 0) {
        this.buffer.shift();
        try {
          await chrome.storage.local.set({ [STORAGE_KEY]: this.buffer });
        } catch (e) {
          console.error("EventLogStore: retry flush failed", e);
        }
      }
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    // Flush after 500ms
    this.flushTimer = setTimeout(async () => {
      this.flushTimer = null;
      await this.flushToStorage();
    }, 500) as unknown as number;
  }

  async clear(beforeTs?: number) {
    if (beforeTs) {
      this.buffer = this.buffer.filter((e) => e.ts > beforeTs);
    } else {
      this.buffer = [];
    }
    this.isDirty = true;
    await this.flushToStorage();
  }
}

export default EventLogStore;
