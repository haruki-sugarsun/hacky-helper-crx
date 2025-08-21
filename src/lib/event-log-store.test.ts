import { describe, it, expect, vi, beforeEach, assert } from "vitest";
import EventLogStore from "./event-log-store";

// Simple in-memory mock for chrome.storage.local
let storageData: Record<string, any> = {};

beforeEach(() => {
  vi.clearAllMocks();
  storageData = {};
  // Mock chrome.storage.local.get/set
  (global as any).chrome.storage.local.get = vi
    .fn()
    .mockImplementation((keys: any, callback?: any) => {
      if (Array.isArray(keys)) {
        const res: Record<string, any> = {};
        keys.forEach((k) => (res[k] = storageData[k]));
        if (callback) callback(res);
        return Promise.resolve(res);
      }
      const res = { [keys]: storageData[keys] };
      if (callback) callback(res);
      return Promise.resolve(res);
    });

  (global as any).chrome.storage.local.set = vi
    .fn()
    .mockImplementation((items: Record<string, any>, callback?: any) => {
      Object.assign(storageData, items);
      if (callback) callback();
      return Promise.resolve();
    });

  (global as any).chrome.storage.local.clear = vi
    .fn()
    .mockImplementation((callback?: any) => {
      storageData = {};
      if (callback) callback();
      return Promise.resolve();
    });
});

describe("EventLogStore", () => {
  it("append() should add entries and return normalized entry", () => {
    const store = new EventLogStore({ maxEntries: 5 });
    const e = store.append({ type: "test", message: "hello" }, "unit-test");
    expect(e.id).toBeDefined();
    expect(e.type).toBe("test");
    expect(e.message).toBe("hello");
    expect(e.source).toBe("unit-test");
  });

  it("query() should filter by type and pagination", () => {
    const store = new EventLogStore({ maxEntries: 100 });
    for (let i = 0; i < 10; i++) {
      store.append({ type: i % 2 === 0 ? "even" : "odd", message: String(i) });
    }
    const res = store.query({ type: ["even"], limit: 3, offset: 1 });
    expect(res.total).toBeGreaterThanOrEqual(5);
    expect(res.entries.length).toBe(3);
    expect(res.entries.every((x) => x.type === "even")).toBe(true);
  });

  it("clear() should remove entries before a timestamp or all when not provided", async () => {
    const store = new EventLogStore({ maxEntries: 100 });
    const a = store.append({ type: "t", message: "a" });
    // wait small ms to ensure timestamp gap
    await new Promise((r) => setTimeout(r, 5));
    const b = store.append({ type: "t", message: "b" });
    const beforeTs = b.ts;

    await store.clear(beforeTs);
    const res = store.query({});
    expect(res.entries.every((x) => x.ts >= beforeTs)).toBe(true);

    // clear all
    store.append({ type: "t", message: "c" });
    await store.clear();
    const res2 = store.query({});
    expect(res2.total).toBe(0);
  });

  it("flushToStorage() and loadFromStorage() should persist and restore buffer", async () => {
    const store = new EventLogStore({ maxEntries: 100 });
    store.append({ type: "persist", message: "one" });
    store.append({ type: "persist", message: "two" });
    await store.flushToStorage();

    // New instance should load from storage
    const store2 = new EventLogStore({ maxEntries: 100 });
    await store2.loadFromStorage();
    const res = store2.query({ type: ["persist"] });
    expect(res.total).toBe(2);
    expect(res.entries.map((e) => e.message).sort()).toEqual(["one", "two"]);
  });
});
