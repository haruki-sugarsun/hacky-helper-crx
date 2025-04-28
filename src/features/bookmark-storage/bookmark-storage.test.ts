import { describe, it, expect, beforeEach, vi } from "vitest";
import { BookmarkStorage } from "../BookmarkStorage"; // Removed BOOKMARK_PARENT_ID import
import {
  NamedSession,
  NamedSessionTab,
  SyncedTabEntity,
} from "../../lib/types";
import { CONFIG_RO } from "../config-store"; // Import CONFIG_RO
import { encodeSessionTitle, encodeTabTitle } from "./bookmark-storage-helpers"; // Import encoding functions

// Mock CONFIG_RO
vi.mock("../config-store", () => ({
  CONFIG_RO: {
    BOOKMARK_PARENT_ID: vi.fn().mockResolvedValue("test-parent-id"),
    INSTANCE_ID: vi.fn().mockResolvedValue("test-instance-id"),
  },
}));

// Mock chrome APIs
vi.mock("chrome", () => ({
  bookmarks: {
    create: vi.fn(),
    search: vi.fn(),
    getChildren: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeTree: vi.fn(),
    get: vi.fn(),
  },
  storage: {
    sync: {
      get: vi.fn(), // Keep this mock if other parts rely on it, but BookmarkStorage uses CONFIG_RO now
    },
  },
}));

describe("BookmarkStorage", () => {
  let bookmarkStorage: BookmarkStorage;
  const testParentId = "test-parent-id";
  const testSessionId = "test-session-id";
  const testSessionName = "Test Session";
  const testSession: NamedSession = {
    id: testSessionId,
    name: testSessionName,
    windowId: undefined,
    createdAt: 1678886400000, // Example timestamp
    updatedAt: 1678887400000, // Example timestamp
  };

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Configure mocks for this test suite
    vi.mocked(CONFIG_RO.BOOKMARK_PARENT_ID).mockResolvedValue(testParentId);
    vi.mocked(chrome.bookmarks.getChildren).mockResolvedValue([]); // Default: No existing session folders or bookmarks

    // Get the singleton instance
    bookmarkStorage = BookmarkStorage.getInstance();
    // Ensure initialization is complete before each test
    // Initialize might call getChildren, but shouldn't call create if getChildren returns []
    await bookmarkStorage.initialize();

    // Reset mocks specifically for create after initialization might have used them
    vi.mocked(chrome.bookmarks.create).mockClear();
    vi.mocked(chrome.bookmarks.getChildren).mockClear();
    // Set default mocks for tests after initialization
    vi.mocked(chrome.bookmarks.getChildren).mockResolvedValue([]);
  });

  it("should initialize successfully", () => {
    // Initialization is awaited in beforeEach, just check if it succeeded (no errors thrown)
    expect(bookmarkStorage).toBeDefined();
    // Check if parentFolderId was set (internal state check, might be brittle)
    // expect((bookmarkStorage as any).parentFolderId).toBe(testParentId);
  });

  it("should create a session folder with subfolders", async () => {
    const mainFolderId = "new-main-folder-id";
    const openedPagesFolderId = "new-opened-pages-id";
    const savedPagesFolderId = "new-saved-pages-id";
    const encodedTitle = encodeSessionTitle(testSession);

    // Mock the sequence of bookmark creations
    vi.mocked(chrome.bookmarks.create)
      .mockImplementationOnce(() =>
        Promise.resolve({
          id: mainFolderId,
          title: encodedTitle,
          parentId: testParentId,
        }),
      ) // Main folder
      .mockImplementationOnce(() =>
        Promise.resolve({
          id: openedPagesFolderId,
          title: "Opened Pages",
          parentId: mainFolderId,
        }),
      ) // Opened Pages subfolder
      .mockImplementationOnce(() =>
        Promise.resolve({
          id: savedPagesFolderId,
          title: "Saved Pages",
          parentId: mainFolderId,
        }),
      ); // Saved Pages subfolder

    const folder = await bookmarkStorage.createSessionFolder(testSession);

    expect(chrome.bookmarks.create).toHaveBeenCalledTimes(3);
    // Check main folder creation
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: testParentId,
      title: encodedTitle,
    });
    // Check subfolder creations (order might vary, check calls individually)
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: mainFolderId,
      title: "Opened Pages",
    });
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: mainFolderId,
      title: "Saved Pages",
    });

    expect(folder).toBeDefined();
    expect(folder.name).toBe(testSessionName); // Should store the decoded name
    expect(folder.sessionId).toBe(testSessionId);
    expect(folder.id).toBe(mainFolderId);
    expect(folder.openedPagesId).toBe(openedPagesFolderId);
    expect(folder.savedPagesId).toBe(savedPagesFolderId);
  });

  it("should save a tab to the 'Saved Pages' bookmark folder", async () => {
    const tab: NamedSessionTab = {
      tabId: 123, // Example tabId
      title: "Test Tab",
      url: "https://example.com",
      updatedAt: Date.now(),
      owner: "test-instance-id",
    };
    const savedBookmarkId = "saved-bookmark-id";
    const encodedTabTitle = encodeTabTitle(tab);
    const savedPagesFolderId = "mock-saved-pages-id"; // Assume this ID exists

    // Mock internal state or ensure createSessionFolder is called first
    (bookmarkStorage as any).sessionFolders.set(testSessionId, {
      id: "mock-main-folder-id",
      name: testSessionName,
      sessionId: testSessionId,
      openedPagesId: "mock-opened-pages-id",
      savedPagesId: savedPagesFolderId,
    });

    vi.mocked(chrome.bookmarks.create).mockImplementation(() =>
      Promise.resolve({
        id: savedBookmarkId,
        title: encodedTabTitle,
        url: tab.url,
        parentId: savedPagesFolderId,
      }),
    );

    const savedTab = await bookmarkStorage.saveTabToBookmarks(
      testSessionId,
      tab,
    );

    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: savedPagesFolderId,
      title: encodedTabTitle,
      url: tab.url,
    });
    expect(savedTab).toBeDefined();
    expect(savedTab?.id).toBe(savedBookmarkId);
    expect(savedTab?.title).toBe(tab.title); // Should return decoded title
    expect(savedTab?.url).toBe(tab.url);
    expect(savedTab?.sessionId).toBe(testSessionId);
    expect(savedTab?.owner).toBe(tab.owner);
  });

  it("should retrieve saved bookmarks for a session from 'Saved Pages' folder", async () => {
    const savedPagesFolderId = "mock-saved-pages-id";
    const bookmarkId1 = "bm1";
    const bookmarkId2 = "bm2";
    const tab1: NamedSessionTab = {
      tabId: null,
      title: "Tab 1",
      url: "https://one.com",
      updatedAt: Date.now(),
      owner: "owner1",
    };
    const tab2: NamedSessionTab = {
      tabId: null,
      title: "Tab 2",
      url: "https://two.com",
      updatedAt: Date.now(),
      owner: "owner2",
    };

    // Mock internal state
    (bookmarkStorage as any).sessionFolders.set(testSessionId, {
      id: "mock-main-folder-id",
      name: testSessionName,
      sessionId: testSessionId,
      openedPagesId: "mock-opened-pages-id",
      savedPagesId: savedPagesFolderId,
    });

    // Mock bookmarks returned for the 'Saved Pages' folder
    vi.mocked(chrome.bookmarks.getChildren).mockResolvedValue([
      {
        id: bookmarkId1,
        title: encodeTabTitle(tab1),
        url: tab1.url,
        parentId: savedPagesFolderId,
        dateAdded: Date.now(),
        dateGroupModified: Date.now(),
      },
      {
        id: bookmarkId2,
        title: encodeTabTitle(tab2),
        url: tab2.url,
        parentId: savedPagesFolderId,
        dateAdded: Date.now(),
        dateGroupModified: Date.now(),
      },
      {
        id: "bm3",
        title: "No URL Folder",
        parentId: savedPagesFolderId,
        dateAdded: Date.now(),
        dateGroupModified: Date.now(),
      }, // Should be filtered out
    ]);

    const bookmarks = await bookmarkStorage.getSavedBookmarks(testSessionId);

    expect(chrome.bookmarks.getChildren).toHaveBeenCalledWith(
      savedPagesFolderId,
    );
    expect(bookmarks).toBeInstanceOf(Array);
    expect(bookmarks).toHaveLength(2);

    // Check decoded values
    expect(bookmarks[0]).toEqual<SyncedTabEntity>({
      id: bookmarkId1,
      title: tab1.title,
      url: tab1.url!,
      sessionId: testSessionId,
      owner: tab1.owner,
    });
    expect(bookmarks[1]).toEqual<SyncedTabEntity>({
      id: bookmarkId2,
      title: tab2.title,
      url: tab2.url!,
      sessionId: testSessionId,
      owner: tab2.owner,
    });
  });

  // Add more tests for other methods like syncSessionToBookmarks, getSyncedOpenTabs, deleteSessionFolder, etc.
  // Remember to mock chrome.bookmarks.getChildren, update, remove, removeTree as needed for those tests.
});
