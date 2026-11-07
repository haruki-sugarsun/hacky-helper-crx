/**
 * Service Worker Handler for processing messages.
 * This file contains the logic for handling messages sent to the service worker.
 */

import {
  ClosedNamedSession,
  NamedSession,
  SyncedTabEntity,
} from "../lib/types";
import type { LLMService } from "./llm-service";
import * as DigestManagement from "./digest-management";
import { CONFIG_RO } from "./config-store";
import {
  SuccessResult,
  ErrorResult,
  ACTIVATE_SESSION,
  CLONE_NAMED_SESSION,
  GET_NAMED_SESSIONS,
  REASSOCIATE_NAMED_SESSION,
  GET_SYNCED_OPENTABS,
  TAKEOVER_TAB,
  GET_SAVED_BOOKMARKS,
  GET_CLOSED_NAMED_SESSIONS,
  RESTORE_CLOSED_SESSION,
  MIGRATE_TABS,
  GET_CACHED_SESSION_TITLE_SUGGESTION,
} from "./service-worker-messages";
import * as SessionManagement from "./session-management";

// TODO: Consider if we can/should enclose this as a part of DigestManagement 
const sessionTitleCache = new Map<string, { fingerprint: string; title: string }>();

const pendingSessionTitleRequests = new Map<string, Promise<string>>();

/**
 * Handles incoming messages to the service worker.
 * Returns true if handled implmented message.
 * @param message The message received.
 * @param sender The sender of the message.
 * @param sendResponse The callback to send a response.
 */
export function handleServiceWorkerMessage(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
  llmService: LLMService,
): boolean {
  switch (message.type) {
    case ACTIVATE_SESSION:
      handleActivateSession(message, sendResponse);
      break;

    case GET_NAMED_SESSIONS:
      handleGetNamedSessions(sendResponse);
      break;

    case GET_CLOSED_NAMED_SESSIONS:
      handleGetClosedNamedSessions(sendResponse);
      break;

    case CLONE_NAMED_SESSION:
      handleCloneNamedSession(message, sendResponse);
      break;

    case REASSOCIATE_NAMED_SESSION:
      handleReassociateNamedSession(message, sendResponse);
      break;

    case GET_SYNCED_OPENTABS:
      handleGetSyncedOpenTabs(message, sendResponse);
      break;

    case TAKEOVER_TAB:
      handleTakeoverTab(message, sendResponse);
      break;

    case MIGRATE_TABS:
      handleMigrateTabs(message, sendResponse);
      break;

    case GET_SAVED_BOOKMARKS:
      handleGetSavedBookmarks(message, sendResponse);
      break;

    case RESTORE_CLOSED_SESSION:
      handleRestoreClosedSession(message, sendResponse);
      break;

    case GET_CACHED_SESSION_TITLE_SUGGESTION:
      handleGetCachedSessionTitleSuggestion(message, sendResponse, llmService);
      break;

    default:
      console.warn("Unknown message type:", message.type);
      sendResponse({ error: "Unknown message type" });
      return false;
  }
  return true;
}

async function handleGetCachedSessionTitleSuggestion(
  message: { payload: { windowId: number } },
  sendResponse: (response?: any) => void,
  llmService: LLMService,
): Promise<void> {
  const { windowId } = message.payload;
  if (!windowId) {
    sendResponse({ error: "Window ID is required" });
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ windowId, pinned: false });
    const tabSummaries = await Promise.all(
      tabs
        .filter((tab) => tab.url && /^https?:|^chrome-extension:/.test(tab.url))
        .map(async (tab) => {
          const summaries = await DigestManagement.getCachedSummaries(tab.url!);
          const summary = summaries?.[0]?.summary;
          return summary ? `${tab.title || "Untitled tab"}: ${summary}` : "";
        }),
    );
    const usableSummaries = tabSummaries.filter(Boolean);
    if (usableSummaries.length === 0) {
      sendResponse({ title: "" });
      return;
    }

    const cacheKey = String(windowId);
    const fingerprint = usableSummaries.join("\n");
    const cached = sessionTitleCache.get(cacheKey);
    if (cached?.fingerprint === fingerprint) {
      sendResponse({ title: cached.title });
      return;
    }

    const llmEnabled = await CONFIG_RO.LLM_ENABLED();
    if (!llmEnabled) {
      sendResponse({ title: cached?.title || "" });
      return;
    }

    const pending = pendingSessionTitleRequests.get(cacheKey);
    if (!pending) {
      const titlePromise = (async () => {
        try {
          const title = await llmService.createSessionTitle(usableSummaries);
          if (title) sessionTitleCache.set(cacheKey, { fingerprint, title });
          return title;
        } finally {
          pendingSessionTitleRequests.delete(cacheKey);
        }
      })();
      pendingSessionTitleRequests.set(cacheKey, titlePromise);
      void titlePromise.catch((error) => {
        console.error(`Error generating title for window ${windowId}:`, error);
      });
    }

    // Do not block the Tabs UI on a new or refreshed LLM request. Return the
    // previous title when available; a later UI refresh will read the update.
    sendResponse({ title: cached?.title || "" });
  } catch (error) {
    console.error(`Error suggesting title for window ${windowId}:`, error);
    sendResponse({ title: "" });
  }
}

/**
 * Handles the takeover of a tab by the current instance.
 * @param message The message containing the tab ID and owner.
 * @param sendResponse The callback to send a response.
 */

export async function handleTakeoverTab(
  message: { payload: { backendTabId: string; sessionId: string } },
  sendResponse: (response?: SuccessResult | ErrorResult) => void,
): Promise<void> {
  const { backendTabId, sessionId } = message.payload;

  if (!backendTabId) {
    console.error("Backend tab ID is missing in TAKEOVER_TAB message.");
    sendResponse({ error: "Backend tab ID is required" });
    return;
  }

  try {
    await SessionManagement.takeoverTab(backendTabId, sessionId);
    console.log(`Successfully handled takeover for tab ${backendTabId}.`);
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error handling takeover for tab:", error);
    sendResponse({ error: "Failed to take over tab" });
  }
}

/**
 * Handles the activation of a session.
 * @param message The message containing the session ID to activate.
 * @param sendResponse The callback to send a response.
 */
async function handleActivateSession(
  message: { payload: { sessionId: string } },
  sendResponse: (response?: any) => void,
): Promise<void> {
  const { sessionId } = message.payload;

  if (!sessionId) {
    console.error("Session ID is missing in ACTIVATE_SESSION message.");
    sendResponse({ error: "Session ID is required" });
    return;
  }

  try {
    await SessionManagement.activateSessionById(sessionId);
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error activating session:", error);
    sendResponse({ error: "Failed to activate session" });
  }
}

/**
 * Handles the retrieval of named sessions.
 * @param sendResponse The callback to send a response.
 */
async function handleGetNamedSessions(
  sendResponse: (response?: any) => void,
): Promise<void> {
  const sessions = await SessionManagement.getNamedSessions();
  sendResponse(sessions);
}

/**
 * Handles the retrieval of closed named sessions.
 * @param sendResponse The callback to send a response.
 */
async function handleGetClosedNamedSessions(
  sendResponse: (response: ClosedNamedSession[] | ErrorResult) => void,
): Promise<void> {
  try {
    const closedSessions = await SessionManagement.getClosedNamedSessions();
    sendResponse(closedSessions);
  } catch (error) {
    console.error("Error retrieving closed named sessions:", error);
    sendResponse({
      error: "Failed to retrieve closed named sessions",
    });
  }
}

/**
 * Handles the cloning of a named session.
 * @param message The message containing the session ID to clone.
 * @param sendResponse The callback to send a response.
 */
async function handleCloneNamedSession(
  message: { payload: { sessionId: string } },
  sendResponse: (response?: any) => void,
): Promise<void> {
  const { sessionId } = message.payload;
  if (!sessionId) {
    console.error("Session ID is missing in CLONE_NAMED_SESSION message.");
    sendResponse({ error: "Session ID is required" });
    return;
  }
  try {
    const clonedSession = await SessionManagement.cloneNamedSession(sessionId);
    if (!clonedSession) {
      console.error("Failed to clone session:", sessionId);
      sendResponse({ error: "Failed to clone session" });
      return;
    }
    console.log(`Cloned session ${sessionId} as ${clonedSession.id}`);
    sendResponse({
      success: true,
    } as SuccessResult);
  } catch (error) {
    console.error("Error cloning session:", error);
    sendResponse({ error: "Failed to clone session" });
  }
}

async function handleReassociateNamedSession(
  message: { payload: { sessionId: string; windowId: number } },
  sendResponse: (response: SuccessResult | ErrorResult) => void,
): Promise<void> {
  const { sessionId, windowId } = message.payload;
  if (!sessionId) {
    console.error(
      "Session ID is missing in REASSOCIATE_NAMED_SESSION message.",
    );
    sendResponse({ error: "Session ID is required" });
    return;
  }
  try {
    const result = await SessionManagement.reassociateNamedSessionInLocal(
      sessionId,
      windowId,
    );
    if (result) {
      sendResponse({ success: true });
    } else {
      sendResponse({ error: "Failed to reassociate session" });
    }
  } catch (error) {
    console.error("Error in reassociating session:", error);
    sendResponse({ error: "Failed to reassociate session" });
  }
}

/**
 * Handles the migration of tabs to a new session.
 * @param message The message containing the session ID and tab IDs.
 * @param sendResponse The callback to send a response.
 */
async function handleMigrateTabs(
  message: any,
  sendResponse: (response?: SuccessResult | ErrorResult) => void,
) {
  try {
    const { tabIds, toSessionId, toWindowId } = message.payload;
    if (!tabIds || (!toSessionId && !toWindowId)) {
      console.error(
        "Tab IDs or destination (session ID or window ID) is missing in MIGRATE_TABS message.",
      );
      sendResponse({
        error: "Tab IDs and either session ID or window ID are required",
      });
      return;
    }

    if (toWindowId) {
      // If a window ID is provided, we need to migrate the tabs to that window
      const windowId = parseInt(toWindowId, 10);
      if (isNaN(windowId)) {
        console.error("Invalid window ID provided in MIGRATE_TABS message.");
        sendResponse({ error: "Invalid window ID" });
        return;
      }
      // Migrate the tabs to the destination window
      await SessionManagement.migrateTabsToWindow(tabIds, windowId);
      sendResponse({
        success: true,
      });
    }

    // TODO: Implement for a closed session.
    // If a session ID is provided, we need to migrate the tabs to that session
    // const migratedTabs = await SessionManagement.migrateTabsToSession(
    //   tabIds,
    //   toSessionId,
    // );
    // sendResponse({
    //   success: true
    // });
    sendResponse({ error: "Not Yet Implemented" });
  } catch (error) {
    console.error("Error in migrating tabs:", error);
    sendResponse({ error: "Failed to migrate tabs" });
  }
}

/**
 * Handles the retrieval of synced open tabs.
 * This is a stub implementation: returns an empty list of bookmarks.
 * Replace with actual logic as needed.
 * @param sendResponse The callback to send a response.
 */
async function handleGetSyncedOpenTabs(
  message: any,
  sendResponse: (response?: SyncedTabEntity[]) => void,
): Promise<void> {
  const sessionId = message.payload?.sessionId;
  if (!sessionId) {
    throw new Error("Session ID is required");
  }

  // Get synced bookmarks for the session
  // TODO: Rename the method to getSyncedOpenTabs().
  const bookmarks = await SessionManagement.getSyncedOpenTabs(sessionId);
  sendResponse(bookmarks);
}

/**
 * Handles the retrieval of saved bookmarks for a session.
 * @param message The message containing the session ID.
 * @param sendResponse The callback to send a response.
 */
export async function handleGetSavedBookmarks(
  message: { payload: { sessionId: string } },
  sendResponse: (response?: SyncedTabEntity[] | ErrorResult) => void,
): Promise<void> {
  const { sessionId } = message.payload;
  if (!sessionId) {
    console.error("Session ID is missing in GET_SAVED_BOOKMARKS message.");
    sendResponse({ error: "Session ID is required" });
    return;
  }

  try {
    // Get saved bookmarks for the session
    const bookmarks = await SessionManagement.getSavedBookmarks(sessionId);
    sendResponse(bookmarks);
  } catch (error) {
    console.error("Error fetching saved bookmarks:", error);
    sendResponse({ error: "Failed to fetch saved bookmarks" });
  }
}

/**
 * Handles the restoration of a closed session.
 * @param message The message containing the session ID to restore.
 * @param sendResponse The callback to send a response.
 */
async function handleRestoreClosedSession(
  message: { payload: { sessionId: string } },
  sendResponse: (response: NamedSession | ErrorResult) => void,
): Promise<void> {
  const { sessionId } = message.payload;

  if (!sessionId) {
    console.error("Session ID is missing in RESTORE_CLOSED_SESSION message.");
    sendResponse({ error: "Session ID is required" });
    return;
  }

  try {
    const restoredSession =
      await SessionManagement.restoreClosedSession(sessionId);
    if (restoredSession) {
      sendResponse(restoredSession);
    } else {
      sendResponse({ error: "Failed to restore session" });
    }
  } catch (error) {
    console.error("Error restoring session:", error);
    sendResponse({ error: "Failed to restore session" });
  }
}
