/** Adds native drag-and-drop reordering behavior to a saved bookmark row. */
export function enableSavedBookmarkReordering(
  listItem: HTMLLIElement,
  onReorder: (bookmarkId: string, destinationIndex: number) => void,
): void {
  const bookmarkId = listItem.dataset.bookmarkId;
  if (!bookmarkId) return;

  listItem.draggable = true;

  listItem.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", bookmarkId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    listItem.classList.add("bookmark-dragging");
  });

  listItem.addEventListener("dragend", () => {
    listItem.classList.remove("bookmark-dragging");
    clearDropIndicators(listItem.parentElement);
  });

  listItem.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

    clearDropIndicators(listItem.parentElement);
    const dropAfter = isDropAfter(listItem, event.clientY);
    listItem.classList.add(
      dropAfter ? "bookmark-drop-after" : "bookmark-drop-before",
    );
  });

  listItem.addEventListener("dragleave", (event) => {
    if (
      event.relatedTarget instanceof Node &&
      listItem.contains(event.relatedTarget)
    ) {
      return;
    }
    listItem.classList.remove("bookmark-drop-before", "bookmark-drop-after");
  });

  listItem.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    listItem.classList.remove("bookmark-drop-before", "bookmark-drop-after");

    const draggedBookmarkId = event.dataTransfer?.getData("text/plain");
    const list = listItem.parentElement;
    if (!draggedBookmarkId || !list || draggedBookmarkId === bookmarkId) return;

    const rows = Array.from(
      list.querySelectorAll<HTMLLIElement>("li[data-bookmark-id]"),
    );
    const sourceIndex = rows.findIndex(
      (row) => row.dataset.bookmarkId === draggedBookmarkId,
    );
    const targetIndex = rows.indexOf(listItem);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const insertionIndex =
      targetIndex + (isDropAfter(listItem, event.clientY) ? 1 : 0);
    const destinationIndex =
      sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;

    if (destinationIndex !== sourceIndex) {
      onReorder(draggedBookmarkId, destinationIndex);
    }
  });
}

/** Persists a move, then reloads the order stored by the bookmark service. */
export async function applySavedBookmarkReorder(
  move: () => Promise<unknown>,
  reload: () => Promise<void>,
  onError: (error: unknown) => void,
): Promise<void> {
  try {
    await move();
  } catch (error) {
    await reload();
    onError(error);
    return;
  }

  await reload();
}

function isDropAfter(listItem: HTMLLIElement, clientY: number): boolean {
  const bounds = listItem.getBoundingClientRect();
  return clientY >= bounds.top + bounds.height / 2;
}

function clearDropIndicators(list: HTMLElement | null): void {
  list
    ?.querySelectorAll(".bookmark-drop-before, .bookmark-drop-after")
    .forEach((item) =>
      item.classList.remove("bookmark-drop-before", "bookmark-drop-after"),
    );
}
