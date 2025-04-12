// Helper functions for session management

import { NamedSessionTab } from "../../lib/types";

/**
 * Converts an array of chrome.tabs.Tab objects to an array of NamedSessionTab.
 *
 * @param tabs - Array of chrome.tabs.Tab objects.
 * @param currentInstanceId - Optional identifier for the current instance; defaults to "current" if not provided.
 * @returns An array of NamedSessionTab objects.
 */
export function convertTabsToNamedSessionTabs(
  tabs: chrome.tabs.Tab[],
  currentInstanceId: string,
): NamedSessionTab[] {
  return tabs.map((tab) => ({
    tabId: tab.id || null,
    title: tab.title || "Untitled",
    url: tab.url || "",
    updatedAt: Date.now(),
    owner: currentInstanceId,
  }));
}
