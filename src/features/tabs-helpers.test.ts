import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as TabsHelpers from "./tabs-helpers";

// Mock the chrome API before imports
vi.mock('chrome', () => ({
  tabs: {
    query: vi.fn(),
  },
  runtime: {
    getURL: vi.fn(),
  },
}), { virtual: true });

describe('findTabsUiInWindow', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });

  it('returns tabs matching the Tabs UI pattern', async () => {
    // Setup mock response
    const mockTabs = [
      { id: 1, url: 'chrome-extension://abcdef/tabs.html', windowId: 100 },
      { id: 2, url: 'chrome-extension://abcdef/tabs.html?sessionId=test123', windowId: 100 }
    ];
    
    // Mock getURL to return a specific URL
    const baseUrl = 'chrome-extension://abcdef/tabs.html*';
    vi.mocked(chrome.runtime.getURL).mockReturnValue(baseUrl);
    
    // Set up the mock implementation for query
    vi.mocked(chrome.tabs.query).mockResolvedValue(mockTabs);
    
    // Call the function
    const result = await TabsHelpers.findTabsUiInWindow(100);
    
    // Verify results
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      windowId: 100,
      url: 'chrome-extension://abcdef/tabs.html*'
    });
    expect(result).toEqual(mockTabs);
  });

  it('returns empty array on error', async () => {
    // Mock getURL to return a specific URL
    const baseUrl = 'chrome-extension://abcdef/tabs.html';
    vi.mocked(chrome.runtime.getURL).mockReturnValue(baseUrl);
    
    // Simulate an error
    vi.mocked(chrome.tabs.query).mockRejectedValue(new Error('Test error'));
    
    // Call the function
    const result = await TabsHelpers.findTabsUiInWindow(100);
    
    // Verify it returns an empty array on error
    expect(result).toEqual([]);
  });
});