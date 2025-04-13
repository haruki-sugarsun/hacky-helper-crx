/**
 * Service Worker Handler for processing messages.
 * This file contains the logic for handling messages sent to the service worker.
 */

import { ACTIVATE_SESSION, GET_CLOSED_NAMED_SESSIONS } from "../lib/constants";
import { SyncedTabEntity } from "../lib/types";
import {
  SuccessResult,
  ErrorResult,
  CLONE_NAMED_SESSION,
  GET_NAMED_SESSIONS,
  REASSOCIATE_NAMED_SESSION,
  GET_SYNCED_OPENTABS,
} from "./service-worker-messages";
import * as SessionManagement from "./session-management";
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

    default:
      console.warn("Unknown message type:", message.type);
      sendResponse({ error: "Unknown message type" });
      return false;
  }
  return true;
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
function handleGetClosedNamedSessions(
  sendResponse: (response?: any) => void,
): void {
  // Placeholder for actual implementation
  sendResponse({ type: "GET_CLOSED_NAMED_SESSIONS_RESULT", payload: [] });
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
