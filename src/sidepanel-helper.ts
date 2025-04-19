/**
 * Opens the Chrome extension's side panel.
 */
export function openSidePanel(): void {
  // TODO: rewrite this to use promise instead of callback
  chrome.windows.getCurrent({ populate: false }, (currentWindow) => {
    if (currentWindow && currentWindow.id !== undefined) {
      chrome.sidePanel.open({ windowId: currentWindow.id }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to open side panel:",
            chrome.runtime.lastError.message,
          );
        } else {
          console.log("Side panel opened successfully.");
        }
      });
    } else {
      console.error("Failed to detect the current window.");
    }
  });
}
