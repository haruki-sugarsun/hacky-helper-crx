import { describe, it, expect, vi, beforeEach } from "vitest"; // Use vitest imports
import {
  handleMoveSavedBookmark,
  handleTakeoverTab,
} from "./service-worker-handler";
import * as SessionManagement from "./session-management";

vi.mock("./session-management"); // Use vi.mock

describe("handleTakeoverTab", () => {
  const mockSendResponse = vi.fn(); // Use vi.fn

  beforeEach(() => {
    vi.clearAllMocks(); // Use vi.clearAllMocks
  });

  it("should return an error if backendTabId is missing", async () => {
    const message = {
      payload: { backendTabId: "", sessionId: "test-session-id" },
    }; // Empty backendTabId to simulate missing value

    await handleTakeoverTab(message, mockSendResponse);

    expect(mockSendResponse).toHaveBeenCalledWith({
      error: "Backend tab ID is required",
    });
  });

  it("should call SessionManagement.takeoverTab with the correct backendTabId and sessionId", async () => {
    const message = {
      payload: { backendTabId: "test-tab-id", sessionId: "test-session-id" },
    };
    // Use vi.mocked for type safety
    vi.mocked(SessionManagement.takeoverTab).mockResolvedValueOnce(undefined);

    await handleTakeoverTab(message, mockSendResponse);

    expect(SessionManagement.takeoverTab).toHaveBeenCalledWith(
      "test-tab-id",
      "test-session-id",
    );
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  it("should return an error if SessionManagement.takeoverTab throws an error", async () => {
    const message = {
      payload: { backendTabId: "test-tab-id", sessionId: "test-session-id" },
    };
    // Use vi.mocked for type safety
    vi.mocked(SessionManagement.takeoverTab).mockRejectedValueOnce(
      new Error("Test error"),
    );

    await handleTakeoverTab(message, mockSendResponse);

    expect(SessionManagement.takeoverTab).toHaveBeenCalledWith(
      "test-tab-id",
      "test-session-id",
    );
    expect(mockSendResponse).toHaveBeenCalledWith({
      error: "Failed to take over tab",
    });
  });
});

describe("handleMoveSavedBookmark", () => {
  const mockSendResponse = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves the bookmark through session management", async () => {
    const message = {
      payload: {
        sessionId: "session-id",
        bookmarkId: "bookmark-id",
        index: 1,
      },
    };
    vi.mocked(SessionManagement.moveSavedBookmark).mockResolvedValueOnce();

    await handleMoveSavedBookmark(message, mockSendResponse);

    expect(SessionManagement.moveSavedBookmark).toHaveBeenCalledWith(
      "session-id",
      "bookmark-id",
      1,
    );
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  it("rejects a missing or invalid destination index", async () => {
    await handleMoveSavedBookmark(
      {
        payload: {
          sessionId: "session-id",
          bookmarkId: "bookmark-id",
          index: -1,
        },
      },
      mockSendResponse,
    );

    expect(SessionManagement.moveSavedBookmark).not.toHaveBeenCalled();
    expect(mockSendResponse).toHaveBeenCalledWith({
      error: "Session ID, bookmark ID, and valid index are required",
    });
  });
});
