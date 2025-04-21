import * as session from "./session-management";
import { takeoverTab } from "./session-management";
import * as BookmarkStorage from "./BookmarkStorage";
import { chrome } from "jest-chrome";

// Mock config-store
jest.mock("./config-store", () => ({
  CONFIG_RO: {
    INSTANCE_ID: jest.fn().mockResolvedValue("test-instance-id"),
  },
}));

// Create a complete mock instance with all required properties
const mockBookmarkStorage = {
  getSyncedOpenTabs: jest.fn(),
  updateTabOwner: jest.fn(),
  initialize: jest.fn().mockResolvedValue(true),
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
  parentFolderId: "mock-parent-folder-id", // Add required property
};

// Mock the static getInstance method to return our mock with correct type assertion
BookmarkStorage.BookmarkStorage.getInstance = jest.fn(
  () => mockBookmarkStorage as unknown as BookmarkStorage.BookmarkStorage,
);

// Setup chrome mocks before tests
beforeAll(() => {
  // Use jest.spyOn instead of direct assignment for read-only properties
  jest
    .spyOn(chrome.tabs, "query")
    .mockImplementation(() => Promise.resolve([]));
  jest
    .spyOn(chrome.tabs, "update")
    .mockImplementation(() => Promise.resolve({} as chrome.tabs.Tab));
  jest
    .spyOn(chrome.tabs, "create")
    .mockImplementation(() => Promise.resolve({} as chrome.tabs.Tab));

  // Set up chrome storage mock
  chrome.storage = {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  } as any;

  // Assign chrome mock to global
  global.chrome = chrome as any;
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
  // Fix the TypeScript error by declaring chrome as optional on the global object
  (global as { chrome?: any }).chrome = undefined;
});

describe("Session Management Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should load the session management module without errors", () => {
    expect(session).toBeDefined();
  });
});

describe("takeoverTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default behaviors with proper typing
    (chrome.tabs.query as jest.Mock).mockResolvedValue([]);
    (chrome.tabs.update as jest.Mock).mockResolvedValue({
      id: 999,
      url: "",
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    } as chrome.tabs.Tab);

    (chrome.tabs.create as jest.Mock).mockResolvedValue({
      id: 999,
      url: "",
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    } as chrome.tabs.Tab);
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

    // Setup the mock response
    mockBookmarkStorage.getSyncedOpenTabs.mockResolvedValue(mockSyncedTabs);

    // No existing tabs in current window
    (chrome.tabs.query as jest.Mock).mockImplementation((query) => {
      if (query.url === "https://example.com") {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    await takeoverTab("test-tab-id", "test-session-id");

    expect(mockBookmarkStorage.getSyncedOpenTabs).toHaveBeenCalledWith(
      "test-session-id",
    );
    expect(mockBookmarkStorage.updateTabOwner).toHaveBeenCalledWith(
      "test-tab-id",
      expect.objectContaining({ owner: expect.any(String) }),
    );
  });

  it("should throw an error if the tab is not found", async () => {
    // Empty array means no tabs found
    mockBookmarkStorage.getSyncedOpenTabs.mockResolvedValue([]);

    await expect(
      takeoverTab("non-existent-tab-id", "test-session-id"),
    ).rejects.toThrow("Tab with ID non-existent-tab-id not found.");
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

    mockBookmarkStorage.getSyncedOpenTabs.mockResolvedValue(mockSyncedTabs);

    // Mock an error for updateTabOwner
    mockBookmarkStorage.updateTabOwner.mockRejectedValue(
      new Error("Update failed"),
    );

    // No existing tabs in current window
    (chrome.tabs.query as jest.Mock).mockImplementation((query) => {
      if (query.url === "https://example.com") {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    await expect(takeoverTab("test-tab-id", "test-session-id")).rejects.toThrow(
      "Update failed",
    );
  });

  it("should focus on an existing tab if the URL is already open", async () => {
    const mockSyncedTabs = [
      {
        id: "test-tab-id",
        url: "https://example.com",
        owner: "other-instance",
        title: "Test Tab",
        sessionId: "test-session-id",
      },
    ];

    mockBookmarkStorage.getSyncedOpenTabs.mockResolvedValue(mockSyncedTabs);

    // Create a complete mock tab response with all required properties
    const mockExistingTab = {
      id: 123,
      url: "https://example.com",
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: false,
      incognito: false,
      title: "Test Tab",
      selected: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    } as chrome.tabs.Tab;

    // Setup jest mock responses for an existing tab
    (chrome.tabs.query as jest.Mock).mockImplementation((query) => {
      if (query.url === "https://example.com") {
        return Promise.resolve([mockExistingTab]);
      }
      return Promise.resolve([]);
    });

    (chrome.tabs.update as jest.Mock).mockImplementation(
      (tabId, updateProps) => {
        if (tabId === 123 && updateProps.active === true) {
          return Promise.resolve({
            ...mockExistingTab,
            active: true,
          } as chrome.tabs.Tab);
        }
        return Promise.resolve({} as chrome.tabs.Tab);
      },
    );

    await takeoverTab("test-tab-id", "test-session-id");

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      url: "https://example.com",
    });
    expect(chrome.tabs.update).toHaveBeenCalledWith(123, { active: true });

    // The function returns early when focusing an existing tab, so updateTabOwner should NOT be called
    expect(mockBookmarkStorage.updateTabOwner).not.toHaveBeenCalled();
  });
});
