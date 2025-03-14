import { getConfig } from "../config_store";
import {
  BookmarkSessionFolder,
  NamedSession,
  NamedSessionTab,
  SavedBookmark,
} from "../lib/types";

/**
 * Manages bookmark storage for named sessions and saved pages
 */
export class BookmarkStorage {
  private static instance: BookmarkStorage;
  // TODO: parentForlderId is not set properly. Set it in service-worker.
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
        const sessionData = this.extractSessionDataFromTitle(folder.title);
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
   * Extracts session data from a bookmark folder title
   * Format: "Session Name (session_id)"
   */
  private extractSessionDataFromTitle(
    title: string,
  ): { sessionId: string; sessionName: string } | null {
    const match = title.match(/^(.+) \(([a-f0-9-]+)\)$/i);
    if (match) {
      return {
        sessionName: match[1],
        sessionId: match[2],
      };
    }
    return null;
  }

  /**
   * Creates or updates a bookmark folder for a named session
   */
  public async syncSessionToBookmarks(
    session: NamedSession,
  ): Promise<BookmarkSessionFolder | null> {
    if (!this.parentFolderId || !session.name) return null;

    try {
      await this.initialize();

      // Check if we already have a folder for this session
      let sessionFolder = this.sessionFolders.get(session.id);

      if (sessionFolder) {
        // Update the existing folder if the name changed
        if (sessionFolder.name !== session.name) {
          await chrome.bookmarks.update(sessionFolder.id, {
            title: `${session.name} (${session.id})`,
          });
          sessionFolder.name = session.name;
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
      await this.syncOpenedPages(sessionFolder, session.tabs);

      return sessionFolder;
    } catch (error) {
      console.error("Error syncing session to bookmarks:", error);
      return null;
    }
  }

  /**
   * Syncs the opened pages for a session to bookmarks
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
      for (const tab of tabs) {
        if (!tab.url) continue;

        const existingBookmark = existingBookmarksByUrl.get(tab.url);

        if (existingBookmark) {
          // Update the bookmark if the title changed
          if (existingBookmark.title !== tab.title) {
            await chrome.bookmarks.update(existingBookmark.id, {
              title: tab.title,
            });
          }

          // Remove from the map to track which ones we've processed
          existingBookmarksByUrl.delete(tab.url);
        } else {
          // Create a new bookmark for this tab
          await chrome.bookmarks.create({
            parentId: sessionFolder.openedPagesId,
            title: tab.title,
            url: tab.url,
          });
        }
      }

      // Remove any bookmarks that no longer exist in the tabs
      for (const [_, bookmark] of existingBookmarksByUrl) {
        await chrome.bookmarks.remove(bookmark.id);
      }
    } catch (error) {
      console.error("Error syncing opened pages:", error);
    }
  }

  /**
   * Saves a tab as a bookmark in the "Saved Pages" folder for a session
   */
  public async saveTabToBookmarks(
    sessionId: string,
    tab: chrome.tabs.Tab,
    metadata?: any,
  ): Promise<SavedBookmark | null> {
    try {
      await this.initialize();

      const sessionFolder = this.sessionFolders.get(sessionId);
      if (!sessionFolder || !tab.url) return null;

      // Create metadata JSON
      const metadataObj = {
        savedAt: Date.now(),
        ...metadata,
      };

      // Encode metadata in the title
      const metadataStr = JSON.stringify(metadataObj);
      const title = tab.title || tab.url;
      const bookmarkTitle = `${title} [${metadataStr}]`;

      // Create the bookmark
      const bookmark = await chrome.bookmarks.create({
        parentId: sessionFolder.savedPagesId,
        title: bookmarkTitle,
        url: tab.url,
      });

      return {
        id: bookmark.id,
        title: title,
        url: tab.url,
        sessionId: sessionId,
        metadata: metadataObj,
      };
    } catch (error) {
      console.error("Error saving tab to bookmarks:", error);
      return null;
    }
  }

  /**
   * Gets all saved bookmarks for a session
   */
  public async getSavedBookmarks(sessionId: string): Promise<SavedBookmark[]> {
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
          const { title, metadata } = this.extractMetadataFromTitle(
            bookmark.title,
          );

          return {
            id: bookmark.id,
            title: title,
            url: bookmark.url!,
            sessionId: sessionId,
            metadata: metadata,
          };
        });
    } catch (error) {
      console.error("Error getting saved bookmarks:", error);
      return [];
    }
  }

  /**
   * Gets all synced bookmarks from the "Opened Pages" folder for a session
   */
  public async getSyncedBookmarks(sessionId: string): Promise<SavedBookmark[]> {
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
          return {
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url!,
            sessionId: sessionId,
          };
        });
    } catch (error) {
      console.error("Error getting synced bookmarks:", error);
      return [];
    }
  }

  /**
   * Extracts the actual title and metadata from a bookmark title
   * Format: "Title [{"savedAt":1234567890,"tags":["tag1","tag2"]}]"
   */
  private extractMetadataFromTitle(title: string): {
    title: string;
    metadata?: any;
  } {
    const match = title.match(/^(.+) \[(.*)\]$/);
    if (match) {
      try {
        const metadata = JSON.parse(match[2]);
        return {
          title: match[1],
          metadata: metadata,
        };
      } catch (e) {
        // If JSON parsing fails, return the original title
        return { title: title };
      }
    }
    return { title: title };
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
}

// Export a singleton instance
export const bookmarkStorage = BookmarkStorage.getInstance();
