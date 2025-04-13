import { getConfig } from "./config-store";
import {
  BookmarkSessionFolder,
  ClosedNamedSession,
  NamedSession,
  NamedSessionTab,
  SyncedTabEntity,
} from "../lib/types";

import {
  encodeSessionTitle,
  decodeSessionTitle,
  encodeTabTitle,
  decodeTabTitle,
} from "./bookmark-storage/bookmark-storage-helpers";

/**
 * Manages bookmark storage for named sessions and saved pages
 */
export class BookmarkStorage {
  private static instance: BookmarkStorage;
  // parentFolderId is set in service-worker.ts via initializeBookmarkParentFolder()
  private parentFolderId: string | null = null;
  private sessionFolders: Map<string, BookmarkSessionFolder> = new Map();
  private initialized = false;

  private constructor() {}

  /**
   * Gets the singleton instance of BookmarkStorage
   */
  public static getInstance(): BookmarkStorage {
    if (!BookmarkStorage.instance) {
      BookmarkStorage.instance = new BookmarkStorage();
    }
    return BookmarkStorage.instance;
  }

  /**
   * Initializes the bookmark storage system
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      const config = await getConfig();
      this.parentFolderId = config.bookmarkParentId || null;

      if (!this.parentFolderId) {
        console.warn("No parent bookmark folder configured");
        return false;
      }

      // Load existing session folders
      await this.loadSessionFolders();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error("Failed to initialize bookmark storage:", error);
      return false;
    }
  }

  /**
   * Loads existing session folders from bookmarks
   */
  private async loadSessionFolders(): Promise<void> {
    if (!this.parentFolderId) return;

    try {
      const children = await chrome.bookmarks.getChildren(this.parentFolderId);

      for (const folder of children) {
        // Check if this is a session folder by looking for metadata in the title
        const sessionData = decodeSessionTitle(folder.title);
        if (sessionData) {
          const { sessionId, sessionName } = sessionData;

          // Find the "Opened Pages" and "Saved Pages" subfolders
          const subfolders = await chrome.bookmarks.getChildren(folder.id);
          const openedPagesFolder = subfolders.find(
            (f) => f.title === "Opened Pages",
          );
          const savedPagesFolder = subfolders.find(
            (f) => f.title === "Saved Pages",
          );

          if (openedPagesFolder && savedPagesFolder) {
            this.sessionFolders.set(sessionId, {
              id: folder.id,
              name: sessionName,
              sessionId: sessionId,
              openedPagesId: openedPagesFolder.id,
              savedPagesId: savedPagesFolder.id,
            });
          }
        }
      }

      console.log(
        `Loaded ${this.sessionFolders.size} session folders from bookmarks`,
      );
    } catch (error) {
      console.error("Error loading session folders:", error);
    }
  }

  /**
   * Creates or updates a bookmark folder for a named session
   */
  public async syncSessionToBookmarks(
    session: NamedSession,
    sessionTabs: NamedSessionTab[],
  ): Promise<BookmarkSessionFolder | null> {
    if (!this.parentFolderId || !session.name) return null;

    try {
      await this.initialize();

      // Check if we already have a folder for this session
      let sessionFolder = this.sessionFolders.get(session.id);

      if (sessionFolder) {
        // Update the existing folder if the name changed
        // TODO: Reconsider the properties of BookmarkSessionFolder.
        const encodedTitle = encodeSessionTitle(session);
        if (sessionFolder.name !== encodedTitle) {
          await chrome.bookmarks.update(sessionFolder.id, {
            title: encodedTitle,
          });
          sessionFolder.name = encodedTitle;
        }
      } else {
        // Create a new session folder
        const folderTitle = `${session.name} (${session.id})`;
        const newFolder = await chrome.bookmarks.create({
          parentId: this.parentFolderId,
          title: folderTitle,
        });

        // Create "Opened Pages" and "Saved Pages" subfolders
        const openedPagesFolder = await chrome.bookmarks.create({
          parentId: newFolder.id,
          title: "Opened Pages",
        });

        const savedPagesFolder = await chrome.bookmarks.create({
          parentId: newFolder.id,
          title: "Saved Pages",
        });

        sessionFolder = {
          id: newFolder.id,
          name: session.name,
          sessionId: session.id,
          openedPagesId: openedPagesFolder.id,
          savedPagesId: savedPagesFolder.id,
        };

        this.sessionFolders.set(session.id, sessionFolder);
      }

      // Sync the tabs in the "Opened Pages" folder
      await this.syncOpenedPages(sessionFolder, sessionTabs);

      return sessionFolder;
    } catch (error) {
      console.error("Error syncing session to bookmarks:", error);
      return null;
    }
  }

  /**
   * Syncs the opened pages for a session to bookmarks
   * TODO: Rename to have consistentcy with concepts.
   */
  private async syncOpenedPages(
    sessionFolder: BookmarkSessionFolder,
    tabs: NamedSessionTab[],
  ): Promise<void> {
    try {
      // Get existing bookmarks in the "Opened Pages" folder
      const existingBookmarks = await chrome.bookmarks.getChildren(
        sessionFolder.openedPagesId,
      );

      // Create a map of existing bookmarks by URL for quick lookup
      const existingBookmarksByUrl = new Map<
        string,
        chrome.bookmarks.BookmarkTreeNode
      >();
      existingBookmarks.forEach((bookmark) => {
        if (bookmark.url) {
          existingBookmarksByUrl.set(bookmark.url, bookmark);
        }
      });

      // Process each tab
      // TODO: This won't work as expected if the `tabs` have multiple elements with the same URL.
      //       Consider ignore duplicates in `tabs`.
      for (const tab of tabs) {
        if (!tab.url) continue;

        const existingBookmark = existingBookmarksByUrl.get(tab.url);

        const encodedBookmarkTitle = encodeTabTitle(tab);
        if (existingBookmark) {
          // Update the bookmark if the title changed
          if (existingBookmark.title !== encodedBookmarkTitle) {
            await chrome.bookmarks.update(existingBookmark.id, {
              title: encodedBookmarkTitle,
            });
          }

          // Remove from the map to track which ones we've processed
          existingBookmarksByUrl.delete(tab.url);
        } else {
          // Create a new bookmark for this tab
          await chrome.bookmarks.create({
            parentId: sessionFolder.openedPagesId,
            title: encodedBookmarkTitle,
            url: tab.url,
          });
        }
      }

      // Remove any bookmarks that no longer exist in the tabs
      for (const [_, bookmark] of existingBookmarksByUrl) {
        // TODO: Only delete the ones owned by the current Hacky-Helper-CRX instance.
        await chrome.bookmarks.remove(bookmark.id);
      }
    } catch (error) {
      console.error("Error syncing opened pages:", error);
    }
  }

  /**
   * Public method to sync opened pages for a session
   * TODO: Have consistent working OpenedPages -> OpenTabs.
   */
  public async syncOpenedPagesForSession(
    sessionId: string,
    tabs: NamedSessionTab[],
  ): Promise<void> {
    const sessionFolder = this.sessionFolders.get(sessionId);
    if (!sessionFolder) {
      throw new Error(`Session folder not found for session ID: ${sessionId}`);
    }
    await this.syncOpenedPages(sessionFolder, tabs);
  }

  /**
   * Saves a tab as a bookmark in the "Saved Pages" folder for a session
   */
  public async saveTabToBookmarks(
    sessionId: string,
    tab: NamedSessionTab,
  ): Promise<SyncedTabEntity | null> {
    try {
      await this.initialize();

      const sessionFolder = this.sessionFolders.get(sessionId);
      if (!sessionFolder || !tab.url) return null;

      const encodedBookmarkTitle = encodeTabTitle(tab);

      // Encode metadata in the title
      const title = tab.title || tab.url;

      // Create the bookmark
      const bookmark = await chrome.bookmarks.create({
        parentId: sessionFolder.savedPagesId,
        title: encodedBookmarkTitle,
        url: tab.url,
      });

      return {
        id: bookmark.id,
        title: title,
        url: tab.url,
        sessionId: sessionId,
        owner: tab.owner,
      };
    } catch (error) {
      console.error("Error saving tab to bookmarks:", error);
      return null;
    }
  }

  /**
   * Gets all saved bookmarks for a session
   */
  public async getSavedBookmarks(
    sessionId: string,
  ): Promise<SyncedTabEntity[]> {
    try {
      await this.initialize();

      const sessionFolder = this.sessionFolders.get(sessionId);
      if (!sessionFolder) return [];

      const bookmarks = await chrome.bookmarks.getChildren(
        sessionFolder.savedPagesId,
      );

      return bookmarks
        .filter((bookmark) => bookmark.url)
        .map((bookmark) => {
          // Extract metadata from the title
          const { title, metadata } = decodeTabTitle(bookmark.title);

          return {
            id: bookmark.id,
            title: title,
            url: bookmark.url!,
            sessionId: sessionId,
            owner: metadata?.owner || "Unknown",
          };
        });
    } catch (error) {
      console.error("Error getting saved bookmarks:", error);
      return [];
    }
  }

  /**
   * Gets all synced open tabs from the "Opened Pages" folder for a session
   */
  public async getSyncedOpenTabs(
    sessionId: string,
  ): Promise<SyncedTabEntity[]> {
    try {
      await this.initialize();

      const sessionFolder = this.sessionFolders.get(sessionId);
      if (!sessionFolder) return [];

      const bookmarks = await chrome.bookmarks.getChildren(
        sessionFolder.openedPagesId,
      );

      return bookmarks
        .filter((bookmark) => bookmark.url)
        .map((bookmark) => {
          const { title, metadata } = decodeTabTitle(bookmark.title);
          return {
            id: bookmark.id,
            title,
            url: bookmark.url!,
            sessionId: sessionId,
            owner: metadata.owner,
          };
        });
    } catch (error) {
      console.error("Error getting synced bookmarks:", error);
      return [];
    }
  }

  /**
   * Deletes a session folder and all its bookmarks
   */
  public async deleteSessionFolder(sessionId: string): Promise<boolean> {
    try {
      await this.initialize();

      const sessionFolder = this.sessionFolders.get(sessionId);
      if (!sessionFolder) return false;

      // Remove the entire folder
      await chrome.bookmarks.removeTree(sessionFolder.id);

      // Remove from our map
      this.sessionFolders.delete(sessionId);

      return true;
    } catch (error) {
      console.error("Error deleting session folder:", error);
      return false;
    }
  }

  /**
   * Gets all closed named sessions from bookmarks
   * A closed session is one that exists in bookmarks but doesn't have an active window
   * @param activeSessionIds Array of session IDs that are currently active (have open windows)
   */
  public async getClosedNamedSessions(
    activeSessionIds: string[],
  ): Promise<ClosedNamedSession[]> {
    try {
      await this.initialize();

      const closedSessions: ClosedNamedSession[] = [];

      // Iterate through all session folders
      for (const [sessionId, folder] of this.sessionFolders.entries()) {
        // Skip if this session is active
        if (activeSessionIds.includes(sessionId)) continue;

        // Get the tabs from the "Opened Pages" folder
        const bookmarks = await chrome.bookmarks.getChildren(
          folder.openedPagesId,
        );

        // TODO: Store the metadata (updated and owner) encoded in the bookmark title.
        const tabs: NamedSessionTab[] = bookmarks
          .filter((bookmark) => bookmark.url)
          .map((bookmark) => ({
            tabId: null, // Closed sessions don't have active tab IDs
            title: bookmark.title,
            url: bookmark.url!,
            updatedAt: Date.now(), // Provide a default timestamp
            owner: "unknown", // Provide a default owner
          }));

        // Create a closed session object
        const closedSession: ClosedNamedSession = {
          id: sessionId,
          name: folder.name,
          tabs: tabs,
          createdAt: 0, // TODO: Read from the backend (metadata)
          updatedAt: 0, // TODO: Read from the backend (metadata)
        };

        closedSessions.push(closedSession);
      }

      return closedSessions;
    } catch (error) {
      console.error("Error getting closed named sessions:", error);
      return [];
    }
  }

  /**
   * Creates a session folder to store the session data in bookmarks (without syncing tabs).
   */
  public async createSessionFolder(
    session: NamedSession,
  ): Promise<BookmarkSessionFolder> {
    if (!session.name) {
      throw new Error("Session name is required");
    }

    await this.initialize();

    // Check if we already have a folder for this session
    let existingSessionFolder = this.sessionFolders.get(session.id);
    if (existingSessionFolder) {
      // If the folder already exists, throw an error.
      throw new Error(
        `Session folder already exists for session ID: ${session.id}`,
      );
    }

    // Create a new folder for the session
    const folderTitle = encodeSessionTitle(session);
    const newFolder = await chrome.bookmarks.create({
      parentId: this.parentFolderId!,
      title: folderTitle,
    });

    // Create "Opened Pages" and "Saved Pages" subfolders
    const openedPagesFolder = await chrome.bookmarks.create({
      parentId: newFolder.id,
      title: "Opened Pages",
    });
    const savedPagesFolder = await chrome.bookmarks.create({
      parentId: newFolder.id,
      title: "Saved Pages",
    });

    const sessionFolder = {
      id: newFolder.id,
      name: session.name,
      sessionId: session.id,
      openedPagesId: openedPagesFolder.id,
      savedPagesId: savedPagesFolder.id,
    };

    this.sessionFolders.set(session.id, sessionFolder);
    return sessionFolder;
  }

  /**
   * Retrieves a session using local bookmark storage data.
   * This reconstructs a NamedSession from stored bookmark folder data.
   *
   * @param sessionId - The unique identifier for the session.
   * @returns The corresponding NamedSession, or null if not found.
   */
  public async getSession(sessionId: string): Promise<NamedSession | null> {
    const sessionFolder = this.sessionFolders.get(sessionId);
    if (!sessionFolder) {
      return null;
    }

    try {
      const bookmarks = await chrome.bookmarks.get(sessionFolder.id);
      if (bookmarks && bookmarks.length > 0) {
        const decoded = decodeSessionTitle(bookmarks[0].title);
        if (decoded) {
          return {
            id: sessionId,
            name: decoded.sessionName,
            windowId: undefined,
            createdAt: 0, // Not stored; extend as needed.  TODO: Store in the backend as well.
            updatedAt: decoded.updatedAt || 0,
          };
        }
      }
    } catch (error) {
      console.error("Error fetching session bookmark:", error);
    }
    console.log("Fallback in case decoding fails for ${sessionId}");
    // Fallback in case decoding fails
    return {
      id: sessionId,
      name: sessionFolder.name,
      windowId: undefined,
      createdAt: 0,
      updatedAt: 0,
    };
  }
}
