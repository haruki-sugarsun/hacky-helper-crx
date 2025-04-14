import * as session from "./session-management";

import { takeoverTab } from "./session-management";
import * as BookmarkStorage from "./BookmarkStorage";

jest.mock("./BookmarkStorage");

describe("Session Management Module", () => {
  it("should load the session management module without errors", () => {
    expect(session).toBeDefined();
  });
});

describe("takeoverTab", () => {
  const mockBookmarkStorage = {
    getSyncedOpenTabs: jest.fn(),
    updateTabOwner: jest.fn(),
    initialize: jest.fn(),
    syncSessionToBookmarks: jest.fn(),
    syncOpenedPagesForSession: jest.fn(),
    getSavedBookmarks: jest.fn(),
    getClosedNamedSessions: jest.fn(),
    createSessionFolder: jest.fn(),
    getSession: jest.fn(),
    deleteSessionFolder: jest.fn(),
    saveTabToBookmarks: jest.fn(),
    sessionFolders: new Map(),
    initialized: true,
    loadSessionFolders: jest.fn(),
    syncOpenedPages: jest.fn(),
  } as unknown as BookmarkStorage.BookmarkStorage;

  jest
    .spyOn(BookmarkStorage.BookmarkStorage, "getInstance")
    .mockReturnValue(mockBookmarkStorage as BookmarkStorage.BookmarkStorage);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully take over a tab", async () => {
    const mockSyncedTabs = [
      {
        id: "test-tab-id",
        url: "https://example.com",
        owner: "other-instance",
        title: "Test Tab",
        sessionId: "test-session-id",
      },
    ];
    (mockBookmarkStorage.getSyncedOpenTabs as jest.Mock).mockResolvedValueOnce(
      mockSyncedTabs,
    );

    await takeoverTab("test-tab-id", "test-session-id");

    expect(mockBookmarkStorage.getSyncedOpenTabs).toHaveBeenCalled();
    expect(mockBookmarkStorage.updateTabOwner).toHaveBeenCalledWith(
      "test-tab-id",
      expect.objectContaining({ owner: expect.any(String) }),
    );
  });

  it("should throw an error if the tab is not found", async () => {
    (mockBookmarkStorage.getSyncedOpenTabs as jest.Mock).mockResolvedValueOnce(
      [],
    );

    await expect(takeoverTab("non-existent-tab-id", "test-session-id")).rejects.toThrow(
      "Tab with ID non-existent-tab-id not found.",
    );
  });

  it("should throw an error if updating the tab owner fails", async () => {
    const mockSyncedTabs = [
      {
        id: "test-tab-id",
        url: "https://example.com",
        owner: "other-instance",
        title: "Test Tab",
        sessionId: "test-session-id",
      },
    ];
    (mockBookmarkStorage.getSyncedOpenTabs as jest.Mock).mockResolvedValueOnce(
      mockSyncedTabs,
    );
    (mockBookmarkStorage.updateTabOwner as jest.Mock).mockRejectedValueOnce(
      new Error("Update failed"),
    );

    await expect(takeoverTab("test-tab-id", "test-session-id")).rejects.toThrow("Update failed");
  });
});
