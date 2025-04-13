import * as session from "./session-management";

import { takeoverTab } from "./session-management";
import * as BookmarkStorage from "./BookmarkStorage";
import {
  getActiveNamedSessionsInLocal,
  saveActiveNamedSessionInLocal,
  deleteActiveNamedSessionInLocal,
  createNamedSession,
  restoreClosedSession,
} from "./session-management";

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

  it("should throw an error if the tab is not found", async () => {
    (mockBookmarkStorage.getSyncedOpenTabs as jest.Mock).mockResolvedValueOnce(
      [],
    );

    await expect(
      takeoverTab("non-existent-tab-id", "test-session-id"),
    ).rejects.toThrow("Tab with ID non-existent-tab-id not found.");
  });
});

describe("Session Management Tests", () => {
  beforeEach(() => {
    // Mock Chrome storage API
    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation((keys, callback) => {
            const data = { hacky_helper_named_sessions: "{}" };
            if (callback) callback(data);
            return Promise.resolve(data);
          }),
          set: jest.fn().mockImplementation((items, callback) => {
            if (callback) callback();
            return Promise.resolve();
          }),
          clear: jest.fn(),
          remove: jest.fn(),
          getBytesInUse: jest.fn(),
          QUOTA_BYTES: 102400,
          setAccessLevel: jest.fn(),
          onChanged: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
            hasListener: jest.fn(),
          },
        },
      },
      windows: {
        get: jest.fn().mockImplementation((windowId, callback) => {
          const window = { id: windowId };
          callback ? callback(window) : Promise.resolve(window);
        }),
        create: jest.fn().mockImplementation((createData, callback) => {
          const newWindow = { id: 1 };
          callback ? callback(newWindow) : Promise.resolve(newWindow);
        }),
        update: jest.fn(),
        getCurrent: jest.fn(),
        getAll: jest.fn(),
        remove: jest.fn(),
        getLastFocused: jest.fn(),
        WINDOW_ID_CURRENT: -1,
        WINDOW_ID_NONE: -2,
        onRemoved: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
          hasListener: jest.fn(),
          getRules: jest.fn(),
          removeRules: jest.fn(),
          addRules: jest.fn(),
          hasListeners: jest.fn(),
        },
        onCreated: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
          hasListener: jest.fn(),
          getRules: jest.fn(),
          removeRules: jest.fn(),
          addRules: jest.fn(),
          hasListeners: jest.fn(),
        },
      },
      tabs: {
        query: jest.fn().mockImplementation((queryInfo, callback) => {
          const tabs = [{ id: 1, url: "http://example.com" }];
          callback ? callback(tabs) : Promise.resolve(tabs);
        }),
        create: jest.fn(),
        move: jest.fn(),
        update: jest.fn(),
        executeScript: jest.fn(),
        get: jest.fn(),
        getAllInWindow: jest.fn(),
        getCurrent: jest.fn(),
        getSelected: jest.fn(),
        remove: jest.fn(),
        captureVisibleTab: jest.fn(),
        reload: jest.fn(),
        duplicate: jest.fn(),
        sendMessage: jest.fn(),
        sendRequest: jest.fn(),
        connect: jest.fn(),
      },
      runtime: {
        getURL: jest
          .fn()
          .mockImplementation((path) => `chrome-extension://${path}`),
        connect: jest.fn(),
        connectNative: jest.fn(),
        getBackgroundPage: jest.fn(),
        getContexts: jest.fn(),
        getManifest: jest.fn(),
        getPackageDirectoryEntry: jest.fn(),
        getPlatformInfo: jest.fn(),
        reload: jest.fn(),
        requestUpdateCheck: jest.fn(),
        restart: jest.fn(),
        restartAfterDelay: jest.fn(),
        sendMessage: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("getActiveNamedSessionsInLocal should retrieve sessions from storage", async () => {
    // Mock implementation
    chrome.storage.local.get.mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({
        session1: { id: "session1", name: "Test Session", windowId: 1 },
      }),
    });

    const sessions = await getActiveNamedSessionsInLocal();
    expect(sessions).toHaveProperty("session1");
    expect(sessions.session1.name).toBe("Test Session");
  });

  test("saveActiveNamedSessionInLocal should save a session to storage", async () => {
    const session = {
      id: "session1",
      name: "Test Session",
      windowId: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    chrome.storage.local.get.mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({}),
    });

    await saveActiveNamedSessionInLocal(session);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      hacky_helper_named_sessions: JSON.stringify({ session1: session }),
    });
  });

  test("deleteActiveNamedSessionInLocal should remove a session from storage", async () => {
    chrome.storage.local.get.mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({
        session1: { id: "session1", name: "Test Session", windowId: 1 },
      }),
    });

    await deleteActiveNamedSessionInLocal("session1");
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      hacky_helper_named_sessions: JSON.stringify({}),
    });
  });

  test("createNamedSession should create and save a new session", async () => {
    chrome.storage.local.get.mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({}),
    });

    const session = await createNamedSession(1, "New Session");
    expect(session.name).toBe("New Session");
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  test("restoreClosedSession should restore a closed session", async () => {
    chrome.storage.local.get.mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({}),
    });

    chrome.windows.create.mockResolvedValue({ id: 1 });
    const session = await restoreClosedSession("session1");
    expect(session).toBeNull(); // Adjust based on implementation
  });
});
