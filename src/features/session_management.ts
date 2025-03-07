import { NamedSession } from "../lib/types";

// In-memory storage for Named Sessions
let namedSessions: Record<string, NamedSession> = {};

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

  // TODO: Save session to Bookmark API for syncing.
  console.log(`Created Named Session: ${sessionId} for window ${windowId}`);
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

    // TODO: Update Bookmark API to reflect new tabs.
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
    // TODO: Remove corresponding Bookmark folder.
    delete namedSessions[sessionId];
    console.log(`Deleted Named Session ${sessionId}`);
  } else {
    console.warn(`Attempted to delete non-existent Named Session ${sessionId}`);
  }
}

/**
 * Restores Named Sessions from Bookmark storage.
 * TODO: Implement restoring logic from Bookmark API.
 */
export async function restoreNamedSessionsFromBookmarks() {
  // Placeholder for restoration logic.
  console.log(
    "Restoring Named Sessions from Bookmarks... (not implemented yet)",
  );
}
export function getNamedSessions() {
  return Object.values(namedSessions);
}
