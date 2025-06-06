import {
  TABS_MARK_UI_OUTDATED,
  TabsUIOutdatedMessage,
} from "../messages/messages";
import { isTabsUIUrl } from "../features/tabs-helpers";

/**
 * Service Worker utility for sending messages to tabs UI
 * Handles communication from service worker to tabs content script
 */
export class ServiceWorkerMessenger {
  /**
   * Notify tabs UI that it should be marked as outdated
   * @param reason - Reason for marking UI as outdated
   * @param sourceTabUrl - Optional URL of the tab that triggered the update (to avoid self-notification)
   */
  static async notifyTabsUIOutdated(
    reason: string,
    sourceTabUrl?: string,
  ): Promise<void> {
    try {
      // Skip notification if the source tab is the tabs UI itself
      if (sourceTabUrl && isTabsUIUrl(sourceTabUrl)) {
        console.log(
          "ServiceWorkerMessenger: Skipping notification for tabs UI self-update",
        );
        return;
      }

      const message: TabsUIOutdatedMessage = {
        type: TABS_MARK_UI_OUTDATED,
        reason,
        timestamp: Date.now(),
      };

      // Find tabs running the extension
      const tabs = await chrome.tabs.query({});
      const extensionTabs = tabs.filter((tab) => isTabsUIUrl(tab.url));

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
