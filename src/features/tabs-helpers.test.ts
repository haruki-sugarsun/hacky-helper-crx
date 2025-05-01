import { describe, it, expect, vi, beforeEach } from "vitest";
import * as TabsHelpers from "./tabs-helpers";

// Mock the chrome API before imports
vi.mock("chrome", () => ({
  tabs: {
    query: vi.fn(),
  },
  runtime: {
    getURL: vi.fn(),
  },
  windows: {
    getCurrent: vi.fn(),
  },
}));

describe("findTabsUiInWindow", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
  });

  it("returns tabs matching the Tabs UI pattern", async () => {
    // TODO: We may consider having a util method for mocking some typical values.
    // Setup mock response with all required Tab properties
    const mockTabs = [
      {
        id: 1,
        url: "chrome-extension://abcdef/tabs.html",
        windowId: 100,
        index: 0,
        pinned: false,
        highlighted: false,
        active: false,
        title: "Tabs",
        favIconUrl: "",
        status: "complete",
        discarded: false,
        incognito: false,
        width: 800,
        height: 600,
        groupId: -1,
        // Add missing properties
        selected: false,
        autoDiscardable: true,
      },
      {
        id: 2,
        url: "chrome-extension://abcdef/tabs.html?sessionId=test123",
        windowId: 100,
        index: 1,
        pinned: false,
        highlighted: false,
        active: false,
        title: "Tabs with Session",
        favIconUrl: "",
        status: "complete",
        discarded: false,
        incognito: false,
        width: 800,
        height: 600,
        groupId: -1,
        selected: false,
        autoDiscardable: true,
      },
    ] as chrome.tabs.Tab[];

    // Mock getURL to return a specific URL pattern
    const urlPattern = "chrome-extension://abcdef/tabs.html*";
    vi.mocked(chrome.runtime.getURL).mockReturnValue(urlPattern);

    // Set up the mock implementation for query
    vi.mocked(chrome.tabs.query).mockResolvedValue(mockTabs);

    // Call the function
    const result = await TabsHelpers.findTabsUiInWindow(100);

    // Verify results
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      windowId: 100,
      url: urlPattern,
    });
    expect(result).toEqual(mockTabs);
  });

  it("returns empty array on error", async () => {
    const testWindowId = 100; // Define test window ID clearly

    // Mock getURL to return a specific URL
    const urlPattern = "chrome-extension://abcdef/tabs.html*";
    vi.mocked(chrome.runtime.getURL).mockReturnValue(urlPattern);

    // Simulate an error
    vi.mocked(chrome.tabs.query).mockRejectedValue(new Error("Test error"));

    // Call the function
    const result = await TabsHelpers.findTabsUiInWindow(testWindowId);

    // Verify it returns an empty array on error
    expect(result).toEqual([]);
  });
});
