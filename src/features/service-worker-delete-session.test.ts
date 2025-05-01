import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as SessionManagement from "./session-management";
import * as TabsHelpers from "./tabs-helpers";
import { NamedSession } from "../lib/types";

// Mock dependencies
vi.mock("./session-management");
vi.mock("./tabs-helpers");

// Mock chrome API
vi.mock("chrome", () => ({
  tabs: {
    update: vi.fn(),
  },
}));

/**
 * Mock implementation of the DELETE_NAMED_SESSION handler for testing purposes.
 * This simulates the functionality in service-worker.ts
 */
async function handleDeleteNamedSession(
  request: { payload: { sessionId: string } },
  sendResponse: (response: any) => void,
) {
  const sessionId = request.payload.sessionId;

  // First check if session exists and is open before deletion
  const sessions = await SessionManagement.getNamedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  const isOpenSession = session && session.windowId !== undefined;
  const windowId = session?.windowId;

  // Delete the session
  await SessionManagement.deleteNamedSession(sessionId);

  // If this was an open session with a window, update any Tabs UI URLs directly
  if (isOpenSession && windowId) {
    const tabsUiTabs = await TabsHelpers.findTabsUiInWindow(windowId);

    for (const tab of tabsUiTabs) {
      if (tab.url) {
        const url = new URL(tab.url);
        const urlSessionId = url.searchParams.get("sessionId");

        if (urlSessionId === sessionId && tab.id !== undefined) {
          url.searchParams.delete("sessionId");
          await chrome.tabs.update(tab.id, { url: url.toString() });
        }
      }
    }
  }

  sendResponse({
    type: "DELETE_NAMED_SESSION_RESULT",
    payload: "success",
  });
}

describe("DELETE_NAMED_SESSION handler", () => {
  const sessionId = "test123";
  const windowId = 42;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
  });
  it("deletes session and updates URL when conditions are met", async () => {
    // Mock session data
    vi.mocked(SessionManagement.getNamedSessions).mockResolvedValue([
      {
        id: sessionId,
        windowId: windowId,
        name: "Test Session",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    // Mock tabs
    const mockTabs = [
      {
        id: 1,
        url: `chrome-extension://abcdef/tabs.html?sessionId=${sessionId}&otherParam=value`,
        windowId: windowId,
      },
    ];
    vi.mocked(TabsHelpers.findTabsUiInWindow).mockResolvedValue(
      mockTabs as chrome.tabs.Tab[],
    );

    // Mock chrome.tabs.update
    vi.mocked(chrome.tabs.update).mockImplementation(() => Promise.resolve());

    // Mock sendResponse
    const sendResponse = vi.fn();

    // Call the handler
    await handleDeleteNamedSession({ payload: { sessionId } }, sendResponse);

    // Verify session was deleted
    expect(SessionManagement.deleteNamedSession).toHaveBeenCalledWith(
      sessionId,
    );

    // Verify tabs were searched
    expect(TabsHelpers.findTabsUiInWindow).toHaveBeenCalledWith(windowId);

    // Verify URL was updated properly
    expect(chrome.tabs.update).toHaveBeenCalledWith(1, {
      url: "chrome-extension://abcdef/tabs.html?otherParam=value",
    });

    // Verify response was sent
    expect(sendResponse).toHaveBeenCalledWith({
      type: "DELETE_NAMED_SESSION_RESULT",
      payload: "success",
    });
  });

  it("does not update URL when session is not open", async () => {
    // Mock a closed session (no windowId)
    vi.mocked(SessionManagement.getNamedSessions).mockResolvedValue([
      {
        id: sessionId,
        windowId: undefined,
        name: "Closed Session",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as NamedSession,
    ]);

    // Mock sendResponse
    const sendResponse = vi.fn();

    // Call the handler
    await handleDeleteNamedSession({ payload: { sessionId } }, sendResponse);

    // Verify session was deleted
    expect(SessionManagement.deleteNamedSession).toHaveBeenCalledWith(
      sessionId,
    );

    // Verify tabs were NOT searched
    expect(TabsHelpers.findTabsUiInWindow).not.toHaveBeenCalled();

    // Verify URL was NOT updated
    expect(chrome.tabs.update).not.toHaveBeenCalled();

    // Verify response was sent
    expect(sendResponse).toHaveBeenCalledWith({
      type: "DELETE_NAMED_SESSION_RESULT",
      payload: "success",
    });
  });

  it("does not update URL when sessionId does not match", async () => {
    // Setup mocks
    const sessionId = "test123";
    const windowId = 100;

    // Mock session data with window
    vi.mocked(SessionManagement.getNamedSessions).mockResolvedValue([
      {
        id: sessionId,
        windowId: windowId,
        name: "Test Session",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as NamedSession,
    ]);

    // Mock tabs with DIFFERENT sessionId
    const mockTabs = [
      {
        id: 1,
        url: "chrome-extension://abcdef/tabs.html?sessionId=different-id",
        windowId: windowId,
      },
    ];
    vi.mocked(TabsHelpers.findTabsUiInWindow).mockResolvedValue(
      mockTabs as chrome.tabs.Tab[],
    );

    const sendResponse = vi.fn();

    // Call the handler
    await handleDeleteNamedSession({ payload: { sessionId } }, sendResponse);

    // Verify session was deleted
    expect(SessionManagement.deleteNamedSession).toHaveBeenCalledWith(
      sessionId,
    );

    // Verify tabs were searched
    expect(TabsHelpers.findTabsUiInWindow).toHaveBeenCalledWith(windowId);

    // Verify URL was NOT updated (because sessionId doesn't match)
    expect(chrome.tabs.update).not.toHaveBeenCalled();

    // Verify response was sent
    expect(sendResponse).toHaveBeenCalledWith({
      type: "DELETE_NAMED_SESSION_RESULT",
      payload: "success",
    });
  });
});
