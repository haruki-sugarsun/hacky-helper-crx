/**
 * Typed abstraction layer for interacting with service-worker via messages.
 * TODO: Make the method signatures more consistent.
 *       Generally message passing between service-worker-interface and the
 *       service-worker-handler uses ErrorResult.
 *       And the methods in ServiceWorkerInterface throws Errors.
 */
import {
  NamedSession,
  ClosedNamedSession,
  SyncedTabEntity,
} from "../lib/types";
import {
  SuccessResult,
  ErrorResult,
  GET_NAMED_SESSIONS,
  CLONE_NAMED_SESSION,
  ACTIVATE_SESSION,
  GET_CLOSED_NAMED_SESSIONS,
  RESTORE_CLOSED_SESSION,
  GET_SYNCED_OPENTABS,
  GET_SAVED_BOOKMARKS,
  TAKEOVER_TAB,
  MIGRATE_TABS,
} from "./service-worker-messages";

/**
 * ServiceWorkerInterface provides a typed abstraction layer for interacting with the Chrome Extension's background Service Worker.
 *
 * It facilitates communication between the extension's UI components and the background service worker using
 * Chrome's messaging API, and provides methods to retrieve and manage both active and closed named sessions,
 * as well as to manage browser sessions (e.g., activating sessions).
 */
class ServiceWorkerInterface {
  /**
   * Retrieves all active named sessions.
   *
   * @returns A promise that resolves to an array of NamedSession objects.
   * Returns an empty array if the operation fails or no sessions are found.
   */
  async getNamedSessions(): Promise<NamedSession[]> {
    try {
      return await chrome.runtime.sendMessage({
        type: GET_NAMED_SESSIONS,
      });
    } catch (error) {
      console.error("Error in getNamedSessions:", error);
      return [];
    }
  }

  /**
   * Retrieves saved bookmarks for a session.
   *
   * @param sessionId - The unique identifier of the session.
   * @returns A promise that resolves to an array of SyncedTabEntity objects.
   */
  async getSavedBookmarks(sessionId: string): Promise<SyncedTabEntity[]> {
    try {
      return await chrome.runtime.sendMessage({
        type: GET_SAVED_BOOKMARKS,
        payload: { sessionId },
      });
    } catch (error) {
      console.error("Error in getSavedBookmarks:", error);
      return [];
    }
  }

  /**
   * Takes over a tab by its backendTabId.
   *
   * @param backendTabId - The ID of the tab to take over.
   * @returns A promise that resolves when the operation is complete.
   */
  async takeoverTab(
    backendTabId: string,
    sessionId: string,
  ): Promise<SuccessResult | ErrorResult> {
    try {
      return await chrome.runtime.sendMessage({
        type: TAKEOVER_TAB,
        payload: { backendTabId, sessionId },
      });
    } catch (error) {
      console.error("Error in takeoverTab:", error);
      throw error;
    }
  }

  /**
   * Retrieves all closed named sessions.
   *
   * @returns A promise that resolves to an array of ClosedNamedSession objects.
   * Returns an empty array if the operation fails or no closed sessions are found.
   */
  async getClosedNamedSessions(): Promise<ClosedNamedSession[]> {
    let response = (await chrome.runtime.sendMessage({
      type: GET_CLOSED_NAMED_SESSIONS,
    })) as ClosedNamedSession[] | ErrorResult;

    if ("error" in response) {
      throw new Error(`Error in getClosedNamedSessions: ${response.error}`);
    }

    return response;
  }

  /**
   * Activates a session with the specified ID.
   * It also restores it if the sessions is closed.
   *
   * @param sessionId - The unique identifier of the session to activate.
   * @returns A promise that resolves when the activation is complete.
   */
  async activateSession(sessionId: string): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: ACTIVATE_SESSION,
        payload: { sessionId },
      });
    } catch (error) {
      console.error("Error in activateSession:", error);
    }
  }

  /**
   * Clones a named session.
   *
   * @param sessionId - The identifier of the session to clone.
   * @returns A promise that resolves to a SuccessResult indicating the outcome.
   */
  async cloneNamedSession(sessionId: string): Promise<SuccessResult> {
    try {
      return await chrome.runtime.sendMessage({
        type: CLONE_NAMED_SESSION,
        payload: { sessionId },
      });
    } catch (error) {
      console.error("Error in cloneNamedSession:", error);
    }
    return { success: false };
  }

  /**
   * Reassociates a named session with the current window.
   *
   * @param params - An object containing the sessionId and windowId.
   * @returns A promise that resolves to a SuccessResult indicating the outcome.
   */
  async reassociateNamedSession({
    sessionId,
    windowId,
  }: {
    sessionId: string;
    windowId: number;
  }): Promise<SuccessResult | ErrorResult> {
    try {
      return await chrome.runtime.sendMessage({
        type: "REASSOCIATE_NAMED_SESSION",
        payload: { sessionId, windowId },
      });
    } catch (error) {
      console.error("Error in reassociateNamedSession:", error);
    }
    return { success: false };
  }

  /**
   * Migrates tabs from one session to another.
   *
   * @param params - An object containing the source and destination session IDs.
   * @returns A promise that resolves to a SuccessResult indicating the outcome.
   */
  async migrateTabs(
    tabIds: number[],
    toSessionId: string | undefined,
    toWindowId: number | undefined,
  ): Promise<SuccessResult> {
    // We need either of toSessionId or toWindowId
    if (!toSessionId && !toWindowId) {
      throw new Error("Either toSessionId or toWindowId must be provided");
    }

    let response = (await chrome.runtime.sendMessage({
      type: MIGRATE_TABS,
      payload: { tabIds, toSessionId, toWindowId },
    })) as SuccessResult | ErrorResult;
    if ("error" in response) {
      throw new Error(`Error in migrateTabs: ${response.error}`);
    }
    return response;
  }

  /**
   * Retrieves synced open tabs.
   *
   * @returns A promise resolving to an array of synced open tab objects.
   */
  async getSyncedOpenTabs(sessionId: string): Promise<SyncedTabEntity[]> {
    try {
      return await chrome.runtime.sendMessage({
        type: GET_SYNCED_OPENTABS,
        payload: { sessionId },
      });
    } catch (error) {
      console.error("Error in getSyncedOpenTabs:", error);
      return [];
    }
  }

  /**
   * Restores a closed session by its session ID.
   *
   * @param sessionId - The unique identifier of the session to restore.
   * @returns A promise that resolves to a NamedSession object if successful, or null otherwise.
   */
  async restoreClosedSession(sessionId: string): Promise<NamedSession> {
    let response = (await chrome.runtime.sendMessage({
      type: RESTORE_CLOSED_SESSION,
      payload: { sessionId },
    })) as NamedSession | ErrorResult;

    if ("error" in response) {
      throw new Error(`Error in restoreClosedSession: ${response.error}`);
    }

    return response;
  }
}

export default new ServiceWorkerInterface();
