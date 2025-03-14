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

// --- Named Session Types ---

/**
 * Represents a Named Session, which associates a browser window with a set of tabs.
 * A window remains "unnamed" unless explicitly named by the user.
 */
export interface NamedSession {
  /** A unique identifier for the session (UUID) */
  id: string;
  /** The user-defined name of the session; can be null if the window is unnamed */
  name: string | null;
  /** The associated Chrome window ID; null if not assigned or during restoration */
  windowId: number | null;
  /** Timestamp when the session was created */
  createdAt: number;
  /** Timestamp when the session was last updated */
  updatedAt: number;
  /** List of tabs associated with the session */
  tabs: NamedSessionTab[];
}

/**
 * Represents an individual tab within a Named Session.
 */
export interface NamedSessionTab {
  /** The unique identifier of the tab; may be null if not assigned during restoration */
  tabId: number | null;
  /** The title of the tab */
  title: string;
  /** The URL of the tab */
  url: string;
}

/**
 * Represents a bookmark folder structure for Named Sessions
 */
export interface BookmarkSessionFolder {
  /** The bookmark folder ID */
  id: string;
  /** The name of the session */
  name: string;
  /** The session ID associated with this folder */
  sessionId: string;
  /** The opened pages folder ID */
  openedPagesId: string;
  /** The saved pages folder ID */
  savedPagesId: string;
}

/**
 * Represents a saved bookmark
 */
export interface SavedBookmark {
  /** The bookmark ID */
  id: string;
  /** The title of the bookmark */
  title: string;
  /** The URL of the bookmark */
  url: string;
  /** The session ID this bookmark belongs to */
  sessionId: string;
  /** Optional metadata encoded in JSON */
  metadata?: {
    /** When the bookmark was saved */
    savedAt?: number;
    /** Custom tags or categories */
    tags?: string[];
    /** Any other custom metadata */
    [key: string]: any;
  };
}
