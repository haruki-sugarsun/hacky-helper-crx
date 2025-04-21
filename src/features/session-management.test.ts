import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  test,
  vi,
} from "vitest";
import * as session from "./session-management";

// TODO: We expose unintended internal methods as well. Refactor to hide them properly.
import {
  takeoverTab,
  getActiveNamedSessionsInLocal,
  saveActiveNamedSessionInLocal,
  deleteActiveNamedSessionInLocal,
  createNamedSession,
  restoreClosedSession,
} from "./session-management";
import * as BookmarkStorage from "./BookmarkStorage";

// Mock config-store using vi.mock
vi.mock("./config-store", () => ({
  CONFIG_RO: {
    INSTANCE_ID: vi.fn().mockResolvedValue("test-instance-id"),
  },
}));

// Create a complete mock instance with all required properties using vi.fn
const mockBookmarkStorage = {
  getSyncedOpenTabs: vi.fn().mockResolvedValue([]),
  updateTabOwner: vi.fn().mockResolvedValue(undefined),
  initialize: vi.fn().mockResolvedValue(true),
  syncSessionToBookmarks: vi.fn().mockResolvedValue(undefined),
  syncOpenedPagesForSession: vi.fn().mockResolvedValue(undefined),
  getSavedBookmarks: vi.fn().mockResolvedValue([]),
  getClosedNamedSessions: vi.fn().mockResolvedValue([]),
  createSessionFolder: vi.fn().mockResolvedValue("mock-folder-id"),
  getSession: vi.fn().mockResolvedValue(null),
  deleteSessionFolder: vi.fn().mockResolvedValue(undefined),
  saveTabToBookmarks: vi.fn().mockResolvedValue(null),
  sessionFolders: new Map(),
  initialized: true,
  loadSessionFolders: vi.fn().mockResolvedValue(undefined),
  syncOpenedPages: vi.fn().mockResolvedValue(undefined),
  parentFolderId: "mock-parent-folder-id", // Add required property
};

// Mock the static getInstance method to return our mock with correct type assertion
BookmarkStorage.BookmarkStorage.getInstance = vi.fn(
  () => mockBookmarkStorage as unknown as BookmarkStorage.BookmarkStorage,
);

// Remove beforeAll block - mocks are handled by setupTests.ts and vitest-chrome

// Clean up after all tests using vi.restoreAllMocks
afterAll(() => {
  vi.restoreAllMocks();
  // Clearing global.chrome might not be necessary with Vitest's environment management
  // (global as { chrome?: any }).chrome = undefined;
});

describe("Session Management Module", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Use vi.clearAllMocks
  });

  it("should load the session management module without errors", () => {
    expect(session).toBeDefined();
  });
});

describe("takeoverTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default behaviors with proper typing using vi.mocked
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
    // chrome.tabs.update returns the updated tab
    vi.mocked(chrome.tabs.update).mockResolvedValue({
      id: 123,
      url: "https://example.com",
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      incognito: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
      status: "complete",
      favIconUrl: "",
    } as chrome.tabs.Tab);

    vi.mocked(chrome.tabs.create).mockResolvedValue({
      id: 999,
      url: "",
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      incognito: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
      status: "complete",
      favIconUrl: "",
    } as chrome.tabs.Tab);
  });

  it("should create a new tab if no existing tab matches the URL", async () => {
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

    vi.mocked(chrome.tabs.query).mockResolvedValue([]); // No matching tabs

    await takeoverTab("test-tab-id", "test-session-id");

    expect(mockBookmarkStorage.getSyncedOpenTabs).toHaveBeenCalledWith(
      "test-session-id",
    );
    expect(mockBookmarkStorage.updateTabOwner).toHaveBeenCalledWith(
      "test-tab-id",
      expect.objectContaining({ owner: expect.any(String) }),
    );
    // Check if chrome.tabs.create was called because no existing tab was found
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://example.com",
    });
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
    mockBookmarkStorage.getSyncedOpenTabs.mockResolvedValueOnce(mockSyncedTabs);

    await takeoverTab("test-tab-id", "test-session-id");

    expect(mockBookmarkStorage.getSyncedOpenTabs).toHaveBeenCalled();
    expect(mockBookmarkStorage.updateTabOwner).toHaveBeenCalledWith(
      "test-tab-id",
      expect.objectContaining({ owner: expect.any(String) }),
    );
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
    (mockBookmarkStorage.getSyncedOpenTabs as vi.Mock).mockResolvedValueOnce(
      mockSyncedTabs,
    );

    await takeoverTab("test-tab-id", "test-session-id");

    expect(mockBookmarkStorage.getSyncedOpenTabs).toHaveBeenCalled();
    expect(mockBookmarkStorage.updateTabOwner).toHaveBeenCalledWith(
      "test-tab-id",
      expect.objectContaining({ owner: expect.any(String) }),
    );
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
    (mockBookmarkStorage.getSyncedOpenTabs as vi.Mock).mockResolvedValueOnce(
      mockSyncedTabs,
    );

    await takeoverTab("test-tab-id", "test-session-id");

    expect(mockBookmarkStorage.getSyncedOpenTabs).toHaveBeenCalled();
    expect(mockBookmarkStorage.updateTabOwner).toHaveBeenCalledWith(
      "test-tab-id",
      expect.objectContaining({ owner: expect.any(String) }),
    );
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
    (mockBookmarkStorage.getSyncedOpenTabs as vi.Mock).mockResolvedValueOnce(
      mockSyncedTabs,
    );
    mockBookmarkStorage.updateTabOwner.mockRejectedValueOnce(
      new Error("Update failed"),
    );

    await expect(takeoverTab("test-tab-id", "test-session-id")).rejects.toThrow(
      "Update failed",
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

    mockBookmarkStorage.getSyncedOpenTabs.mockResolvedValue(mockSyncedTabs);

    // Mock an error for updateTabOwner
    mockBookmarkStorage.updateTabOwner.mockRejectedValue(
      new Error("Update failed"),
    );

    // No existing tabs in current window
    vi.mocked(chrome.tabs.query).mockImplementation(async (query) => {
      if (query.url === "https://example.com") {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    await expect(takeoverTab("test-tab-id", "test-session-id")).rejects.toThrow(
      "Update failed",
    );
    // Check if chrome.tabs.create was called even though owner update failed later
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://example.com",
    });
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
    (mockBookmarkStorage.getSyncedOpenTabs as vi.Mock).mockResolvedValueOnce(
      mockSyncedTabs,
    );
    (mockBookmarkStorage.updateTabOwner as vi.Mock).mockRejectedValueOnce(
      new Error("Update failed"),
    );

    await expect(takeoverTab("test-tab-id", "test-session-id")).rejects.toThrow(
      "Update failed",
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

    await expect(takeoverTab("test-tab-id", "test-session-id")).rejects.toThrow(
      "Update failed",
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

    const mockExistingTab = {
      id: 123,
      url: "https://example.com",
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: false,
      incognito: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
      status: "complete",
      favIconUrl: "",
    } as chrome.tabs.Tab;

    vi.mocked(chrome.tabs.query).mockResolvedValue([mockExistingTab]);

    // TODO: Consider replacing these with more general solution.
    // Create a complete mock tab that satisfies the chrome.tabs.Tab interface
    const mockExistingTabs = [
      {
        id: 123,
        url: "https://example.com",
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
      },
    ] as chrome.tabs.Tab[];

    // Mock chrome global
    global.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValueOnce(mockExistingTabs),
        update: jest.fn().mockResolvedValueOnce({} as chrome.tabs.Tab),
      },
    } as unknown as typeof chrome;

    // TODO: Consider replacing these with more general solution.
    // Create a complete mock tab that satisfies the chrome.tabs.Tab interface
    const mockExistingTabs = [
      {
        id: 123,
        url: "https://example.com",
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
      },
    ] as chrome.tabs.Tab[];

    // Mock chrome global
    global.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValueOnce(mockExistingTabs),
        update: jest.fn().mockResolvedValueOnce({} as chrome.tabs.Tab),
      },
    } as unknown as typeof chrome;

    await takeoverTab("test-tab-id", "test-session-id");

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      url: "https://example.com",
    });
    expect(chrome.tabs.update).toHaveBeenCalledWith(123, { active: true });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(mockBookmarkStorage.updateTabOwner).not.toHaveBeenCalled();
  });

  it("should throw an error if the tab is not found", async () => {
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
    (mockBookmarkStorage.getSyncedOpenTabs as jest.Mock).mockResolvedValueOnce(
      mockSyncedTabs,
    );
    (mockBookmarkStorage.updateTabOwner as jest.Mock).mockRejectedValueOnce(
      new Error("Update failed"),
    );

    await expect(takeoverTab("test-tab-id", "test-session-id")).rejects.toThrow(
      "Update failed",
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

    mockBookmarkStorage.getSyncedOpenTabs.mockResolvedValue(mockSyncedTabs);
    mockBookmarkStorage.updateTabOwner.mockRejectedValue(
      new Error("Update failed"),
    );

    await expect(takeoverTab("test-tab-id", "test-session-id")).rejects.toThrow(
      "Update failed",
    );
  });
});

describe("restoreClosedSession", () => {
  it("should restore only tabs owned by the current instance", async () => {
    const mockClosedSessions = [
      {
        id: "test-session-id",
        name: "Test Session",
        tabs: [
          { url: "https://example.com/1", owner: "test-instance-id" },
          { url: "https://example.com/2", owner: "other-instance" },
        ],
      },
    ];

    mockBookmarkStorage.getClosedNamedSessions.mockResolvedValue(
      mockClosedSessions,
    );

    const mockWindow = { id: 1 };
    vi.mocked(chrome.windows.create).mockResolvedValue(mockWindow);

    const mockCreatedTab = { id: 123, url: "https://example.com/1" };
    vi.mocked(chrome.tabs.create).mockResolvedValue(mockCreatedTab);

    const result = await session.restoreClosedSession("test-session-id");

    expect(result).toBeDefined();
    expect(result?.id).toBe("test-session-id");
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      windowId: mockWindow.id,
      url: "https://example.com/1",
    });
    expect(chrome.tabs.create).not.toHaveBeenCalledWith({
      windowId: mockWindow.id,
      url: "https://example.com/2",
    });
  });
});
describe("Session Management Tests", () => {
  beforeEach(() => {
    // Mock Chrome storage API is already handled by setupTests.ts and vitest-chrome
    // No need to redefine global.chrome here
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test for getActiveNamedSessionsInLocal
  it("getActiveNamedSessionsInLocal should retrieve sessions from storage", async () => {
    // Mock implementation using vi.mocked
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({
        session1: { id: "session1", name: "Test Session", windowId: 1 },
      }),
    });

    const sessions = await getActiveNamedSessionsInLocal();
    expect(chrome.storage.local.get).toHaveBeenCalledWith(
      "hacky_helper_named_sessions",
    ); // Verify the correct key is used
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
    // Mock the initial state (empty sessions)
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({}),
    });
    // Mock set to resolve successfully
    vi.mocked(chrome.storage.local.set).mockResolvedValue();

    await saveActiveNamedSessionInLocal(session);

    // Verify get was called first
    expect(chrome.storage.local.get).toHaveBeenCalledWith(
      "hacky_helper_named_sessions",
    );
    // Verify set was called with the updated sessions object
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      hacky_helper_named_sessions: JSON.stringify({ session1: session }),
    });
  });

  it("deleteActiveNamedSessionInLocal should remove a session from storage", async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({
        session1: { id: "session1", name: "Test Session", windowId: 1 },
      }),
    });

    await deleteActiveNamedSessionInLocal("session1");
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      hacky_helper_named_sessions: JSON.stringify({}),
    });
  });

  it("createNamedSession should create and save a new session", async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({}),
    });

    const session = await createNamedSession(1, "New Session");
    expect(session.name).toBe("New Session");
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  // Test for getSession
  it("getSession should retrieve a specific session by ID", async () => {
    const mockSession = {
      id: "session1",
      name: "Test Session",
      windowId: 1,
      tabs: [],
    };

    // Mock implementation
    mockBookmarkStorage.getSession.mockResolvedValue(mockSession);

    const session = await mockBookmarkStorage.getSession("session1");
    expect(session).toEqual(mockSession);
  });
  it("restoreClosedSession should restore a closed session", async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      hacky_helper_named_sessions: JSON.stringify({}),
    });

    vi.mocked(chrome.windows.create).mockResolvedValue({
      id: 1,
    } as chrome.windows.Window);

    // Mock getSession to return a session
    mockBookmarkStorage.getSession.mockResolvedValue({
      id: "session1",
      name: "Test Session",
      tabs: [{ url: "http://example.com", owner: "test-instance-id" }],
    });
    // Mock getClosedNamedSessions to return a closed session
    mockBookmarkStorage.getClosedNamedSessions.mockResolvedValue([
      {
        id: "session1",
        name: "Test Session",
        tabs: [{ url: "http://example.com", owner: "test-instance-id" }],
      },
    ]);

    vi.mocked(chrome.tabs.create).mockResolvedValue({
      id: 101,
      url: "http://example.com",
      windowId: 1,
      active: true,
      index: 0,
      pinned: false,
      highlighted: false,
      incognito: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
      status: "complete",
      favIconUrl: "",
    } as chrome.tabs.Tab);

    const session = await restoreClosedSession("session1");
    expect(session).not.toBeNull();
    // Expect create for a blank tab and a synced tab.
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: "about:blank",
      focused: true,
    });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "http://example.com",
      windowId: 1,
    });
  });
});

// Fix chrome.windows.create mock
vi.mocked(chrome.windows.create).mockImplementation(async (createData) => {
  return { id: 1, ...createData } as chrome.windows.Window;
});

// Fix chrome.tabs.create mock
vi.mocked(chrome.tabs.create).mockImplementation(async (createProperties) => {
  return { id: 101, ...createProperties } as chrome.tabs.Tab;
});
