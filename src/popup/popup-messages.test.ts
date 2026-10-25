import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleMessages } from "./popup-messages";

describe("copy page info message", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("copies the active tab and shows a success toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.mocked(chrome.tabs.query).mockImplementationOnce((_query, callback) => {
      callback?.([{ title: "Example", url: "https://example.com" } as chrome.tabs.Tab]);
    });
    const sendResponse = vi.fn();

    expect(
      handleMessages({ popup_action: "copyPageInfo" }, {} as chrome.runtime.MessageSender, sendResponse),
    ).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ success: true }));

    expect(writeText).toHaveBeenCalledWith("Example - https://example.com");
    expect(document.querySelector(".copy-page-info-toast")?.textContent).toBe(
      "Page title and URL copied",
    );
  });

  it("shows an error toast when there is no active tab", () => {
    vi.mocked(chrome.tabs.query).mockImplementationOnce((_query, callback) => {
      callback?.([]);
    });
    const sendResponse = vi.fn();

    handleMessages({ popup_action: "copyPageInfo" }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: "No active tab found",
    });
    expect(document.querySelector(".copy-page-info-toast")?.textContent).toBe(
      "Could not find an active tab",
    );
    expect(document.querySelector(".copy-page-info-toast")?.className).toContain("error");
  });

  it("shows an error toast when the clipboard rejects the copy", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    vi.mocked(chrome.tabs.query).mockImplementationOnce((_query, callback) => {
      callback?.([{ title: "Example", url: "https://example.com" } as chrome.tabs.Tab]);
    });
    const sendResponse = vi.fn();

    handleMessages({ popup_action: "copyPageInfo" }, {} as chrome.runtime.MessageSender, sendResponse);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      ),
    );

    expect(document.querySelector(".copy-page-info-toast")?.textContent).toBe(
      "Could not copy page title and URL",
    );
    expect(document.querySelector(".copy-page-info-toast")?.className).toContain("error");
  });
});
