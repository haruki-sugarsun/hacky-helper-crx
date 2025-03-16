import { ClosedNamedSession, NamedSession } from "../lib/types";
import { bookmarkStorage } from "./bookmark_storage";
import { getConfig } from "../config_store";

// In-memory storage for Named Sessions
// TODO: This namedSessions is not loading from the backend bookmarkStorage on startup.
// TODO: Also the backend bookmarkStorage can be update asynchronously. We can update the in-memory sessions if we find a difference.
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
    tabs: [], // TODO: Here the tabs are not synced to the actual tabs in the window yet.
  };
  namedSessions[sessionId] = session;

  // Save session to Bookmark API for syncing if it has a name
  if (sessionName) {
    await syncSessionToBookmarks(session);
  }

  console.log(`Created Named Session: ${sessionId} for window ${windowId}`);

  // Start auto-save timer if not already running
  // TODO: Consider a better place to have the timer/scheduled alarm.
  startAutoSaveTimer();

  return session;
}

/**
 * Updates the Named Session's tab list with the current tabs from the window.
 * If windowId is provided, it will also update the session's windowId.
 */
export async function updateNamedSessionTabs(
  sessionId: string,
  windowId?: number,
) {
  const session = namedSessions[sessionId];
  if (!session) {
    console.warn(
      `Cannot update Named Session tabs: Session not found for session ${sessionId}`,
    );
    return false;
  }

  // Update windowId if provided
  if (windowId !== undefined) {
    session.windowId = windowId;
    console.log(`Updated windowId for session ${sessionId} to ${windowId}`);
  }

  // If windowId is still null, we can't update tabs
  if (session.windowId === null) {
    console.warn(
      `Cannot update Named Session tabs: windowId is null for session ${sessionId}`,
    );
    return false;
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
    return true;
  } catch (error) {
    console.error(`Error updating tabs for Named Session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Deletes a Named Session by its sessionId.
 * Checks both in-memory sessions and bookmark storage for closed sessions.
 */
export async function deleteNamedSession(sessionId: string) {
  // Check if the session exists in memory
  if (namedSessions[sessionId]) {
    const session = namedSessions[sessionId];

    // Remove corresponding Bookmark folder if the session has a name
    if (session.name) {
      await bookmarkStorage.deleteSessionFolder(sessionId);
    }

    delete namedSessions[sessionId];
    console.log(`Deleted Named Session ${sessionId}`);
    return true;
  } else {
    // Check if this is a closed session in bookmark storage
    const activeSessionIds = Object.keys(namedSessions);
    const closedSessions =
      await bookmarkStorage.getClosedNamedSessions(activeSessionIds);
    const closedSession = closedSessions.find(
      (session) => session.id === sessionId,
    );

    if (closedSession) {
      // Delete the closed session from bookmark storage
      const result = await bookmarkStorage.deleteSessionFolder(sessionId);
      if (result) {
        console.log(
          `Deleted closed Named Session ${sessionId} from bookmark storage`,
        );
        return true;
      } else {
        console.error(
          `Failed to delete closed Named Session ${sessionId} from bookmark storage`,
        );
        return false;
      }
    } else {
      console.warn(
        `Attempted to delete non-existent Named Session ${sessionId}`,
      );
      return false;
    }
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
    // TODO: We need to pass the currently opend tabs to the bookmarkStorage.
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
 *       We see `Error starting auto-save timer: ReferenceError: window is not defined`.
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

/**
 * Gets all named sessions
 */
export function getNamedSessions() {
  return Object.values(namedSessions);
}

/**
 * Gets closed named sessions from bookmarks
 * These are sessions that exist in bookmarks but don't have an active window
 */
export async function getClosedNamedSessions(): Promise<ClosedNamedSession[]> {
  try {
    // Get all active session IDs
    const activeSessionIds = Object.keys(namedSessions);

    // Get closed sessions from bookmark storage
    // TODO: We should filter in the session_management since that represents better separation of responsibilities.
    return await bookmarkStorage.getClosedNamedSessions(activeSessionIds);
  } catch (error) {
    console.error("Error getting closed named sessions:", error);
    return [];
  }
}

/**
 * Restores a closed named session by creating a new window with the saved tabs
 */
export async function restoreClosedSession(
  sessionId: string,
): Promise<NamedSession | null> {
  try {
    // Get the closed session from bookmarks
    const activeSessionIds = Object.keys(namedSessions);
    const closedSessions =
      await bookmarkStorage.getClosedNamedSessions(activeSessionIds);
    const closedSession = closedSessions.find(
      (session) => session.id === sessionId,
    );

    if (!closedSession) {
      console.error(`Closed session with ID ${sessionId} not found`);
      return null;
    }

    // Create a new window with the first tab
    // TODO: We can create a window even without opening a existing tab, and instead we can open tabs.html.
    const firstTab = closedSession.tabs[0];
    if (!firstTab || !firstTab.url) {
      console.error("No tabs found in closed session");
      return null;
    }

    const newWindow = await chrome.windows.create({
      url: firstTab.url,
      focused: true,
    });

    if (!newWindow || !newWindow.id) {
      console.error("Failed to create new window");
      return null;
    }

    // Create a named session for the new window
    const newSession = await createNamedSession(
      newWindow.id,
      closedSession.name,
    );

    // Add the remaining tabs to the window
    for (let i = 1; i < closedSession.tabs.length; i++) {
      const tab = closedSession.tabs[i];
      if (tab.url) {
        await chrome.tabs.create({
          windowId: newWindow.id,
          url: tab.url,
        });
      }
    }

    // Update the session tabs
    await updateNamedSessionTabs(newSession.id);

    return newSession;
  } catch (error) {
    console.error("Error restoring closed session:", error);
    return null;
  }
}
