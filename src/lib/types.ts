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
  /** The user-defined name of the session */
  name: string;
  /** The associated Chrome window ID; undefined if not assigned, during restoration, or if the session is closed */
  windowId: number | undefined;
  /** Timestamp when the session was created */
  createdAt: number;
  /** Timestamp when the session was last updated. Affected by session renaming or Open Tabs update. */
  updatedAt: number;
  // TODO: We also need lastSynced or syncedAt to represent when we last try syncing with the backend.
  // We might need to consider which of updatedAt or syncedAt should stored in the backend.
}

/**
 * Represents a closed Named Session that is stored in bookmarks but not currently open in a window.
 * This is a subset of the information stored in BookmarkSessionFolder.
 * TODO: Merge this type into NamedSession, or consider introducing sub-typing of Active/Closed Named Sessions.
 */
export interface ClosedNamedSession {
  /** A unique identifier for the session (UUID) */
  id: string;
  /** The user-defined name of the session */
  name: string;
  /** Timestamp when the session was created */
  createdAt: number;
  /** Timestamp when the session was last updated (if available) */
  updatedAt: number;
  /** List of tabs associated with the session */
  // TODO: Refactor to extract this out from Session data types. We raraly uses this field.
  tabs: NamedSessionTab[];
}

/**
 * Represents an individual tab within a Named Session.
 */
export interface NamedSessionTab {
  /** The unique identifier of the tab; may be null if not assigned during restoration
   * TODO: Check if we really need tabId here.
   */
  tabId: number | null;
  /** The title of the tab */
  title: string;
  /** The URL of the tab */
  url: string;
  /** Timestamp when the tab was last updated */
  updatedAt: number;

  /** The owner client (browser instance) of the tab
   *  TODO: Add the ownerId config in config_store.ts and settings.ts/html. So that our implementation can read it and the user can modify it on demand.
   */
  owner: string;
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
 * TODO: Rename it to represent a tab in mind, rather than the backend bookmark.
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
