/**
 * Typed abstraction layer for interacting with service-worker via messages.
 */
import {
  GET_NAMED_SESSIONS,
  GET_CLOSED_NAMED_SESSIONS,
  ACTIVATE_SESSION,
} from "../lib/constants";
import { NamedSession, ClosedNamedSession } from "../lib/types";

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
      const response = await chrome.runtime.sendMessage({
        type: GET_NAMED_SESSIONS,
      });
      if (response && response.type === "GET_NAMED_SESSIONS_RESULT") {
        return response.payload;
      }
    } catch (error) {
      console.error("Error in getNamedSessions:", error);
    }
    return [];
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
}

export default new ServiceWorkerInterface();
