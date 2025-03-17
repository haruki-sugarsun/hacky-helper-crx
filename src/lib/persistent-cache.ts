// Persistent cache implementation that extends LRU cache functionality
// but persists data to Chrome's storage.local API

import LRU from "./lru-cache";

// Define a prefix for storage keys to avoid conflicts
const STORAGE_PREFIX = "hacky_helper_cache_";

// Interface for cache metadata
interface CacheMetadata {
  keys: string[]; // Ordered list of keys (most recently used last)
  maxSize: number;
}

/**
 * A persistent cache that extends LRU cache functionality
 * but persists data to Chrome's storage.local API
 */
export class PersistentCache<T> {
  private readonly cacheId: string;
  private readonly maxSize: number;
  private cache: LRU<T>;
  private cacheKeys: Set<string> = new Set<string>(); // Track keys separately
  private loaded: boolean = false;
  private loading: Promise<void> | null = null;

  /**
   * Create a new persistent cache
   * @param cacheId Unique identifier for this cache
   * @param maxSize Maximum number of items to store in the cache
   */
  constructor(cacheId: string, maxSize: number) {
    this.cacheId = cacheId;
    this.maxSize = maxSize;
    this.cache = new LRU<T>(maxSize);

    // Load cache data from storage when created
    this.loading = this.loadFromStorage();
  }

  /**
   * Get the storage key for a cache item
   * @param key The cache item key
   * @returns The storage key
   */
  private getStorageKey(key: string): string {
    return `${STORAGE_PREFIX}${this.cacheId}_item_${key}`;
  }

  /**
   * Get the storage key for cache metadata
   * @returns The metadata storage key
   */
  private getMetadataKey(): string {
    return `${STORAGE_PREFIX}${this.cacheId}_metadata`;
  }

  /**
   * Load cache data from storage
   */
  private async loadFromStorage(): Promise<void> {
    if (this.loaded) return;

    try {
      // Check if chrome.storage is available (in extension context)
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        // Load metadata
        const metadataKey = this.getMetadataKey();
        const metadataResult = await chrome.storage.local.get(metadataKey);
        const metadata: CacheMetadata = metadataResult[metadataKey]
          ? JSON.parse(metadataResult[metadataKey])
          : { keys: [], maxSize: this.maxSize };

        // Load each item in reverse order (least recently used first)
        // This ensures the LRU order is maintained
        for (const key of metadata.keys) {
          const storageKey = this.getStorageKey(key);
          const result = await chrome.storage.local.get(storageKey);
          if (result[storageKey]) {
            const value = JSON.parse(result[storageKey]);
            this.cache.set(key, value);
            this.cacheKeys.add(key);
          }
        }

        console.log(
          `Loaded ${metadata.keys.length} items from persistent cache ${this.cacheId}`,
        );
      }
    } catch (error) {
      console.error("Failed to load cache from storage:", error);
    }

    this.loaded = true;
    this.loading = null;
  }

  /**
   * Save cache metadata to storage
   */
  private async saveMetadata(): Promise<void> {
    if (!this.loaded) await this.ensureLoaded();

    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        // Get all keys from our tracked set
        const keys: string[] = Array.from(this.cacheKeys);

        const metadata: CacheMetadata = {
          keys,
          maxSize: this.maxSize,
        };

        const metadataKey = this.getMetadataKey();
        await chrome.storage.local.set({
          [metadataKey]: JSON.stringify(metadata),
        });
      }
    } catch (error) {
      console.error("Failed to save cache metadata:", error);
    }
  }

  /**
   * Ensure the cache is loaded before performing operations
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loading) {
      await this.loading;
    } else if (!this.loaded) {
      this.loading = this.loadFromStorage();
      await this.loading;
    }
  }

  /**
   * Add or update an item in the cache
   * @param key The item key
   * @param value The item value
   */
  async set(key: string, value: T): Promise<void> {
    await this.ensureLoaded();

    // Update in-memory cache
    this.cache.set(key, value);
    this.cacheKeys.add(key);

    try {
      // Save to storage if available
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        const storageKey = this.getStorageKey(key);
        await chrome.storage.local.set({ [storageKey]: JSON.stringify(value) });
        await this.saveMetadata();
      }
    } catch (error) {
      console.error("Failed to save cache item:", error);
    }
  }

  /**
   * Get an item from the cache
   * @param key The item key
   * @returns The item value or undefined if not found
   */
  async get(key: string): Promise<T | undefined> {
    await this.ensureLoaded();
    return this.cache.get(key);
  }

  /**
   * Remove an item from the cache
   * @param key The item key
   */
  async delete(key: string): Promise<void> {
    await this.ensureLoaded();

    // Remove from in-memory cache
    this.cache.delete(key);
    this.cacheKeys.delete(key);

    try {
      // Remove from storage if available
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        const storageKey = this.getStorageKey(key);
        await chrome.storage.local.remove(storageKey);
        await this.saveMetadata();
      }
    } catch (error) {
      console.error("Failed to delete cache item:", error);
    }
  }

  /**
   * Clear all items from the cache
   */
  async clear(): Promise<void> {
    await this.ensureLoaded();

    // Clear in-memory cache
    this.cache.clear();
    this.cacheKeys.clear();

    try {
      // Clear from storage if available
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        const metadataKey = this.getMetadataKey();
        const metadataResult = await chrome.storage.local.get(metadataKey);
        const metadata: CacheMetadata = metadataResult[metadataKey]
          ? JSON.parse(metadataResult[metadataKey])
          : { keys: [], maxSize: this.maxSize };

        // Remove each item
        for (const key of metadata.keys) {
          const storageKey = this.getStorageKey(key);
          await chrome.storage.local.remove(storageKey);
        }

        // Clear metadata
        await chrome.storage.local.remove(metadataKey);
      }
    } catch (error) {
      console.error("Failed to clear cache:", error);
    }
  }

  /**
   * Get the number of items in the cache
   * @returns The number of items
   */
  async size(): Promise<number> {
    await this.ensureLoaded();
    return this.cache.size();
  }

  /**
   * Get the maximum capacity of the cache
   * @returns The maximum capacity
   */
  capacity(): number {
    return this.maxSize;
  }

  /**
   * Get all keys in the cache
   * @returns Array of keys
   */
  async keys(): Promise<string[]> {
    await this.ensureLoaded();
    return Array.from(this.cacheKeys);
  }
}
