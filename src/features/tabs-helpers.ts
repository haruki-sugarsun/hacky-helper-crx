import * as SessionManagement from "./session-management";
import { TB_TOGGLE_BOOKMARKS_PANE } from "../messages/messages";

/**
 * Ensures a tabs.html tab exists in the specified window.
 * If a tabs.html tab already exists, it will be reloaded.
 * If no tabs.html tab exists, a new one will be created.
 * @param windowId The ID of the window to ensure tabs.html in
 */
export async function ensureTabsHtmlInWindow(windowId: number): Promise<void> {
  try {
    // Check if this window has a named session
    const sessions = await SessionManagement.getNamedSessions();
    const associatedSession = sessions.find(
      (session) => session.windowId === windowId && session.name,
    );

    // Use a more specific pattern to match only our tabs.html page
    // TODO: This "get all Tabs UI tabs" can be a common method.
    const tabsInWindow = await chrome.tabs.query({
      windowId: windowId,
      url: [
        chrome.runtime.getURL("tabs.html"),
        chrome.runtime.getURL("tabs.html?*"),
      ],
    });

    if (tabsInWindow.length > 0) {
      // Tabs.html exists in this window, reload it without activating
      console.log(`Found tabs.html in window ${windowId}, reloading it`);
      await chrome.tabs.reload(tabsInWindow[0].id!);
    } else {
      // No tabs.html in this window, create a new one
      console.log(
        `No tabs.html found in window ${windowId}, opening a new one`,
      );

      // Build the URL with session parameters if this is a named session
      let tabUrl = chrome.runtime.getURL("tabs.html");
      if (associatedSession) {
        const queryParams = new URLSearchParams();
        queryParams.set("sessionId", associatedSession.id);
        if (associatedSession.name) {
          queryParams.set("sessionName", associatedSession.name);
        }
        tabUrl = `${tabUrl}?${queryParams.toString()}`;
      }

      await chrome.tabs.create({
        windowId: windowId,
        url: tabUrl,
        active: false, // Don't activate the new tab
      });
    }
  } catch (error) {
    console.error(`Error ensuring tabs.html in window ${windowId}:`, error);
    throw error; // Re-throw to allow caller to handle the error
  }
}

/**
 * Opens the tabs.html page in the current window.
 * If the current window has a named session, the tabs.html page will be opened with session parameters.
 * If tabs.html is already open in the current window, it will be focused and reloaded.
 */
export async function openTabsPage() {
  try {
    // Get the current window
    const currentWindow = await chrome.windows.getCurrent();

    // Check if this window has a named session
    const sessions = await SessionManagement.getNamedSessions();
    const currentSession = sessions.find(
      (session) => session.windowId === currentWindow.id && session.name,
    );

    // Build the URL with session parameters if this is a named session
    let tabsUrl = chrome.runtime.getURL("tabs.html");
    if (currentSession) {
      const queryParams = new URLSearchParams();
      queryParams.set("sessionId", currentSession.id);
      queryParams.set("sessionName", currentSession.name || "");
      tabsUrl = `${tabsUrl}?${queryParams.toString()}`;
      console.log(`Opening tabs.html with session parameters: ${tabsUrl}`);
    }

    // Check if tabs.html is already open in the active window
    const existingTabs = await chrome.tabs.query({
      currentWindow: true,
      url: chrome.runtime.getURL("tabs.html*"), // Use wildcard to match any tabs.html URL with query parameters
    });

    let targetTabId: number | undefined;
    if (existingTabs.length > 0) {
      // If tabs.html is already open, focus on that tab and reload it
      const existingTab = existingTabs[0];
      await chrome.windows.update(existingTab.windowId!, { focused: true });
      await chrome.tabs.update(existingTab.id!, { active: true });
      targetTabId = existingTab.id;
      console.log("Focused on existing tabs.html tab and updated it");
    } else {
      // If tabs.html is not open, create a new tab with tabs.html in pinned status.
      const newTab = await chrome.tabs.create({ url: tabsUrl, pinned: true });
      targetTabId = newTab.id;
      console.log("Created new tabs.html tab");
    }

    // TODO: check if we should use long-lived connected port or not.
    // After opening/focusing, send a message to toggle bookmarks pane
    if (targetTabId) {
      chrome.tabs.sendMessage(targetTabId, {
        type: TB_TOGGLE_BOOKMARKS_PANE,
      });
    }
  } catch (error) {
    console.error("Error opening tabs.html:", error);
  }
}

/**
 * Check if a tab URL is the extension's tabs UI
 * @param url - Tab URL to check
 * @returns true if the URL is the tabs UI
 */
export function isTabsUIUrl(url: string | undefined): boolean {
  if (!url) return false;
  // TODO: We should check if the URL is the extension's own URL.
  return url.includes("chrome-extension://") && url.includes("tabs.html");
}
