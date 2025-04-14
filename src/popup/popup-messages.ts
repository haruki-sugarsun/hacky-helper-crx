/**
 * @file popup-messages.ts
 *
 * Provides functions to handle popup interactions for the Hacky Helper Chrome extension.
 * Specifically, it handles messages such as copy-page-info.
 *
 * Captain Nova advises: "Don't Panic" and let the popup handle its own business.
 */

// Caller part.
export function triggerCopyPageInfo() {
  // Check if a popup view is already open.
  // We assume this is called by service-worker, and need to openPopup() in any situation.
  // TODO: Can it be rewritten to use promise+await?
  chrome.action.openPopup(() => {
    // After opening, send the message.
    // TODO: Have a constant for `copyPageInfo` and rename it to something more consistent. e.g. POPUP_COPY_PAGE_INFO ?
    chrome.runtime.sendMessage({ popup_action: "copyPageInfo", params: {} });
  });
}

// Handler part
export function handleMessages(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  if (message.popup_action === "copyPageInfo") {
    copyPageInfo(sendResponse);
    return true;
  }
  return false;
}

// Function to copy page info by retrieving the active tab's title and URL
// TODO: Use the shared definition of Success/Error Results.
function copyPageInfo(sendResponse: (response?: any) => void) {
  // TODO: Show a toast in Popup UI.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      const title = activeTab.title || "";
      const url = activeTab.url || "";
      const textToCopy = `${title} - ${url}`;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          console.log("Page info copied successfully:", textToCopy);
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error("Failed to copy page info:", err);
          sendResponse({ success: false, error: err });
        });
    } else {
      sendResponse({ success: false, error: "No active tab found" });
    }
  });
}
