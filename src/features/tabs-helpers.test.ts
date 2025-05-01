// filepath: /home/sugarsun/public_git/hacky-helper-crx/src/features/tabs-helpers.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as TabsHelpers from "./tabs-helpers";

describe('findTabsUiInWindow', () => {
  beforeEach(() => {
    // Mock chrome.tabs.query
    global.chrome = {
      ...global.chrome,
      tabs: {
        query: vi.fn(),
      },
      runtime: {
        getURL: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns tabs matching the Tabs UI pattern', async () => {
    // Setup mock response
    const mockTabs = [
      { id: 1, url: 'chrome-extension://abcdef/tabs.html', windowId: 100 },
      { id: 2, url: 'chrome-extension://abcdef/tabs.html?sessionId=test123', windowId: 100 }
    ];
    chrome.tabs.query.mockResolvedValue(mockTabs);
    
    // Mock chrome.runtime.getURL
    chrome.runtime.getURL.mockReturnValue('chrome-extension://abcdef/tabs.html');
    
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
    // Simulate an error
    chrome.tabs.query.mockRejectedValue(new Error('Test error'));
    
    // Call the function
    const result = await TabsHelpers.findTabsUiInWindow(100);
    
    // Verify it returns an empty array on error
    expect(result).toEqual([]);
  });
});