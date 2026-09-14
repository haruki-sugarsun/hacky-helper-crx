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

/**
 * Display the result of a copy action without interrupting the popup.
 * The element is created here so the same message handler works when the
 * popup is opened by a keyboard shortcut as well as by a mouse click.
 */
export function showCopyPageInfoToast(
  message: string,
  type: "success" | "error" = "success",
  duration = 2500,
) {
  const existingToast = document.getElementById("copy-page-info-toast");
  existingToast?.remove();

  const toast = document.createElement("div");
  toast.id = "copy-page-info-toast";
  toast.className = `copy-page-info-toast ${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  toast.textContent = message;
  document.body.appendChild(toast);

  window.setTimeout(() => toast.remove(), duration);
}

// Function to copy page info by retrieving the active tab's title and URL
// TODO: Use the shared definition of Success/Error Results.
function copyPageInfo(sendResponse: (response?: any) => void) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const activeTab = tabs[0];
      const title = activeTab.title || "";
      const url = activeTab.url || "";
      const textToCopy = `${title} - ${url}`;
      Promise.resolve()
        .then(() => navigator.clipboard.writeText(textToCopy))
        .then(() => {
          console.log("Page info copied successfully:", textToCopy);
          showCopyPageInfoToast("Page title and URL copied");
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error("Failed to copy page info:", err);
          showCopyPageInfoToast("Could not copy page title and URL", "error");
          sendResponse({ success: false, error: err });
        });
    } else {
      showCopyPageInfoToast("Could not find an active tab", "error");
      sendResponse({ success: false, error: "No active tab found" });
    }
  });
}
