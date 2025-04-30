/**
 * Opens the Chrome extension's side panel.
 */
export async function openSidePanel(): Promise<void> {
  try {
    const currentWindow = await chrome.windows.getCurrent({ populate: false });
    const windowId = currentWindow.id;
    if (windowId === undefined) {
      console.error("Failed to detect the current window.");
      return;
    }
    await chrome.sidePanel.open({ windowId });
    console.log("Side panel opened successfully.");
  } catch (e: any) {
    console.error("Failed to open side panel:", e.message || e);
  }
}
