/**
 * Typed abstraction layer for interacting with service-worker via messages.
 */
import {
  GET_NAMED_SESSIONS,
  GET_CLOSED_NAMED_SESSIONS,
} from "../lib/constants";
import { NamedSession, ClosedNamedSession } from "../lib/types";

class ServiceWorkerInterface {
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
}

export default new ServiceWorkerInterface();
