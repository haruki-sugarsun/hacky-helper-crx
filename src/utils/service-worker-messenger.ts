import {
  TABS_MARK_UI_OUTDATED,
  TabsUIOutdatedMessage,
} from "../messages/messages";

/**
 * Service Worker utility for sending messages to tabs UI
 * Handles communication from service worker to tabs content script
 */
export class ServiceWorkerMessenger {
  /**
   * Notify tabs UI that it should be marked as outdated
   * @param reason - Reason for marking UI as outdated
   */
  static async notifyTabsUIOutdated(reason: string): Promise<void> {
    try {
      const message: TabsUIOutdatedMessage = {
        type: TABS_MARK_UI_OUTDATED,
        reason,
        timestamp: Date.now(),
      };

      // Find tabs running the extension
      const tabs = await chrome.tabs.query({});
      const extensionTabs = tabs.filter(
        (tab) =>
          tab.url?.includes("chrome-extension://") &&
          tab.url?.includes("tabs.html"),
      );

      if (extensionTabs.length === 0) {
        console.log("ServiceWorkerMessenger: No tabs UI found to notify");
        return;
      }

      // Send message to all extension tabs
      const sendPromises = extensionTabs.map((tab) => {
        if (tab.id) {
          return chrome.tabs.sendMessage(tab.id, message).catch((error) => {
            console.warn(
              `ServiceWorkerMessenger: Failed to send message to tab ${tab.id}:`,
              error,
            );
          });
        }
      });

      await Promise.allSettled(sendPromises);
      console.log(
        `ServiceWorkerMessenger: Notified ${extensionTabs.length} tabs UI instances - ${reason}`,
      );
    } catch (error) {
      console.error(
        "ServiceWorkerMessenger: Error in notifyTabsUIOutdated:",
        error,
      );
    }
  }
}
