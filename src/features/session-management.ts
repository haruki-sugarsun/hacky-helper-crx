/**
 * @file session-management.ts
 *
 * This file manages active named sessions "in local" using Chrome extensions' local storage API
 * and syncs them with the backend when necessary.
 */
// TODO: Document about the methods that session-management manages active named sessions "in local" using chrome extensions local strorage API, and sync that with the backedn when necessary.

import { ClosedNamedSession, NamedSession } from "../lib/types";
import { BookmarkStorage } from "./BookmarkStorage";
import { CONFIG_RO } from "../features/config-store";
import {
  convertTabsToNamedSessionTabs,
  convertTabToNamedSessionTab,
} from "./session-management/session-management-helpers";

// Storage key for named sessions
const NAMED_SESSIONS_STORAGE_KEY = "hacky_helper_named_sessions";

// TODO: Encapsulate in a class.

/* ============================
   Internal Helper Functions
============================ */

/**
 * Gets all named sessions from storage and verifies window existence.
 */
export async function getActiveNamedSessionsInLocal(): Promise<
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
async function getActiveNamedSession(
  sessionId: string,
): Promise<NamedSession | null> {
  const sessions = await getActiveNamedSessionsInLocal();
  return sessions[sessionId] || null;
}

/**
 * Saves a named session to storage
 */
export async function saveActiveNamedSessionInLocal(
  session: NamedSession,
): Promise<void> {
  try {
    const sessions = await getActiveNamedSessionsInLocal();
    sessions[session.id] = session;
    // TODO: Ideally we want to save data per session.
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
export async function deleteActiveNamedSessionInLocal(
  sessionId: string,
): Promise<void> {
  try {
    const sessions = await getActiveNamedSessionsInLocal();
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

export async function reassociateNamedSessionInLocal(
  sessionId: string,
  windowId: number,
): Promise<{ success: boolean }> {
  // TODO: We would rather check if we have a closed named session with the given sessionId.
  //       and if found only update the session association in-local.
  // Check for closed session
  const activeSessions = await getActiveNamedSessionsInLocal();
  const activeSessionIds = Object.keys(activeSessions);
  const closedSessions =
    await BookmarkStorage.getInstance().getClosedNamedSessions(
      activeSessionIds,
    );
  const closedSession = closedSessions.find((s) => s.id === sessionId);
  if (closedSession) {
    // Transform closedSession into a NamedSession by adding missing properties.
    const updatedSession: NamedSession = {
      id: closedSession.id,
      name: closedSession.name,
      windowId: windowId,
      createdAt: closedSession.createdAt, // TODO: propagate from the backend.
      updatedAt: Date.now(), // TODO: propagate from the backend.
    };
    try {
      await saveActiveNamedSessionInLocal(updatedSession);
      console.log(
        `Reassociated closed session ${sessionId} to window ${windowId}`,
      );
      return { success: true };
    } catch (error) {
      console.error("Error during reassociation of closed session:", error);
      return { success: false };
    }
  }
  console.error(`Session ${sessionId} not found during reassociation.`);
  return { success: false };
}

/* ============================
   Backend Sync & Utilities
============================ */

/**
 * Restores Named Sessions from Bookmark storage.
 */
export async function restoreNamedSessionsFromBackend() {
  try {
    // Initialize bookmark storage
    const initialized = await BookmarkStorage.getInstance().initialize();
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
export async function syncSessionToBackend(
  session: NamedSession,
): Promise<boolean> {
  if (!session.name) return false;

  try {
    // Get the current tabs for the session's window
    if (!session.windowId) {
      console.warn(
        `Cannot sync session ${session.id} without a valid windowId`,
      );
      return false;
    }

    // Query for non-pinned tabs in the window
    const tabs = await chrome.tabs.query({
      windowId: session.windowId,
      pinned: false,
    });

    // Filter tabs with valid URL scheme: http, https, or chrome-extension:
    // TODO: Factor out such common logic into a util file in lib directory.
    const validTabs = tabs.filter((tab) => {
      if (!tab.url) return false;
      return /^https?:|^chrome-extension:/.test(tab.url);
    });

    const instanceId = await CONFIG_RO.INSTANCE_ID();
    const sessionTabs = convertTabsToNamedSessionTabs(validTabs, instanceId);

    const result = await BookmarkStorage.getInstance().syncSessionToBookmarks(
      session,
      sessionTabs,
    );
    return !!result;
  } catch (error) {
    console.error("Error syncing session to bookmarks:", error);
    return false;
  }
}

/**
 * Saves a tab to bookmarks for a specific session
 */
export async function saveTabToBackend(
  sessionId: string,
  tab: chrome.tabs.Tab,
): Promise<boolean> {
  try {
    const instanceId = await CONFIG_RO.INSTANCE_ID();
    const namedSessionTab = convertTabToNamedSessionTab(tab, instanceId);
    const result = await BookmarkStorage.getInstance().saveTabToBookmarks(
      sessionId,
      namedSessionTab,
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
  return await BookmarkStorage.getInstance().getSavedBookmarks(sessionId);
}

/**
 * Gets synced bookmarks for a session
 * TODO: Improve the comment.
 */
export async function getSyncedOpenTabs(sessionId: string) {
  return await BookmarkStorage.getInstance().getSyncedOpenTabs(sessionId);
}

/**
 * Creates a closed session in the bookmark backend.
 * This method is equivalent to creating a corresponding data entry in the backend.
 * TODO: Reuse this implementation for other similar logic.
 * @param sessionName The name of the session to create.
 * @returns The created BookmarkSessionFolder.
 * @throws Error if the session name is invalid or the creation fails.
 */
async function createClosedNamedSessionInBackend(
  sessionName: string,
): Promise<NamedSession> {
  if (!sessionName || sessionName.trim() === "") {
    console.error("Creating a closed session without a valid name.");
    throw new Error("Session name is required but not provided or empty.");
  }
  const finalSessionId = crypto.randomUUID();
  const timestamp = Date.now();
  const closedSession: NamedSession = {
    id: finalSessionId,
    name: sessionName,
    windowId: undefined, // Indicates a closed session
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Create the closed session solely in the bookmark backend.
  const result =
    await BookmarkStorage.getInstance().createSessionFolder(closedSession);
  if (!result) {
    console.error("Failed to create closed session in bookmark storage");
    throw new Error("Failed to create closed session in bookmark storage");
  }

  console.log(
    `Created Closed Named Session in bookmark backend: ${finalSessionId}`,
  );
  return closedSession;
}

/* ============================
   Session C(R)UD Operations
============================ */

/**
 * Creates a new Named Session for the given window.
 * This modifies both in-local session and in-backend session if necessary.
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
  await saveActiveNamedSessionInLocal(session);

  // Save session to Bookmark API for syncing if it has a name and is not being restored from bookmarks
  if (sessionName && !isRestoringFromBookmarks) {
    await syncSessionToBackend(session);
  }

  console.log(
    `Created Named Session: ${finalSessionId} for window ${windowId}`,
  );
  return session;
}

/**
 * Updates the Named Session's tab list with the current tabs from the window.
 * If windowId is provided, it will also update the session's windowId.
 * @param sessionId - The ID of the session to update
 * @param windowId - Optional window ID to update the session with
 * @param isRestoringFromBookmarks - Whether this update is part of a session restoration. Default is false.
 */
export async function updateNamedSessionTabs(
  sessionId: string,
  windowId?: number,
  isRestoringFromBookmarks: boolean = false,
) {
  const session = await getActiveNamedSession(sessionId);
  if (!session) {
    console.warn(
      `Cannot update Named Session tabs: Session not found for session ${sessionId}`,
    );
    return false;
  }

  // Update windowId if provided, but ignore if session already has a valid windowId that is different
  if (windowId !== undefined) {
    if (session.windowId && session.windowId !== windowId) {
      // TODO: We also need to check if the exisitng `session.windowId` exisits in the bwoser. or check that in getNamedSessinoFromStroage()?
      console.log(
        `Duplicate Tabs UI instance for session ${sessionId}: existing windowId ${session.windowId} vs new windowId ${windowId}. Skipping update.`,
      );
      if (chrome.notifications) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icon.png"),
          title: "Duplicate Tabs UI Instance",
          message:
            "Another Tabs UI instance is already active for this session.",
        });
      }
      return false;
    } else {
      session.windowId = windowId;
      console.log(`Updated windowId for session ${sessionId} to ${windowId}`);
    }
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
    await saveActiveNamedSessionInLocal(session);

    // Update Bookmark API to reflect new tabs if the session has a name and we're not restoring from bookmarks
    // TODO: if-structure can be simplified?
    if (session.name && !isRestoringFromBookmarks) {
      await syncSessionToBackend(session);
    } else if (isRestoringFromBookmarks) {
      console.log(
        `Skipping sync to bookmarks for session ${sessionId} as it's being restored from bookmarks`,
      );
    }

    console.log(`Updated Named Session ${sessionId} ${session.name}.`);
    return true;
  } catch (error) {
    console.error(`Error updating tabs for Named Session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Renames a Named Session by its sessionId.
 * @param sessionId - The ID of the session to rename
 * @param newName - The new name for the session
 * @returns Promise<boolean> - True if the session was successfully renamed, false otherwise
 */
export async function renameNamedSession(
  sessionId: string,
  newName: string,
): Promise<boolean> {
  // Check if sessionName is not provided or empty
  // TODO: Factor out the name validation.
  if (!newName || newName.trim() === "") {
    console.error(`Cannot rename session ${sessionId} to an empty name`);
    return false;
  }

  // Get the session from storage
  const session = await getActiveNamedSession(sessionId);
  if (!session) {
    console.warn(
      `Cannot rename session: Session not found for ID ${sessionId}`,
    );
    return false;
  }

  // Update the session name and updatedAt timestamp
  session.name = newName;
  session.updatedAt = Date.now();

  // Save to persistent storage
  await saveActiveNamedSessionInLocal(session);

  // Update the session in bookmark storage
  await syncSessionToBackend(session);

  console.log(`Renamed session ${sessionId} to "${newName}"`);
  return true;
}

export async function updateSessionUpdatedAt(sessionId: string): Promise<void> {
  const session = await getActiveNamedSession(sessionId);
  if (session) {
    session.updatedAt = Date.now();
    await saveActiveNamedSessionInLocal(session);
    console.log(
      `Updated session ${sessionId}'s updatedAt to ${session.updatedAt}`,
    );
  } else {
    console.warn(`Session ${sessionId} not found in updateSessionUpdatedAt`);
  }
}

/**
 * Deletes a Named Session by its sessionId.
 * Checks both in-local for active and in-backendfor closed sessions.
 */
export async function deleteNamedSession(sessionId: string) {
  // Check if the session exists in storage
  const session = await getActiveNamedSession(sessionId);
  if (session) {
    // Remove corresponding Bookmark folder if the session has a name
    if (session.name) {
      await BookmarkStorage.getInstance().deleteSessionFolder(sessionId);
    }

    // Remove from storage
    await deleteActiveNamedSessionInLocal(sessionId);

    console.log(`Deleted Named Session ${sessionId}`);
    return true;
  } else {
    // Check if this is a closed session in bookmark storage
    const activeSessions = await getActiveNamedSessionsInLocal();
    const activeSessionIds = Object.keys(activeSessions);
    const closedSessions =
      await BookmarkStorage.getInstance().getClosedNamedSessions(
        activeSessionIds,
      );
    const closedSession = closedSessions.find(
      (session) => session.id === sessionId,
    );

    if (closedSession) {
      // Delete the closed session from bookmark storage
      const result =
        await BookmarkStorage.getInstance().deleteSessionFolder(sessionId);
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
 * Duplicates (clones) a Named Session by its original session ID.
 * Returns the newly created Named Session or null if cloning fails.
 */
export async function cloneNamedSession(
  originalSessionId: string,
): Promise<NamedSession | null> {
  // We assume the orignal session is open.
  const originalSession = await getActiveNamedSession(originalSessionId);
  if (!originalSession || !originalSession.windowId) {
    console.error(
      `Cannot clone session: session ${originalSessionId} not found or invalid.`,
    );
    return null;
  }
  const newName = originalSession.name + " (Copy)";
  const newSession = await createClosedNamedSessionInBackend(newName);
  // Clone open tabs from original session
  try {
    const originalTabs = await chrome.tabs.query({
      windowId: originalSession.windowId,
      pinned: false,
    });
    const instanceId = await CONFIG_RO.INSTANCE_ID();
    const namedSessionTabs = convertTabsToNamedSessionTabs(
      originalTabs,
      instanceId,
    );

    await BookmarkStorage.getInstance().syncOpenedPagesForSession(
      newSession.id,
      namedSessionTabs,
    );
    console.log(`Copied ${originalTabs.length} open tabs to the new session`);
  } catch (err) {
    console.error("Error copying open tabs:", err);
  }
  // Clone saved bookmarks from original session
  try {
    const savedBookmarks = await getSavedBookmarks(originalSession.id);
    if (savedBookmarks && savedBookmarks.length) {
      for (const bookmark of savedBookmarks) {
        // TODO: saveTabToBookmarks() actually needs just a partial data from tab. Define own tiny version of Tab for it.
        const fakeTab = {
          tabId: null,
          title: bookmark.title,
          url: bookmark.url,
          updatedAt: Date.now(),
          owner: "bookmark",
        };
        await BookmarkStorage.getInstance().saveTabToBookmarks(
          newSession.id,
          fakeTab,
        );
      }
      console.log(
        `Copied ${savedBookmarks.length} saved bookmarks to the new session`,
      );
    }
  } catch (err) {
    console.error("Error copying saved bookmarks:", err);
  }
  console.log(
    `Cloned session ${originalSessionId} to new session ${newSession.id}`,
  );
  return newSession;
}

/* ============================
   Session Retrieval Functions
============================ */

/**
 * Gets all named sessions, both active and closed.
 * Returns a combined array of named sessions.
 */
export async function getNamedSessions(): Promise<NamedSession[]> {
  // Get active sessions from storage
  const activeSessions = await getActiveNamedSessionsInLocal();
  const activeSessionsArray = Object.values(activeSessions);

  // Get closed sessions from bookmarks
  const activeSessionIds = Object.keys(activeSessions);
  const closedSessions =
    await BookmarkStorage.getInstance().getClosedNamedSessions(
      activeSessionIds,
    );

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
    const sessions = await getActiveNamedSessionsInLocal();
    const activeSessionIds = Object.keys(sessions);

    // Get closed sessions from bookmark storage
    // TODO: We should filter in the session_management since that represents better separation of responsibilities.
    return await BookmarkStorage.getInstance().getClosedNamedSessions(
      activeSessionIds,
    );
  } catch (error) {
    console.error("Error getting closed named sessions:", error);
    return [];
  }
}

/* ============================
   Window/Tab Migration & Activation
============================ */

/**
 * Takes over a tab by opening its URL in the current session and updating its ownership.
 * @param backendTabId The backend tab ID (bookmark ID).
 * @returns Promise<void>
 */
export async function takeoverTab(
  backendTabId: string,
  sessionId: string,
): Promise<void> {
  try {
    const bookmarkStorage = BookmarkStorage.getInstance();
    const syncedTabs = await bookmarkStorage.getSyncedOpenTabs(sessionId);
    const tabToTakeover = syncedTabs.find((tab) => tab.id === backendTabId);

    if (!tabToTakeover) {
      throw new Error(`Tab with ID ${backendTabId} not found.`);
    }

    // Check if the URL is already open in the current window
    const existingTabs = await chrome.tabs.query({ url: tabToTakeover.url });
    if (existingTabs.length > 0) {
      // Focus on the first matching tab
      await chrome.tabs.update(existingTabs[0].id!, { active: true });
      console.log(`Focused on existing tab with URL ${tabToTakeover.url}`);
      return;
    } else {
      // Open the URL in the current session if no matching tab is found
      await chrome.tabs.create({ url: tabToTakeover.url });
    }

    // Update the tab's owner in the backend
    const instanceId = await CONFIG_RO.INSTANCE_ID();
    const updatedTab = { ...tabToTakeover, owner: instanceId };
    await BookmarkStorage.getInstance().updateTabOwner(
      backendTabId,
      updatedTab,
    );
    console.log(`Successfully took over tab ${backendTabId}.`);
  } catch (error) {
    console.error("Error taking over tab:", error);
    throw error;
  }
}

/**
 * Migrates multiple tabs to a different window/session
 * @param tabIds Array of IDs of the tabs to migrate
 * @param windowId ID of the destination window
 * @returns Promise that resolves when the tabs have been migrated
 */
export async function migrateTabsToWindow(
  tabIds: number[],
  windowId: number,
): Promise<chrome.tabs.Tab[]> {
  const results: chrome.tabs.Tab[] = [];
  for (const tabId of tabIds) {
    const tab = await chrome.tabs.move(tabId, { windowId, index: -1 });
    results.push(tab);
  }
  return results;
}

/**
 * Restores a closed named session by creating a new window with the saved tabs
 */
export async function restoreClosedSession(
  sessionId: string,
): Promise<NamedSession | null> {
  try {
    // Get the closed session from bookmarks
    const sessions = await getActiveNamedSessionsInLocal();
    const activeSessionIds = Object.keys(sessions);
    const closedSessions =
      await BookmarkStorage.getInstance().getClosedNamedSessions(
        activeSessionIds,
      );
    const closedSession = closedSessions.find(
      (session) => session.id === sessionId,
    );

    if (!closedSession) {
      console.error(`Closed session with ID ${sessionId} not found`);
      return null;
    }

    // Filter tabs owned by the current instance
    const instanceId = await CONFIG_RO.INSTANCE_ID();
    const ownedTabs = closedSession.tabs.filter(
      (tab) => tab.owner === instanceId,
    );

    // Create a new window with a blank page first to avoid multiple processing of the tabs UI triggered in parallel
    const newWindow = await chrome.windows.create({
      url: "about:blank",
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

    // Add all the owned tabs to the window
    for (let i = 0; i < ownedTabs.length; i++) {
      const tab = ownedTabs[i];
      if (tab.url) {
        await chrome.tabs.create({
          windowId: newWindow.id,
          url: tab.url,
        });
      }
    }

    // Update the session tabs, indicating this is part of a session restoration
    // TODO: We might be able to reconsider the create&update NamedSession. It now looks a bit complicated.
    await updateNamedSessionTabs(newSession.id, undefined, true);

    // Find the blank page tab and update it with tabs.html URL
    const tabs = await chrome.tabs.query({ windowId: newWindow.id });
    const blankPageTab = tabs.find((tab) => tab.url === "about:blank");

    if (blankPageTab && blankPageTab.id) {
      // Build the URL with session parameters
      const queryParams = new URLSearchParams();
      queryParams.set("sessionId", sessionId);
      queryParams.set("sessionName", closedSession.name);
      const tabsUrl = `${chrome.runtime.getURL("tabs.html")}?${queryParams.toString()}`;

      // Update the blank page tab with the tabs.html URL
      await chrome.tabs.update(blankPageTab.id, {
        url: tabsUrl,
        pinned: true, // Pin the tabs.html tab
      });

      console.log(
        `Updated blank page tab to tabs.html with session parameters`,
      );
    } else {
      console.warn("Could not find blank page tab to update to tabs.html");
    }

    return newSession;
  } catch (error) {
    console.error("Error restoring closed session:", error);
    return null;
  }
}

/*
 * Activates a session by ID.
 * Restores if closed and focuses its window.
 *
 * @param sessionId - Session ID.
 */
export async function activateSessionById(sessionId: string): Promise<void> {
  // TODO: Use getNamedSessions() and find by SessionID. (Now checks both open and closed sessions)
  const sessions = await getNamedSessions();
  let session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    console.error(`Session ${sessionId} not found.`);
    throw new Error(`Session not found: ${sessionId}`);
  }
  // If not open, restore the session and activate.
  if (!session.windowId) {
    console.log(`Session ${sessionId} is not open. Attempting to restore.`);
    const restoredSession = await restoreClosedSession(sessionId);
    if (!restoredSession || !restoredSession.windowId) {
      console.error(`Failed to restore session ${sessionId}.`);
      throw new Error(`Cannot restore session: ${sessionId}`);
    }
    session = restoredSession;
  }
  // TODO: Consider if we want to have UI interaction out of session-management.ts.
  await chrome.windows.update(session.windowId!, { focused: true });
  console.log(
    `Activated session ${sessionId} by focusing window ${session.windowId}`,
  );
}

/* ============================
   Auto-save Management
============================ */

/**
 * Auto-saves all named sessions to bookmarks
 * TODO: Implement proper time-out control and comparison with the backend.
 */
async function autoSaveAllSessions() {
  try {
    console.log("Auto-saving all named sessions to bookmarks");

    // Get all named sessions from storage
    const sessions: NamedSession[] = Object.values(
      await getActiveNamedSessionsInLocal(),
    );

    // Sync each session to bookmarks
    for (const session of sessions) {
      // Fetch backend session and compare timestamps.
      const backendSession = await BookmarkStorage.getInstance().getSession(
        session.id,
      );
      if (!backendSession) {
        // TODO: Implement handling of session removal by other instance.
        console.log(`Session ${session.id} is missing the backend.`);
      } else if (session.updatedAt > backendSession.updatedAt) {
        // TODO: Introduce the graceful timeout before the auto-sync. and have it configurable in Settings UI.
        // We have bookmarkAutoSaveIdleTime config already.
        await syncSessionToBackend(session);
        console.log(
          `Synced session ${session.id} as local data is more recent.`,
        );
      } else {
        console.log(`Session ${session.id} is up-to-date. Skipping sync.`);
      }
    }

    console.log(`Auto-saved ${sessions.length} named sessions to bookmarks`);
  } catch (error) {
    console.error("Error auto-saving sessions:", error);
  }
}

// TODO: Doc.
// TODO: Implement.
export async function triggerAutoSessionSync(): Promise<void> {
  console.log("triggerAutoSessionSync");
  autoSaveAllSessions();
}
