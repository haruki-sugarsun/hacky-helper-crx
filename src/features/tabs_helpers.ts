import * as SessionManagement from "./session_management";

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

    if (existingTabs.length > 0) {
      // If tabs.html is already open, focus on that tab and reload it
      const existingTab = existingTabs[0];
      await chrome.windows.update(existingTab.windowId!, { focused: true });
      await chrome.tabs.update(existingTab.id!, { active: true });
      // Reload the tab to refresh its content with the current URL
      await chrome.tabs.update(existingTab.id!, { url: tabsUrl });
      console.log("Focused on existing tabs.html tab and updated it");
    } else {
      // If tabs.html is not open, create a new tab with tabs.html in pinned status.
      await chrome.tabs.create({ url: tabsUrl, pinned: true });
      console.log("Created new tabs.html tab");
    }
  } catch (error) {
    console.error("Error opening tabs.html:", error);
  }
}
