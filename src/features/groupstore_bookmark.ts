// import { getConfig } from '../config_store';

// import { chrome } from '@types/chrome'; 
// import { BookmarkTreeNode } from 'chrome.bookmarks';

interface GroupStore {
  // Define the methods and properties of the interface here
}

interface BookmarkStore {
  // Define the methods and properties of the interface here
  // TODO: Consider merging GroupStore and BookmarkStore.
}

interface BookmarkGroup {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
  groupId: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Implementation of the GroupStore interface using Chrome Bookmarks API.
 */
export class GroupStoreImpl implements GroupStore {
  private parentId: string;

  constructor(bookmarkParentId: string) {
    this.parentId = bookmarkParentId;
  }

  /**
   * Creates a new bookmark group.
   * @param name - The name of the new group.
   * @returns The created BookmarkGroup.
   */
  async createGroup(name: string): Promise<BookmarkGroup> {
    const group = await chrome.bookmarks.create({
      parentId: this.parentId, // Configurable parent folder
      title: name,
    });

    return {
      id: group.id,
      name: group.title,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Deletes an existing bookmark group.
   * @param groupId - The ID of the group to delete.
   */
  async deleteGroup(groupId: string): Promise<void> {
    await chrome.bookmarks.remove(groupId);
  }

  /**
   * Updates the details of an existing bookmark group.
   * @param groupId - The ID of the group to update.
   * @param updatedFields - The fields to update.
   * @returns The updated BookmarkGroup.
   */
  async updateGroup(groupId: string, updatedFields: Partial<BookmarkGroup>): Promise<BookmarkGroup> {
    const updatedGroup: chrome.bookmarks.BookmarkTreeNode = await chrome.bookmarks.update(groupId, {
      title: updatedFields.name,
    });

    return {
      id: updatedGroup.id,
      name: updatedGroup.title,
      createdAt: new Date(updatedGroup.dateAdded || new Date()),
      updatedAt: new Date(),
    };
  }

  /**
   * Retrieves all bookmark groups.
   * @returns An array of BookmarkGroup.
   */
  async getAllGroups(): Promise<BookmarkGroup[]> {
    const tree = await chrome.bookmarks.getTree();
    const groups: BookmarkGroup[] = [];

    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const node of nodes) {
        if (node.children) {
          groups.push({
            id: node.id,
            name: node.title,
            createdAt: new Date(node.dateAdded || new Date()),
            updatedAt: new Date(),
          });
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    return groups;
  }

  /**
   * Retrieves a bookmark group by its ID.
   * @param groupId - The ID of the group to retrieve.
   * @returns The BookmarkGroup or null if not found.
   */
  async getGroupById(groupId: string): Promise<BookmarkGroup | null> {
    try {
      const groups = await chrome.bookmarks.get(groupId);
      if (groups && groups.length > 0) {
        const group = groups[0];
        return {
          id: group.id,
          name: group.title,
          createdAt: new Date(group.dateAdded || new Date()),
          updatedAt: new Date(),
        };
      }
      return null;
    } catch (error) {
      console.error(`Error retrieving group by ID: ${error}`);
      return null;
    }
  }
}

/**
 * Represents the result of a bookmark operation.
 */
interface Result<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Implementation of the BookmarkStore interface using Chrome Bookmarks API.
 * Provides methods for managing bookmarks with proper error handling and validation.
 */
export class BookmarkStoreImpl implements BookmarkStore {
  private parentId: string;
  private static readonly MAX_TITLE_LENGTH = 256;
  private static readonly BOOKMARK_ERRORS = {
    INVALID_URL: 'Invalid bookmark URL',
    INVALID_GROUP: 'Invalid group ID',
    NOT_FOUND: 'Bookmark not found',
    INVALID_TITLE: 'Title exceeds maximum length',
    CHROME_API_ERROR: 'Chrome API error',
  } as const;

  constructor(bookmarkParentId: string) {
    this.parentId = bookmarkParentId;
  }

  /**
   * Validates a bookmark's data before operations.
   * @throws Error if validation fails
   */
  private validateBookmark(bookmark: Bookmark): void {
    if (bookmark.title && bookmark.title.length > BookmarkStoreImpl.MAX_TITLE_LENGTH) {
      throw new Error(BookmarkStoreImpl.BOOKMARK_ERRORS.INVALID_TITLE);
    }
    if (bookmark.url) {
      try {
        new URL(bookmark.url);
      } catch {
        throw new Error(BookmarkStoreImpl.BOOKMARK_ERRORS.INVALID_URL);
      }
    }
    if (bookmark.groupId && typeof bookmark.groupId !== 'string') {
      throw new Error(BookmarkStoreImpl.BOOKMARK_ERRORS.INVALID_GROUP);
    }
  }

  /**
   * Handles Chrome API errors uniformly.
   */
  // private handleChromeError(error: unknown): never {
  //   console.error('Chrome API error:', error);
  //   throw new Error(
  //     error instanceof Error
  //       ? error.message
  //       : BookmarkStoreImpl.BOOKMARK_ERRORS.CHROME_API_ERROR
  //   );
  // }

  /**
   * Normalizes a Chrome bookmark into our Bookmark type.
   */
  private normalizeBookmark(chromeBookmark: chrome.bookmarks.BookmarkTreeNode): Bookmark {
    return {
      id: chromeBookmark.id,
      url: chromeBookmark.url || '',
      title: chromeBookmark.title,
      // keywords: [],
      // embeddings: [],
      groupId: chromeBookmark.parentId || this.parentId,
      createdAt: new Date(chromeBookmark.dateAdded || new Date()),
      updatedAt: new Date(),
    };
  }

  /**
   * Adds a new bookmark to a specific group.
   * @param bookmark - The bookmark to add.
   * @returns A Result containing the added Bookmark or error details.
   * @throws Error if validation fails
   */
  async addBookmark(bookmark: Bookmark): Promise<Result<Bookmark>> {
    try {
      this.validateBookmark(bookmark);

      const createdBookmark = await chrome.bookmarks.create({
        parentId: bookmark.groupId || this.parentId,
        title: bookmark.title,
        url: bookmark.url,
      });

      return {
        success: true,
        data: {
          ...this.normalizeBookmark(createdBookmark),
          // keywords: bookmark.keywords || [],
          // embeddings: bookmark.embeddings || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(BookmarkStoreImpl.BOOKMARK_ERRORS.CHROME_API_ERROR),
      };
    }
  }

  /**
   * Removes a bookmark by its ID.
   * @param bookmarkId - The ID of the bookmark to remove.
   * @returns A Result indicating success or failure.
   */
  async removeBookmark(bookmarkId: string): Promise<Result<void>> {
    try {
      await chrome.bookmarks.remove(bookmarkId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(BookmarkStoreImpl.BOOKMARK_ERRORS.CHROME_API_ERROR),
      };
    }
  }

  /**
   * Updates an existing bookmark.
   * @param bookmarkId - The ID of the bookmark to update.
   * @param updatedFields - The fields to update.
   * @returns A Result containing the updated Bookmark or error details.
   * @throws Error if validation fails
   */
  async updateBookmark(bookmarkId: string, updatedFields: Partial<Bookmark>): Promise<Result<Bookmark>> {
    try {
      this.validateBookmark(updatedFields as Bookmark);

      const updates: chrome.bookmarks.BookmarkChangesArg = {};
      if (updatedFields.title) {
        // updates.title = updatedFields.title;
      }
      if (updatedFields.url) {
        // updates.url = updatedFields.url;
      }

      const updatedBookmark = await chrome.bookmarks.update(bookmarkId, updates);

      return {
        success: true,
        data: {
          ...this.normalizeBookmark(updatedBookmark),
          // keywords: updatedFields.keywords || [],
          // embeddings: updatedFields.embeddings || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(BookmarkStoreImpl.BOOKMARK_ERRORS.CHROME_API_ERROR),
      };
    }
  }

  /**
   * Retrieves all bookmarks within a specific group.
   * @param groupId - The ID of the group.
   * @returns A Result containing an array of Bookmarks or error details.
   */
  async getBookmarksByGroup(groupId: string): Promise<Result<Bookmark[]>> {
    try {
      const bookmarks = await chrome.bookmarks.getChildren(groupId);
      return {
        success: true,
        data: bookmarks.map(b => this.normalizeBookmark(b)),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(BookmarkStoreImpl.BOOKMARK_ERRORS.CHROME_API_ERROR),
      };
    }
  }

  /**
   * Retrieves a bookmark by its ID.
   * @param bookmarkId - The ID of the bookmark to retrieve.
   * @returns A Result containing the Bookmark or error details.
   */
  async getBookmarkById(bookmarkId: string): Promise<Result<Bookmark | null>> {
    try {
      const bookmarks = await chrome.bookmarks.get(bookmarkId);
      if (bookmarks && bookmarks.length > 0) {
        return {
          success: true,
          data: this.normalizeBookmark(bookmarks[0]),
        };
      }
      return {
        success: true,
        data: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(BookmarkStoreImpl.BOOKMARK_ERRORS.CHROME_API_ERROR),
      };
    }
  }
}
