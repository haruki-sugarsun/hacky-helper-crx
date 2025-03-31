import { DigestEntry } from "../lib/types";
import { PersistentCache } from "../lib/persistent-cache";

// TODO: Encapsulate these in a class.

// Constants for cache configuration
export const SUMMARY_CACHE_SIZE = 5; // Store the latest 5 summaries per tab+URL

// Cache for storing summaries
// Cache to store the latest N summary results for each tabID and URL combination
// The key is a combination of tabID and URL, and the value is an array of summary results with timestamps
export const digestCache = new PersistentCache<DigestEntry[]>(
  "tab_digest",
  100,
); // Caches up to 100 unique tab+URL entries

/**
 * Retrieves the cached summaries for a specific URL
 * @param url The URL of the page
 * @returns An array of cached summary entries, or null if none exist
 */
export async function getCachedSummaries(
  url: string,
): Promise<DigestEntry[] | null> {
  const cacheKey = url;
  const cachedEntries = await digestCache.get(cacheKey);

  if (cachedEntries && cachedEntries.length > 0) {
    return cachedEntries;
  }
  return null;
}

/**
 * Updates the cache with a new digest entry for the given URL
 * @param url The URL of the page
 * @param digestEntry The digest entry to add to the cache
 */
export async function updateCache(url: string, digestEntry: DigestEntry) {
  const existingEntries = (await digestCache.get(url)) || [];
  existingEntries.unshift(digestEntry);

  if (existingEntries.length > SUMMARY_CACHE_SIZE) {
    existingEntries.length = SUMMARY_CACHE_SIZE;
  }

  await digestCache.set(url, existingEntries);
  console.log(
    `Cached summary for ${url}. Cache now has ${existingEntries.length} entries.`,
  );
}
