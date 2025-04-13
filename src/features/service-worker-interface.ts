/**
 * Typed abstraction layer for interacting with service-worker via messages.
 */
import { GET_CLOSED_NAMED_SESSIONS, ACTIVATE_SESSION } from "../lib/constants";
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
  GET_SYNCED_OPENTABS,
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
   * Retrieves all closed named sessions.
   *
   * @returns A promise that resolves to an array of ClosedNamedSession objects.
   * Returns an empty array if the operation fails or no closed sessions are found.
   */
  async getClosedNamedSessions(): Promise<ClosedNamedSession[]> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: GET_CLOSED_NAMED_SESSIONS,
      });
      if (response && response.type === "GET_CLOSED_NAMED_SESSIONS_RESULT") {
        return response.payload.closedSessions || [];
      }
    } catch (error) {
      console.error("Error in getClosedNamedSessions:", error);
    }
    return [];
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
}

export default new ServiceWorkerInterface();
