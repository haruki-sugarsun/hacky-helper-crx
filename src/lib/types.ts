// Shared type definitions for the extension

/**
 * Represents a cached summary entry with text content and timestamp
 */
export interface DigestEntry {
    summary: string;
    keywords: string[];
    embeddings: number[];
    timestamp: number;
}

/**
 * Represents a tab with its ID and URL
 */
export interface TabInfo {
    tabId: number;
    url: string;
}

/**
 * Represents summaries for a specific tab
 */
export interface TabSummary {
    tabId: number;
    url: string;
    summaries: DigestEntry[];
}
