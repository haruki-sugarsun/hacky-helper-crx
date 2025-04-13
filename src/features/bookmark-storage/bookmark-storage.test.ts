import { BookmarkStorage } from "../BookmarkStorage";
import { NamedSession, NamedSessionTab } from "../../lib/types";

describe("BookmarkStorage", () => {
  let bookmarkStorage: BookmarkStorage;

  beforeEach(() => {
    bookmarkStorage = BookmarkStorage.getInstance();
  });

  it("should initialize successfully", async () => {
    const result = await bookmarkStorage.initialize();
    expect(result).toBe(true);
  });

  it("should create a session folder", async () => {
    const session: NamedSession = {
      id: "test-session-id",
      name: "Test Session",
      windowId: undefined,
      createdAt: 0,
      updatedAt: 0,
    };

    const folder = await bookmarkStorage.createSessionFolder(session);
    expect(folder).toBeDefined();
    expect(folder.name).toBe("Test Session");
    expect(folder.sessionId).toBe("test-session-id");
  });

  it("should save a tab to bookmarks", async () => {
    const sessionId = "test-session-id";
    const tab: NamedSessionTab = {
      tabId: null,
      title: "Test Tab",
      url: "https://example.com",
      updatedAt: Date.now(),
      owner: "test-owner",
    };

    const savedTab = await bookmarkStorage.saveTabToBookmarks(sessionId, tab);
    expect(savedTab).toBeDefined();
    expect(savedTab?.title).toBe("Test Tab");
    expect(savedTab?.url).toBe("https://example.com");
  });

  it("should retrieve saved bookmarks for a session", async () => {
    const sessionId = "test-session-id";
    const bookmarks = await bookmarkStorage.getSavedBookmarks(sessionId);
    expect(bookmarks).toBeInstanceOf(Array);
  });
});
