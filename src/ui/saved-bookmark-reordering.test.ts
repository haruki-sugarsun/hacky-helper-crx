// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applySavedBookmarkReorder,
  enableSavedBookmarkReordering,
} from "./saved-bookmark-reordering";

function createDragEvent(
  type: string,
  dataTransfer: DataTransfer,
  clientY = 0,
): DragEvent {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as DragEvent;
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer },
    clientY: { value: clientY },
  });
  return event;
}

function createDataTransfer(): DataTransfer {
  let storedBookmarkId = "";
  return {
    effectAllowed: "none",
    dropEffect: "none",
    setData: (_format: string, value: string) => {
      storedBookmarkId = value;
    },
    getData: () => storedBookmarkId,
  } as unknown as DataTransfer;
}

describe("enableSavedBookmarkReordering", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each([
    { source: "third", target: "first", clientY: 10, expectedIndex: 0 },
    { source: "first", target: "second", clientY: 90, expectedIndex: 1 },
  ])(
    "drops $source at the requested side of $target",
    ({ source, target, clientY, expectedIndex }) => {
      const list = document.createElement("ul");
      const rows = ["first", "second", "third"].map((bookmarkId) => {
        const row = document.createElement("li");
        row.dataset.bookmarkId = bookmarkId;
        list.appendChild(row);
        return row;
      });
      document.body.appendChild(list);

      const onReorder = vi.fn();
      rows.forEach((row) => enableSavedBookmarkReordering(row, onReorder));
      const dataTransfer = createDataTransfer();
      const sourceRow = rows.find((row) => row.dataset.bookmarkId === source)!;
      const targetRow = rows.find((row) => row.dataset.bookmarkId === target)!;
      vi.spyOn(targetRow, "getBoundingClientRect").mockReturnValue({
        top: 0,
        bottom: 100,
        left: 0,
        right: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      sourceRow.dispatchEvent(createDragEvent("dragstart", dataTransfer));
      targetRow.dispatchEvent(createDragEvent("drop", dataTransfer, clientY));

      expect(onReorder).toHaveBeenCalledWith(source, expectedIndex);
      expect(sourceRow.draggable).toBe(true);
    },
  );
});

describe("applySavedBookmarkReorder", () => {
  it("reloads the stored order and reports an error when the move fails", async () => {
    let displayedOrder = ["first", "moved"];
    const reload = vi.fn(async () => {
      displayedOrder = ["first", "second"];
    });
    const onError = vi.fn();

    await applySavedBookmarkReorder(
      () => Promise.reject(new Error("Move failed")),
      reload,
      onError,
    );

    expect(reload).toHaveBeenCalledOnce();
    expect(displayedOrder).toEqual(["first", "second"]);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
