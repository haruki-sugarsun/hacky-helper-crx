import { NamedSession } from "../lib/types";
import { bookmarkStorage } from "./bookmark_storage";
import { getConfig } from "../config_store";

// In-memory storage for Named Sessions
let namedSessions: Record<string, NamedSession> = {};

// Auto-save timer
let autoSaveTimer: number | null = null;

/**
 * Creates a new Named Session for the given window.
 * If the window is not explicitly named, its name will be null.
 * Returns the created NamedSession.
 */
export async function createNamedSession(
  windowId: number,
  sessionName: string | null,
): Promise<NamedSession> {
  const sessionId = crypto.randomUUID();
  const timestamp = Date.now();
  const session: NamedSession = {
    id: sessionId,
    name: sessionName,
    windowId,
    createdAt: timestamp,
    updatedAt: timestamp,
    tabs: [],
  };
  namedSessions[sessionId] = session;

  // Save session to Bookmark API for syncing if it has a name
  if (sessionName) {
    await syncSessionToBookmarks(session);
  }

  console.log(`Created Named Session: ${sessionId} for window ${windowId}`);

  // Start auto-save timer if not already running
  startAutoSaveTimer();

  return session;
}

/**
 * Updates the Named Session's tab list with the current tabs from the window.
 */
export async function updateNamedSessionTabs(sessionId: string) {
  const session = namedSessions[sessionId];
  if (!session || session.windowId === null) {
    console.warn(
      `Cannot update Named Session tabs: Session not found or windowId is null for session ${sessionId}`,
    );
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ windowId: session.windowId });
    session.tabs = tabs.map((tab) => ({
      tabId: tab.id || null,
      title: tab.title || "",
      url: tab.url || "",
    }));
    session.updatedAt = Date.now();

    // Update Bookmark API to reflect new tabs if the session has a name
    if (session.name) {
      await syncSessionToBookmarks(session);
    }

    console.log(
      `Updated Named Session ${sessionId} tabs: ${session.tabs.length} tabs found.`,
    );
  } catch (error) {
    console.error(`Error updating tabs for Named Session ${sessionId}:`, error);
  }
}

/**
 * Deletes a Named Session by its sessionId.
 */
export async function deleteNamedSession(sessionId: string) {
  if (namedSessions[sessionId]) {
    const session = namedSessions[sessionId];

    // Remove corresponding Bookmark folder if the session has a name
    if (session.name) {
      await bookmarkStorage.deleteSessionFolder(sessionId);
    }

    delete namedSessions[sessionId];
    console.log(`Deleted Named Session ${sessionId}`);
  } else {
    console.warn(`Attempted to delete non-existent Named Session ${sessionId}`);
  }
}

/**
 * Restores Named Sessions from Bookmark storage.
 */
export async function restoreNamedSessionsFromBookmarks() {
  try {
    // Initialize bookmark storage
    const initialized = await bookmarkStorage.initialize();
    if (!initialized) {
      console.warn("Failed to initialize bookmark storage for restoration");
      return;
    }

    // TODO: Implement restoration logic from bookmark folders to named sessions
    // This would involve:
    // 1. Getting all session folders
    // 2. Creating NamedSession objects for each folder
    // 3. Adding them to namedSessions

    console.log("Restoring Named Sessions from Bookmarks...");
  } catch (error) {
    console.error("Error restoring named sessions from bookmarks:", error);
  }
}

/**
 * Syncs a session to bookmarks
 */
export async function syncSessionToBookmarks(
  session: NamedSession,
): Promise<boolean> {
  if (!session.name) return false;

  try {
    const result = await bookmarkStorage.syncSessionToBookmarks(session);
    return !!result;
  } catch (error) {
    console.error("Error syncing session to bookmarks:", error);
    return false;
  }
}

/**
 * Saves a tab to bookmarks for a specific session
 */
export async function saveTabToBookmarks(
  sessionId: string,
  tab: chrome.tabs.Tab,
  metadata?: any,
): Promise<boolean> {
  try {
    const result = await bookmarkStorage.saveTabToBookmarks(
      sessionId,
      tab,
      metadata,
    );
    return !!result;
  } catch (error) {
    console.error("Error saving tab to bookmarks:", error);
    return false;
  }
}

/**
 * Gets saved bookmarks for a session
 */
export async function getSavedBookmarks(sessionId: string) {
  return await bookmarkStorage.getSavedBookmarks(sessionId);
}

/**
 * Gets synced bookmarks for a session
 */
export async function getSyncedBookmarks(sessionId: string) {
  return await bookmarkStorage.getSyncedBookmarks(sessionId);
}

/**
 * Starts the auto-save timer for syncing sessions to bookmarks
 * TODO: We also would like to reset the timer on some activity in the session.
 * TODO: setTimer might not work as expected in service-worker. replace it with proper alarm triggers.
 */
export async function startAutoSaveTimer() {
  // If timer is already running, don't start another one
  if (autoSaveTimer !== null) return;

  try {
    // Get auto-save idle time from config
    const config = await getConfig();
    const idleTimeMinutes = parseInt(
      config.bookmarkAutoSaveIdleTime || "5",
      10,
    );

    // Convert to milliseconds
    const idleTimeMs = idleTimeMinutes * 60 * 1000;

    // Start timer
    autoSaveTimer = window.setTimeout(async () => {
      await autoSaveAllSessions();
      autoSaveTimer = null;
    }, idleTimeMs);

    console.log(
      `Auto-save timer started with ${idleTimeMinutes} minutes idle time`,
    );
  } catch (error) {
    console.error("Error starting auto-save timer:", error);
  }
}

/**
 * Auto-saves all named sessions to bookmarks
 */
async function autoSaveAllSessions() {
  try {
    console.log("Auto-saving all named sessions to bookmarks");

    // Get all named sessions
    const sessions = Object.values(namedSessions);

    // Filter to only include sessions with names
    const namedSessionsOnly = sessions.filter((session) => session.name);

    // Sync each session to bookmarks
    for (const session of namedSessionsOnly) {
      await syncSessionToBookmarks(session);
    }

    console.log(
      `Auto-saved ${namedSessionsOnly.length} named sessions to bookmarks`,
    );
  } catch (error) {
    console.error("Error auto-saving sessions:", error);
  }
}
export function getNamedSessions() {
  return Object.values(namedSessions);
}
