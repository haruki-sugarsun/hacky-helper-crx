import { ConfigStore } from "./config-store.ts";

console.log("tab_organizer");

/**
 * Reorders tabs in the current window alphabetically by URL.
 * Pinned tabs are ignored and remain in their original positions.
 */
async function reorderTabsAlphabetically(): Promise<void> {
  try {
    // Get all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Separate pinned and non-pinned tabs
    const pinnedTabs = tabs.filter((tab) => tab.pinned);
    const nonPinnedTabs = tabs.filter((tab) => !tab.pinned);

    // Sort non-pinned tabs alphabetically by URL
    nonPinnedTabs.sort((a, b) => {
      if (!a.url) return -1;
      if (!b.url) return 1;
      return a.url.localeCompare(b.url);
    });

    // Move each tab to its new position
    // Start after the last pinned tab
    const startIndex = pinnedTabs.length;

    // Move each non-pinned tab to its sorted position
    for (let i = 0; i < nonPinnedTabs.length; i++) {
      const tab = nonPinnedTabs[i];
      if (tab.id) {
        await chrome.tabs.move(tab.id, { index: startIndex + i });
      }
    }

    console.log("Tabs reordered alphabetically by URL");
  } catch (error) {
    console.error("Error reordering tabs:", error);
  }
}

//

// State management:
let lastSelectedTabId: number | null = null;

// TODO: Register this in the service-worker.ts, and call the implrmentation from that.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log("Tab selected:", activeInfo.tabId);

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const leftMostTab = tabs[0];
  const rightMostTab = tabs[tabs.length - 1];

  if (
    activeInfo.tabId === leftMostTab.id &&
    lastSelectedTabId === rightMostTab.id
  ) {
    console.log("Switched from the right-most to the left-most tab");
    // Call your function here
    if (await ConfigStore.SORT_ON_TAB_SWITCH.get()) {
      console.log("triggering tab reordering.");
      await reorderTabsAlphabetically();
    }
  } else if (activeInfo.tabId === leftMostTab.id) {
    console.log("Switched to the left-most tab");
    // Call your function here
  } else if (activeInfo.tabId === rightMostTab.id) {
    console.log("Switched to the right-most tab");
    // Call your function here
  }

  lastSelectedTabId = activeInfo.tabId;
});
