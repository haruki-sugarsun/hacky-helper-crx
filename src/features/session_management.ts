import { ClosedNamedSession, NamedSession } from "../lib/types";
import { bookmarkStorage } from "./bookmark_storage";
import { getConfig } from "./config_store";

// Storage key for named sessions
const NAMED_SESSIONS_STORAGE_KEY = "hacky_helper_named_sessions";

/**
 * Gets all named sessions from storage and verifies window existence
 */
async function getNamedSessionsFromStorage(): Promise<
  Record<string, NamedSession>
> {
  try {
    const result = await chrome.storage.local.get(NAMED_SESSIONS_STORAGE_KEY);
    let sessions: Record<string, NamedSession> = {};

    if (result[NAMED_SESSIONS_STORAGE_KEY]) {
      sessions = JSON.parse(result[NAMED_SESSIONS_STORAGE_KEY]);

      // Check if windows still exist and update sessions accordingly
      let hasUpdates = false;

      for (const sessionId in sessions) {
        const session = sessions[sessionId];

        if (!session.windowId) {
          // Remove sessions with null windowId
          console.log(
            `Session ${sessionId} has null windowId, removing from storage`,
          );

          // Delete the session from the sessions object
          delete sessions[sessionId];
          hasUpdates = true;
        } else {
          try {
            // Try to get the window - if it doesn't exist, this will throw an error
            await chrome.windows.get(session.windowId);
          } catch (windowError) {
            // Window doesn't exist anymore, remove the session from storage
            console.log(
              `Window ${session.windowId} for session ${sessionId} no longer exists, removing session from storage`,
            );

            // Delete the session from the sessions object
            delete sessions[sessionId];
            hasUpdates = true;
          }
        }
      }

      // If any sessions were updated, save them back to storage
      if (hasUpdates) {
        await chrome.storage.local.set({
          [NAMED_SESSIONS_STORAGE_KEY]: JSON.stringify(sessions),
        });
        console.log("Updated sessions storage after window existence check");
      }
    }

    return sessions;
  } catch (error) {
    console.error("Error loading named sessions from storage:", error);
    return {};
  }
}

/**
 * Gets a specific named session from storage by ID
 */
async function getNamedSessionFromStorage(
  sessionId: string,
): Promise<NamedSession | null> {
  const sessions = await getNamedSessionsFromStorage();
  return sessions[sessionId] || null;
}

/**
 * Saves a named session to storage
 */
async function saveNamedSessionToStorage(session: NamedSession): Promise<void> {
  try {
    const sessions = await getNamedSessionsFromStorage();
    sessions[session.id] = session;
    await chrome.storage.local.set({
      [NAMED_SESSIONS_STORAGE_KEY]: JSON.stringify(sessions),
    });
    console.log(`Saved session ${session.id} to storage`);
  } catch (error) {
    console.error("Error saving session to storage:", error);
  }
}

/**
 * Deletes a named session from storage
 */
async function deleteNamedSessionFromStorage(sessionId: string): Promise<void> {
  try {
    const sessions = await getNamedSessionsFromStorage();
    if (sessions[sessionId]) {
      delete sessions[sessionId];
      await chrome.storage.local.set({
        [NAMED_SESSIONS_STORAGE_KEY]: JSON.stringify(sessions),
      });
      console.log(`Deleted session ${sessionId} from storage`);
    }
  } catch (error) {
    console.error("Error deleting session from storage:", error);
  }
}

// Auto-save timer
let autoSaveTimer: number | null = null;

/**
 * Creates a new Named Session for the given window.
 * Returns the created NamedSession.
 * @param windowId - The ID of the window to create a session for
 * @param sessionName - The name of the session (required, cannot be empty)
 * @param sessionId - Optional ID to use for the session. If not provided, a new UUID will be generated
 * @param isRestoringFromBookmarks - Whether this session is being restored from bookmarks. Default is false.
 * @throws Error if sessionName is not provided or empty
 */
export async function createNamedSession(
  windowId: number,
  sessionName: string,
  sessionId?: string,
  isRestoringFromBookmarks: boolean = false,
): Promise<NamedSession> {
  // Check if sessionName is not provided or empty
  if (!sessionName || sessionName.trim() === "") {
    console.error(
      `Creating a session without a valid name for window ${windowId}. This session won't be synced to bookmarks.`,
    );
    throw new Error(
      `Session name is required but not provided or empty for window ${windowId}`,
    );
  }

  const finalSessionId = sessionId || crypto.randomUUID();
  const timestamp = Date.now();
  const session: NamedSession = {
    id: finalSessionId,
    name: sessionName,
    windowId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Save to persistent storage
  await saveNamedSessionToStorage(session);

  // Save session to Bookmark API for syncing if it has a name and is not being restored from bookmarks
  if (sessionName && !isRestoringFromBookmarks) {
    await syncSessionToBookmarks(session);
  }

  console.log(
    `Created Named Session: ${finalSessionId} for window ${windowId}`,
  );

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
  const session = await getNamedSessionFromStorage(sessionId);
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
    // TODO: We don't sync pinned tabs. So we query for only un-pinned tabs.
    session.updatedAt = Date.now();

    // Save updated session to storage
    await saveNamedSessionToStorage(session);

    // Update Bookmark API to reflect new tabs if the session has a name
    // TODO: We don't need to sync back if restoring the session.
    if (session.name) {
      await syncSessionToBookmarks(session);
    }

    console.log(`Updated Named Session ${sessionId} ${session.name}.`);
    return true;
  } catch (error) {
    console.error(`Error updating tabs for Named Session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Deletes a Named Session by its sessionId.
 * Checks both storage and bookmark storage for closed sessions.
 */
export async function deleteNamedSession(sessionId: string) {
  // Check if the session exists in storage
  const session = await getNamedSessionFromStorage(sessionId);
  if (session) {
    // Remove corresponding Bookmark folder if the session has a name
    if (session.name) {
      await bookmarkStorage.deleteSessionFolder(sessionId);
    }

    // Remove from storage
    await deleteNamedSessionFromStorage(sessionId);

    console.log(`Deleted Named Session ${sessionId}`);
    return true;
  } else {
    // Check if this is a closed session in bookmark storage
    const activeSessions = await getNamedSessionsFromStorage();
    const activeSessionIds = Object.keys(activeSessions);
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
    // 3. Saving them to storage using saveNamedSessionToStorage

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

    // Get all named sessions from storage
    const sessions = Object.values(await getNamedSessionsFromStorage());

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
 * Gets all named sessions, both active and closed.
 * Returns a combined array of named sessions.
 */
export async function getNamedSessions(): Promise<NamedSession[]> {
  // Get active sessions from storage
  const activeSessions = await getNamedSessionsFromStorage();
  const activeSessionsArray = Object.values(activeSessions);

  // Get closed sessions from bookmarks
  const activeSessionIds = Object.keys(activeSessions);
  const closedSessions =
    await bookmarkStorage.getClosedNamedSessions(activeSessionIds);

  // Convert closed sessions to NamedSession format
  const convertedClosedSessions: NamedSession[] = closedSessions.map(
    (closedSession) => ({
      id: closedSession.id,
      name: closedSession.name,
      windowId: undefined, // Closed sessions have no window
      createdAt: closedSession.updatedAt || Date.now(), // Use updatedAt as createdAt if available, or current time
      updatedAt: closedSession.updatedAt || Date.now(),
    }),
  );

  // Combine and return both active and closed sessions
  return [...activeSessionsArray, ...convertedClosedSessions];
}

/**
 * Gets closed named sessions from bookmarks
 * These are sessions that exist in bookmarks but don't have an active window
 */
export async function getClosedNamedSessions(): Promise<ClosedNamedSession[]> {
  try {
    // Get all active session IDs from storage
    const sessions = await getNamedSessionsFromStorage();
    const activeSessionIds = Object.keys(sessions);

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
    const sessions = await getNamedSessionsFromStorage();
    const activeSessionIds = Object.keys(sessions);
    const closedSessions =
      await bookmarkStorage.getClosedNamedSessions(activeSessionIds);
    const closedSession = closedSessions.find(
      (session) => session.id === sessionId,
    );

    if (!closedSession) {
      console.error(`Closed session with ID ${sessionId} not found`);
      return null;
    }

    // Create a new window with tabs.html first
    const newWindow = await chrome.windows.create({
      // TODO: Consider adding sessionId and sessionName encoded in URL as we do in tabs_helper.ts.
      //       We might want to have a common helper function tabs_helper.ts.
      url: chrome.runtime.getURL("tabs.html"),
      focused: true,
    });

    if (!newWindow || !newWindow.id) {
      console.error("Failed to create new window");
      return null;
    }

    // Create a named session for the new window with the same ID as the closed session
    const newSession = await createNamedSession(
      newWindow.id,
      closedSession.name,
      sessionId, // Pass the original sessionId to maintain identity
      true, // Indicate that this session is being restored from bookmarks
    );

    // Add all the saved tabs to the window
    for (let i = 0; i < closedSession.tabs.length; i++) {
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
