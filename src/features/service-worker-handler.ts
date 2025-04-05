/**
 * Service Worker Handler for processing messages.
 * This file contains the logic for handling messages sent to the service worker.
 */

import {
  ACTIVATE_SESSION,
  GET_NAMED_SESSIONS,
  GET_CLOSED_NAMED_SESSIONS,
} from "../lib/constants";
import { activateSessionById, cloneNamedSession } from "./session-management";
import { SuccessResult, CLONE_NAMED_SESSION } from "./service-worker-messages";

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
    await activateSessionById(sessionId);
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
function handleGetNamedSessions(sendResponse: (response?: any) => void): void {
  // Placeholder for actual implementation
  sendResponse({ type: "GET_NAMED_SESSIONS_RESULT", payload: [] });
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
    const clonedSession = await cloneNamedSession(sessionId);
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
