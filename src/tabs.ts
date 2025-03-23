import {
  GET_CACHED_SUMMARIES,
  CREATE_NAMED_SESSION,
  GET_NAMED_SESSIONS,
  CATEGORIZE_TABS,
  SUGGEST_TAB_DESTINATIONS,
  MIGRATE_TAB,
  SAVE_TAB_TO_BOOKMARKS,
  SYNC_SESSION_TO_BOOKMARKS,
  UPDATE_NAMED_SESSION_TABS,
  DELETE_NAMED_SESSION,
  RENAME_NAMED_SESSION,
  GET_CLOSED_NAMED_SESSIONS,
  RESTORE_CLOSED_SESSION,
  GET_SAVED_BOOKMARKS,
  OPEN_SAVED_BOOKMARK,
  GET_SYNCED_OPENTABS,
} from "./lib/constants";
import { ensureTabsHtmlInWindow } from "./features/tabs_helpers";
import {
  ClosedNamedSession,
  NamedSession,
  SavedBookmark,
  TabSummary,
} from "./lib/types";
import "./style.css";
import "./tabs.css";

// Entrypoint code for tabs.html.
console.log("tabs.ts", new Date());

// References to the fixed elements and handler setup:
// TODO: Gather all the references by ID in the top-level, so that we can know the necessary HTML elements to be modified.
const tabs_tablist = document.querySelector<HTMLDivElement>("#tabs_tablist")!;

// Page State
var windowIds: (number | undefined)[] = []; // IDs of all windows
var state_windows: chrome.windows.Window[]; // All windows
var state_tabs: chrome.tabs.Tab[]; // Tabs in the current window. This is mostly redundant now that we have tabs in state_windows. TODO: Remove it.
var state_sessions: NamedSession[] = []; // Named Sessions from the service worker
var currentTabId: number | undefined; // ID of the current tab

// Check if this is a duplicate tabs.html page in the same window
async function checkForDuplicates() {
  const currentTab = await chrome.tabs.getCurrent();
  currentTabId = currentTab?.id;

  // Get all tabs in the current window
  const tabs = await chrome.tabs.query({ currentWindow: true });

  // Find all tabs.html tabs in this window (excluding the current one)
  const tabsHtmlTabs = tabs.filter(
    (tab) => tab.url?.includes("tabs.html") && tab.id !== currentTabId,
  );

  if (tabsHtmlTabs.length > 0) {
    console.log(
      "Found another tabs.html tab in this window. Activating it and closing this one.",
    );
    // Activate the first found tabs.html tab
    await chrome.tabs.update(tabsHtmlTabs[0].id!, { active: true });
    // Close the current tab
    if (currentTabId) {
      await chrome.tabs.remove(currentTabId);
    }
    return true; // Duplicate found and handled
  }

  // If this is the only tabs.html tab, pin it
  if (currentTabId && currentTab && !currentTab.pinned) {
    console.log("Pinning this tabs.html tab");
    await chrome.tabs.update(currentTabId, { pinned: true });
  }

  return false; // No duplicates found
}

// Extract session parameters from URL
function getSessionParamsFromUrl(): {
  sessionId?: string;
  sessionName?: string;
} {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("sessionId") || undefined;
  const sessionName = urlParams.get("sessionName") || undefined;

  if (sessionId) {
    console.log(
      `Found session parameters in URL: sessionId=${sessionId}, sessionName=${sessionName}`,
    );
  }

  return { sessionId, sessionName };
}

// Restore session-window association if needed
async function restoreSessionWindowAssociation() {
  const { sessionId, sessionName } = getSessionParamsFromUrl();

  if (!sessionId) return;

  try {
    // Get current window
    const currentWindow = await chrome.windows.getCurrent();

    // Get all named sessions
    const response = await chrome.runtime.sendMessage({
      type: GET_NAMED_SESSIONS,
    });
    if (response && response.type === "GET_NAMED_SESSIONS_RESULT") {
      const sessions = response.payload;

      // Check if this session exists but has a null windowId (lost association)
      const session = sessions.find((s: NamedSession) => s.id === sessionId);

      if (session) {
        if (session.windowId === null) {
          console.log(
            `Restoring session-window association for session ${sessionId} with window ${currentWindow.id}`,
          );

          // Update the session with the current window ID
          const updateResponse = await chrome.runtime.sendMessage({
            type: UPDATE_NAMED_SESSION_TABS,
            payload: {
              sessionId: sessionId,
              windowId: currentWindow.id,
            },
          });

          if (
            updateResponse &&
            updateResponse.type === "UPDATE_NAMED_SESSION_TABS_RESULT"
          ) {
            console.log("Successfully restored session-window association");
          }
        } else {
          console.log(
            `Session ${sessionId} already associated with window ${session.windowId}`,
          );
        }
      } else if (sessionName) {
        // If the session doesn't exist but we have a name, create it
        console.log(
          `Creating new named session ${sessionName} for window ${currentWindow.id}`,
        );

        const createResponse = await chrome.runtime.sendMessage({
          type: CREATE_NAMED_SESSION,
          payload: {
            windowId: currentWindow.id,
            sessionName: sessionName,
          },
        });

        if (
          createResponse &&
          createResponse.type === "CREATE_NAMED_SESSION_RESULT"
        ) {
          console.log("Successfully created named session");
        }
      }
    }
  } catch (error) {
    console.error("Error restoring session-window association:", error);
  }
}

// Page Initializer
async function init() {
  console.log("init");

  // Check for duplicates first
  const isDuplicate = await checkForDuplicates();
  if (isDuplicate) {
    // If this is a duplicate, stop initialization as this tab will be closed
    return;
  }

  // Check for session parameters in URL and restore session-window association if needed
  await restoreSessionWindowAssociation();

  const windowsGetAll = chrome.windows
    .getAll({ populate: true })
    .then((results) => {
      state_windows = results;
      windowIds = [];
      results.forEach((window) => {
        windowIds.push(window.id);
        console.log(`ID: ${window.id}, Tabs: ${window.tabs}`);
      });
      console.log(`${windowIds}`);
      return results;
    });
  const tabsQuery = chrome.tabs.query({ currentWindow: true }).then((tabs) => {
    state_tabs = tabs;
    console.log("Tabs in current window:");
    tabs.forEach((tab) => {
      console.log(`Title: ${tab.title}, URL: ${tab.url}`);
    });
    return tabs;
  });
  Promise.allSettled([windowsGetAll, tabsQuery])
    .then(async (results) => {
      const resWindowsGetAll = results[0];
      const resTabsQuery = results[1];
      console.log(resWindowsGetAll);
      const w = await windowsGetAll;
      console.log(w);

      console.log(resTabsQuery);

      updateUI(state_windows);
    })
    .catch((err) => {
      console.error(err);
      // TODO: Show some error dialog in this case?
    });
}

// Initialize the page
init();

// Add event listener for the toggle bookmarks button
const toggleBookmarksButton = document.querySelector<HTMLButtonElement>(
  "#toggleBookmarksButton",
);
if (toggleBookmarksButton) {
  toggleBookmarksButton.addEventListener("click", () => {
    const savedBookmarksContainer =
      document.querySelector<HTMLDivElement>("#saved_bookmarks")!;
    savedBookmarksContainer.classList.toggle("collapsed");

    // Update button text based on state
    if (savedBookmarksContainer.classList.contains("collapsed")) {
      toggleBookmarksButton.textContent = "🔖";
      toggleBookmarksButton.title = "Show bookmarks panel";
    } else {
      toggleBookmarksButton.textContent = "❌";
      toggleBookmarksButton.title = "Collapse bookmarks panel";
    }
  });
}

// Synced tabs are now always visible, no toggle button needed

// Add event listener for the "Open All Bookmarks" button
const openAllBookmarksButton = document.querySelector<HTMLButtonElement>(
  "#openAllBookmarksButton",
);
if (openAllBookmarksButton) {
  openAllBookmarksButton.addEventListener("click", async () => {
    console.log("Opening all bookmarks that aren't already open");
    await openAllBookmarks();
  });
}

// Add event listener for the "Open All Synced Tabs" button
const openAllSyncedTabsButton = document.querySelector<HTMLButtonElement>(
  "#openAllSyncedTabsButton",
);
if (openAllSyncedTabsButton) {
  openAllSyncedTabsButton.addEventListener("click", async () => {
    console.log("Opening all synced tabs that aren't already open");
    await openAllSyncedTabs();
  });
}

// Add event listener for the "button to request the tab summaries."
const requestTabSummariesButton = document.querySelector<HTMLButtonElement>(
  "#requestTabSummariesButton",
)!;
requestTabSummariesButton.addEventListener("click", async () => {
  console.log("Tab summaries requested");

  // Refresh the windows list with tab information
  chrome.windows.getAll({ populate: true }).then((windows) => {
    state_windows = windows;
    updateUI(state_windows);
  });

  // Get all tabs in the current window
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (tabs.length === 0) {
    console.error("No tabs found in current window");
    return;
  }

  // Filter out pinned tabs
  const filteredTabs = tabs.filter((tab) => !tab.pinned);

  // Collect all tab URLs from non-pinned tabs
  const tabUrls: string[] = filteredTabs
    .map((tab) => tab.url!)
    .filter((url) => url);

  console.log("Requesting summaries for tabs:", tabUrls);

  // Request cached summaries for all tabs in the window
  const cachedDigestResponse = await chrome.runtime.sendMessage({
    type: GET_CACHED_SUMMARIES,
    payload: {
      tabUrls: tabUrls,
    },
  });

  if (
    cachedDigestResponse &&
    cachedDigestResponse.type === "CACHED_SUMMARIES_RESULT"
  ) {
    const allTabSummaries: TabSummary[] =
      cachedDigestResponse.payload.tabSummaries || [];

    // Update the table in #tabs_tablist
    const tabsTable = tabs_tablist.querySelector("table")!;

    // Update table headers
    const tableHead = tabsTable.querySelector("thead")!;
    tableHead.innerHTML = `
                <tr>
                    <th>Tab ID</th>
                    <th>URL</th>
                    <th>Summary</th>
                </tr>
            `;

    // Clear existing table rows
    const tableBody = tabsTable.querySelector("tbody")!;
    tableBody.innerHTML = "";

    // Filter out pinned tabs from state_tabs
    const filteredStateTabs = state_tabs.filter((tab) => !tab.pinned);

    if (allTabSummaries.length === 0 || filteredStateTabs.length === 0) {
      // No summaries available - add a message row
      const noSummaryRow = document.createElement("tr");
      noSummaryRow.innerHTML = `
                    <td colspan="3">No summaries available for any tabs yet.</td>
                `;
      tableBody.appendChild(noSummaryRow);
    } else {
      // Add rows for each tab (excluding pinned tabs)
      filteredStateTabs.forEach((tab: chrome.tabs.Tab) => {
        const row = document.createElement("tr");

        let summarySnippet = "No summary available yet."; // TODO: Use summry from allTabSummaries.
        // Find the summary for this tab
        const tabSummary = allTabSummaries.find(
          (summary) => summary.url === tab.url,
        );
        if (tabSummary && tabSummary.summaries.length > 0) {
          const digest = tabSummary.summaries[0];
          const date = new Date(digest.timestamp);
          const formattedDate = date.toLocaleString();
          summarySnippet = `
                        <div class="summary-timestamp">Generated: ${formattedDate}</div>
                        <div class="summary-text">${digest.summary}</div>`;
        }
        // Create the row with tab ID, URL, and a placeholder for summary

        // Update the row with the summary
        row.innerHTML = `
                    <td class="tab-id-cell">${tab.id || "N/A"}</td>
                    <td class="url-cell" title="${tab.url}">${tab.url || "N/A"}</td>
                    <td>
                        ${summarySnippet}
                    </td>`;
        tableBody.appendChild(row);

        // Add click event listener to the tab ID cell
        const tabIdCell = row.querySelector(".tab-id-cell");
        if (tabIdCell && tab.id) {
          tabIdCell.classList.add("clickable");
          tabIdCell.addEventListener("click", async () => {
            console.log(`Activating tab with ID: ${tab.id}`);
            try {
              const updatedTab = await chrome.tabs.update(tab.id!, {
                active: true,
              });
              console.log(`Successfully activated tab: ${updatedTab?.id}`);
            } catch (error) {
              console.error(
                `Error activating tab: ${error instanceof Error ? error.message : error}`,
              );
            }
          });
        }
      });

      console.log("Cached summaries displayed in table.");
    }
  }
});

// Helper function to create a session list item with common styling and behavior.
function createSessionListItem(
  label: string,
  isCurrent: boolean,
  sessionId?: string,
): HTMLLIElement {
  const li = document.createElement("li");

  // Create a container for the label to allow for flex layout
  const labelContainer = document.createElement("div");
  labelContainer.className = "session-label";
  labelContainer.textContent = label;
  li.appendChild(labelContainer);

  // Add action menu button for sessions
  const menuButton = document.createElement("button");
  menuButton.className = "session-menu-button";
  menuButton.innerHTML = "⋮"; // Vertical ellipsis
  menuButton.title = "Session actions";
  li.appendChild(menuButton);

  // Create dropdown menu (hidden by default)
  const dropdownMenu = document.createElement("div");
  dropdownMenu.className = "session-dropdown-menu";

  // Add menu items based on whether this is a named session or not
  // TODO: Support right click to open the menu as well.
  if (sessionId) {
    // Actions for named sessions
    const syncAction = document.createElement("div");
    syncAction.className = "session-menu-item";
    syncAction.textContent = "Force Sync to Bookmarks";
    syncAction.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering the li click event
      forceSyncSession(sessionId);
    });
    dropdownMenu.appendChild(syncAction);

    const updateAction = document.createElement("div");
    updateAction.className = "session-menu-item";
    updateAction.textContent = "Update Tabs";
    updateAction.addEventListener("click", (e) => {
      e.stopPropagation();
      updateSessionTabs(sessionId);
    });
    dropdownMenu.appendChild(updateAction);

    const renameAction = document.createElement("div");
    renameAction.className = "session-menu-item";
    renameAction.textContent = "Rename Session";
    renameAction.addEventListener("click", (e) => {
      e.stopPropagation();
      renameSession(sessionId);
    });
    dropdownMenu.appendChild(renameAction);

    const deleteAction = document.createElement("div");
    deleteAction.className = "session-menu-item";
    deleteAction.textContent = "Delete Session";
    deleteAction.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(sessionId);
    });
    dropdownMenu.appendChild(deleteAction);
  } else {
    // Actions for unnamed sessions (windows)
    const createNamedAction = document.createElement("div");
    createNamedAction.className = "session-menu-item";
    createNamedAction.textContent = "Create Named Session";
    createNamedAction.addEventListener("click", (e) => {
      e.stopPropagation();
      promptCreateNamedSession();
    });
    dropdownMenu.appendChild(createNamedAction);
  }

  li.appendChild(dropdownMenu);

  // Toggle dropdown menu when clicking the menu button
  menuButton.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent triggering the li click event
    dropdownMenu.classList.toggle("show");

    // Close other open menus
    document.querySelectorAll(".session-dropdown-menu.show").forEach((menu) => {
      if (menu !== dropdownMenu) {
        menu.classList.remove("show");
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    dropdownMenu.classList.remove("show");
  });

  if (isCurrent) {
    li.classList.add("current-window");
  }
  if (sessionId) {
    li.setAttribute("data-session-id", sessionId);
  }

  return li;
}

/**
 * Force syncs a session to bookmarks
 */
async function forceSyncSession(sessionId: string) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: SYNC_SESSION_TO_BOOKMARKS,
      payload: {
        sessionId,
      },
    });

    if (
      response &&
      response.type === "SYNC_SESSION_TO_BOOKMARKS_RESULT" &&
      response.payload.success
    ) {
      console.log(`Session ${sessionId} synced to bookmarks successfully`);
      alert("Session synced to bookmarks successfully");
      // TODO: Rerender the tabs UI.
    } else {
      console.error("Error syncing session to bookmarks:", response);
      alert("Error syncing session to bookmarks");
    }
  } catch (error) {
    console.error("Error syncing session to bookmarks:", error);
    alert(
      "Error syncing session to bookmarks: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Updates a session's tabs
 */
async function updateSessionTabs(sessionId: string) {
  try {
    // Get the current window ID
    const currentWindow = await chrome.windows.getCurrent();

    const response = await chrome.runtime.sendMessage({
      type: UPDATE_NAMED_SESSION_TABS,
      payload: {
        sessionId,
        windowId: currentWindow.id,
      },
    });

    if (
      response &&
      response.type === "UPDATE_NAMED_SESSION_TABS_RESULT" &&
      response.payload.success
    ) {
      console.log(`Session ${sessionId} tabs updated successfully`);
      alert("Session tabs updated successfully");

      // Refresh the UI with tab information
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows);
        });
      });
    } else {
      console.error("Error updating session tabs:", response);
      alert("Error updating session tabs");
    }
  } catch (error) {
    console.error("Error updating session tabs:", error);
    alert(
      "Error updating session tabs: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Renames a session
 */
async function renameSession(sessionId: string) {
  // Get the current session name to use as default in the prompt
  const session = state_sessions.find((s) => s.id === sessionId);
  if (!session) {
    console.error(`Session with ID ${sessionId} not found`);
    return;
  }

  // Prompt the user for a new name, with the current name as the default
  const newName = prompt("Enter a new name for this session:", session.name);
  if (newName === null) return; // User cancelled
  if (newName.trim() === "") {
    alert("Session name cannot be empty");
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: RENAME_NAMED_SESSION,
      payload: {
        sessionId,
        newName,
      },
    });

    if (
      response &&
      response.type === "RENAME_NAMED_SESSION_RESULT" &&
      response.payload.success
    ) {
      console.log(`Session ${sessionId} renamed to "${newName}" successfully`);

      // Refresh the UI with tab information
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows);
        });
      });
    } else {
      console.error("Error renaming session:", response);
      alert("Error renaming session");
    }
  } catch (error) {
    console.error("Error renaming session:", error);
    alert(
      "Error renaming session: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Deletes a session
 * TODO: We also need to update the URL, so that the associated sessinoId is removed.
 */
async function deleteSession(sessionId: string) {
  // Confirm deletion
  if (
    !confirm(
      "Are you sure you want to delete this session? This will remove the session from the list but not close any windows or tabs.",
    )
  ) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: DELETE_NAMED_SESSION,
      payload: {
        sessionId,
      },
    });

    if (
      response &&
      response.type === "DELETE_NAMED_SESSION_RESULT" &&
      response.payload === "success"
    ) {
      console.log(`Session ${sessionId} deleted successfully`);

      // Refresh the UI with tab information
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows);
        });
      });
    } else {
      console.error("Error deleting session:", response);
      alert("Error deleting session");
    }
  } catch (error) {
    console.error("Error deleting session:", error);
    alert(
      "Error deleting session: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Prompts the user to create a named session for the current window
 */
function promptCreateNamedSession() {
  const sessionName = prompt("Enter a name for this session:");
  if (sessionName === null) return; // User cancelled

  chrome.windows.getCurrent().then(async (window) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: CREATE_NAMED_SESSION,
        payload: {
          windowId: window.id,
          sessionName: sessionName,
        },
      });

      if (response && response.type === "CREATE_NAMED_SESSION_RESULT") {
        console.log("Named Session created:", response.payload);

        // Refresh the UI with tab information
        chrome.windows.getAll({ populate: true }).then((windows) => {
          state_windows = windows;
          chrome.tabs.query({ currentWindow: true }).then((tabs) => {
            state_tabs = tabs;
            updateUI(state_windows);
          });
        });
      } else {
        console.error("Error creating Named Session:", response);
      }
    } catch (error) {
      console.error("Error sending create named session message:", error);
    }
  });
}

// Helper function to create a closed session list item
function createClosedSessionListItem(
  closedSession: ClosedNamedSession,
): HTMLLIElement {
  const li = document.createElement("li");

  // Create a container for the label to allow for flex layout
  const labelContainer = document.createElement("div");
  labelContainer.className = "session-label";
  const tabCount = closedSession.tabs.length;
  labelContainer.textContent = `${closedSession.name} (${tabCount} tab${tabCount !== 1 ? "s" : ""})`;
  li.appendChild(labelContainer);

  // Add action menu button for sessions
  const menuButton = document.createElement("button");
  menuButton.className = "session-menu-button";
  menuButton.innerHTML = "⋮"; // Vertical ellipsis
  menuButton.title = "Session actions";
  li.appendChild(menuButton);

  // Create dropdown menu (hidden by default)
  const dropdownMenu = document.createElement("div");
  dropdownMenu.className = "session-dropdown-menu";

  // Add restore action
  const restoreAction = document.createElement("div");
  restoreAction.className = "session-menu-item";
  restoreAction.textContent = "Restore Session";
  restoreAction.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent triggering the li click event
    restoreClosedSession(closedSession.id);
  });
  dropdownMenu.appendChild(restoreAction);

  // Add delete action
  const deleteAction = document.createElement("div");
  deleteAction.className = "session-menu-item";
  deleteAction.textContent = "Delete Session";
  deleteAction.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteSession(closedSession.id);
  });
  dropdownMenu.appendChild(deleteAction);

  li.appendChild(dropdownMenu);

  // Toggle dropdown menu when clicking the menu button
  menuButton.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent triggering the li click event
    dropdownMenu.classList.toggle("show");

    // Close other open menus
    document.querySelectorAll(".session-dropdown-menu.show").forEach((menu) => {
      if (menu !== dropdownMenu) {
        menu.classList.remove("show");
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    dropdownMenu.classList.remove("show");
  });

  li.setAttribute("data-session-id", closedSession.id);

  // Make the label clickable to view the session's tabs
  labelContainer.addEventListener("click", () => {
    // Clear selection on all items
    document
      .querySelectorAll("#sessions li")
      .forEach((item) => item.classList.remove("selected"));

    li.classList.add("selected");

    // Display the tabs for this closed session
    displayClosedSessionTabs(closedSession);
  });

  // Add double-click handler to restore the session
  li.addEventListener("dblclick", () => {
    console.log(
      `Double-clicked closed session: ${closedSession.id}. Restoring this session.`,
    );
    restoreClosedSession(closedSession.id);
  });
  return li;
}

/**
 * Restores a closed session
 */
async function restoreClosedSession(sessionId: string) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: RESTORE_CLOSED_SESSION,
      payload: {
        sessionId,
      },
    });

    if (
      response &&
      response.type === "RESTORE_CLOSED_SESSION_RESULT" &&
      response.payload.success
    ) {
      console.log(`Session ${sessionId} restored successfully`);
      alert("Session restored successfully");

      // Refresh the UI with tab information
      // TODO: Factor out the common getAll()->updateUI() combinations.
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows);
        });
      });
    } else {
      console.error("Error restoring session:", response);
      alert("Error restoring session");
    }
  } catch (error) {
    console.error("Error restoring session:", error);
    alert(
      "Error restoring session: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Displays the tabs for a closed session in the tabs table
 */
function displayClosedSessionTabs(closedSession: ClosedNamedSession) {
  const tabsTable = tabs_tablist.querySelector("table")!;

  // Update table headers
  const tableHead = tabsTable.querySelector("thead")!;
  tableHead.innerHTML = `
    <tr>
      <th>Title</th>
      <th>URL</th>
      <th>Actions</th>
    </tr>
  `;

  // Clear existing table rows
  const tableBody = tabsTable.querySelector("tbody")!;
  tableBody.innerHTML = "";

  if (closedSession.tabs.length === 0) {
    // No tabs available - add a message row
    const noTabsRow = document.createElement("tr");
    noTabsRow.innerHTML = `
      <td colspan="3">No tabs available in this closed session.</td>
    `;
    tableBody.appendChild(noTabsRow);
    return;
  }

  // Add rows for each tab in the closed session
  closedSession.tabs.forEach((tab) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td class="title-cell" title="${tab.title}">${tab.title || "Untitled"}</td>
      <td class="url-cell" title="${tab.url}">${tab.url || "N/A"}</td>
      <td class="actions-cell">
        <div class="tab-actions">
          <button class="tab-action-button open-button" data-url="${tab.url}">Open</button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });

  // Add event listeners for the open buttons
  document.querySelectorAll(".open-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const target = event.currentTarget as HTMLButtonElement;
      const url = target.getAttribute("data-url") || "";

      if (url) {
        try {
          await chrome.tabs.create({ url });
        } catch (error) {
          console.error("Error opening tab:", error);
        }
      }
    });
  });
}

async function updateUI(
  windows: chrome.windows.Window[],
  selectedSessionByWindowId?: number /* Optionally specify the session to be opened after the UI refresh by windowId. Select the current if undefined. */,
) {
  // Log window and tab information for debugging
  windows.forEach((w) => {
    console.log(`ID: ${w.id}, Tabs: ${w.tabs?.length || 0}`);
  });
  // We don't need to log tabs separately as they're now included in windows

  // ---- Fetch and update Named Sessions ----
  await chrome.runtime
    .sendMessage({ type: GET_NAMED_SESSIONS })
    .then((response) => {
      if (response && response.type === "GET_NAMED_SESSIONS_RESULT") {
        state_sessions = response.payload;
      }
    })
    .catch((err) => {
      console.error("Error fetching named sessions:", err);
    });

  // ---- Fetch and update Closed Named Sessions ----
  let closedSessions: ClosedNamedSession[] = [];
  try {
    let response = await chrome.runtime.sendMessage({
      type: GET_CLOSED_NAMED_SESSIONS,
    });
    if (response && response.type === "GET_CLOSED_NAMED_SESSIONS_RESULT") {
      closedSessions = response.payload.closedSessions || [];
    }
  } catch (err) {
    console.error("Error fetching closed named sessions:", err);
  }

  // ---- Update the UI for Named, Unnamed, and Closed Sessions ----
  // Get all containers:
  const namedSessionsContainer =
    document.querySelector<HTMLDivElement>("#named_sessions")!;
  const namedList = namedSessionsContainer.querySelector("ul")!;
  const unnamedSessionsContainer =
    document.querySelector<HTMLDivElement>("#tabs_sessions")!;
  const unnamedList = unnamedSessionsContainer.querySelector("ul")!;
  const closedSessionsContainer =
    document.querySelector<HTMLDivElement>("#closed_sessions")!;
  const closedList = closedSessionsContainer.querySelector("ul")!;

  // Clear existing items in all lists:
  namedList.innerHTML = "";
  unnamedList.innerHTML = "";
  closedList.innerHTML = "";

  // Track the current window to auto-select it
  let currentWindowItem: HTMLLIElement | undefined = undefined;
  // Auto-select the specified window and load its tabs
  let selectedWindowId: number | undefined;
  let selectedWindowItem: HTMLLIElement | undefined = undefined;

  // Add a list item for each window
  for (let i = 0; i < windows.length; i++) {
    const win = windows[i];
    // Count non-pinned tabs for this window
    let tabCount = 0;
    if (win.tabs) {
      tabCount = win.tabs.filter((tab) => !tab.pinned).length;
    }

    // Determine if a named session exists for this window
    const associatedSession = state_sessions.find(
      (session) => session.windowId === win.id && session.name,
    );

    // Build the label based on whether a Named Session exists
    let label = "";
    if (associatedSession) {
      label = `Named Session: ${associatedSession.name} (Window: ${win.id}, ${tabCount} tab${tabCount !== 1 ? "s" : ""})`;
    } else {
      label = `Window ${win.id} (${tabCount} tab${tabCount !== 1 ? "s" : ""})`;
    }

    const isCurrent = win.focused;
    // Create the list item with single-click handler to select the window
    const listItem = createSessionListItem(
      label,
      isCurrent,
      associatedSession?.id,
    );

    // Make the label clickable to select the session
    listItem.addEventListener("click", () => {
      // Clear selection on all items and mark this one as selected
      namedList
        .querySelectorAll("li")
        .forEach((item) => item.classList.remove("selected"));
      unnamedList
        .querySelectorAll("li")
        .forEach((item) => item.classList.remove("selected"));

      listItem.classList.add("selected");

      console.log(`Selected window: ${win.id}`);
      if (win.id) {
        const winId = win.id;
        chrome.tabs.query({ windowId: winId }).then((windowTabs) => {
          console.log(`Found ${windowTabs.length} tabs in window ${win.id}`);
          updateTabsTable(winId, windowTabs);
        });

        // If this is a named session, fetch and display saved bookmarks and synced tabs
        if (associatedSession) {
          fetchAndDisplaySavedBookmarks(associatedSession.id);
          fetchAndDisplaySyncedTabs(associatedSession.id);
          // Update session metadata
          updateSessionMetadata(associatedSession);
        } else {
          // Clear saved bookmarks and synced tabs if this is not a named session
          clearSavedBookmarks();
          clearSyncedTabs();
          // Update session metadata for unnamed window
          updateSessionMetadata(null, win.id);
        }
      }
    });

    // Add double-click handler to switch to the window
    if (win.id) {
      listItem.addEventListener("dblclick", async () => {
        console.log(
          `Double-clicked window: ${win.id}. Switching to this window.`,
        );
        try {
          // Additionally reload the tabs.html in that window or open it if not yet opened
          try {
            await ensureTabsHtmlInWindow(win.id!);
          } catch (error) {
            console.error(
              `Error managing tabs.html in window ${win.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
          await chrome.windows.update(win.id!, { focused: true });
          console.log(`Successfully switched to window: ${win.id}`);
        } catch (error) {
          console.error(
            `Error switching to window: ${error instanceof Error ? error.message : error}`,
          );
        }
      });
    }

    if (isCurrent) {
      currentWindowItem = listItem;
    }
    if (selectedSessionByWindowId && selectedSessionByWindowId == win.id) {
      selectedWindowId = selectedSessionByWindowId;
      selectedWindowItem = listItem;
    }
    if (associatedSession) {
      namedList.appendChild(listItem);
    } else {
      unnamedList.appendChild(listItem);
    }
  }

  // Add closed sessions to the UI
  if (closedSessions.length === 0) {
    // No closed sessions available - add a message
    const noSessionsItem = document.createElement("li");
    noSessionsItem.textContent = "No closed sessions available";
    closedList.appendChild(noSessionsItem);
  } else {
    // Add each closed session
    closedSessions.forEach((session) => {
      const listItem = createClosedSessionListItem(session);
      closedList.appendChild(listItem);
    });
  }

  // Override the selected window with the current window is not yet specified.
  if (!selectedWindowItem) {
    selectedWindowId = windows.find((w) => w.focused)?.id;
    selectedWindowItem = currentWindowItem;
  }

  // If a window item is found, select it and load its tabs
  // TODO: if we can skip this defined check.
  if (selectedWindowItem) {
    selectedWindowItem.classList.add("selected");
    if (selectedWindowId) {
      chrome.tabs.query({ windowId: selectedWindowId }).then((windowTabs) => {
        console.log(
          `Auto-loading ${windowTabs.length} tabs for selected window ${selectedWindowId}`,
        );
        updateTabsTable(selectedWindowId, windowTabs);
      });

      // If this is a named session, fetch and display saved bookmarks and synced tabs
      const associatedSession = state_sessions.find(
        (session) => session.windowId === selectedWindowId && session.name,
      );
      // TODO: We have similar code snippet in this method. Consider refactoring them into renderSessionTabsPane() or something.
      if (associatedSession) {
        fetchAndDisplaySavedBookmarks(associatedSession.id);
        fetchAndDisplaySyncedTabs(associatedSession.id);
        // Update session metadata
        updateSessionMetadata(associatedSession);
      } else {
        // Clear saved bookmarks and synced tabs if this is not a named session
        clearSavedBookmarks();
        clearSyncedTabs();
        // Update session metadata for unnamed window
        updateSessionMetadata(null, selectedWindowId);
      }
    }
  }
}

// Helper function to update the tabs table with tabs from a specific window
async function updateTabsTable(windowId: number, tabs: chrome.tabs.Tab[]) {
  const tabsTable = tabs_tablist.querySelector("table")!;

  // Update table headers - now including the summary column and actions
  // TODO: Show the tabs found in the bookmark backend but not-opened in the current window.
  const tableHead = tabsTable.querySelector("thead")!;
  tableHead.innerHTML = `
        <tr>
            <th>Tab ID</th>
            <th>Title</th>
            <th>URL</th>
            <th>Status</th>
            <th>Summary</th>
            <th>Actions</th>
        </tr>
    `;

  // Clear existing table rows
  const tableBody = tabsTable.querySelector("tbody")!;
  tableBody.innerHTML = "";

  // Filter out all pinned tabs
  const filteredTabs = tabs.filter((tab) => !tab.pinned);

  if (filteredTabs.length === 0) {
    // No tabs available - add a message row
    const noTabsRow = document.createElement("tr");
    noTabsRow.innerHTML = `
            <td colspan="6">No tabs available in this window (excluding pinned tabs).</td>
        `;
    tableBody.appendChild(noTabsRow);
    return;
  }

  // Get the current session if it's a named session
  const currentWindow = tabs[0]?.windowId;
  const currentSession = state_sessions.find(
    (session) => session.windowId === currentWindow && session.name,
  );

  // Get synced bookmarks for the current session if it exists
  // TODO: Rename the vatiable to syncedOpenTabs.
  let syncedBookmarks: SavedBookmark[] = [];
  if (currentSession) {
    try {
      // Get synced bookmarks via session_management abstraction
      const response = await chrome.runtime.sendMessage({
        type: GET_SYNCED_OPENTABS,
        payload: {
          sessionId: currentSession.id,
        },
      });

      if (
        response &&
        response.type === "GET_SYNCED_OPENTABS_RESULT" &&
        response.payload.bookmarks
      ) {
        syncedBookmarks = response.payload.bookmarks;
      }
    } catch (error) {
      console.error("Error fetching synced bookmarks:", error);
    }
  }

  // Create a set of synced URLs for quick lookup
  const syncedUrls = new Set(syncedBookmarks.map((bookmark) => bookmark.url));

  // Collect all tab URLs to request summaries (only from non-pinned tabs)
  const tabUrls: string[] = filteredTabs
    .map((tab) => tab.url!)
    .filter((url) => url);

  // Request cached summaries for all tabs
  let allTabSummaries: TabSummary[] = [];
  try {
    const cachedDigestResponse = await chrome.runtime.sendMessage({
      type: GET_CACHED_SUMMARIES,
      payload: {
        tabUrls: tabUrls,
      },
    });

    if (
      cachedDigestResponse &&
      cachedDigestResponse.type === "CACHED_SUMMARIES_RESULT"
    ) {
      allTabSummaries = cachedDigestResponse.payload.tabSummaries || [];
    }
  } catch (error) {
    console.error("Error fetching tab summaries:", error);
  }

  // Add rows for each tab (using the filtered list that excludes pinned tabs)
  filteredTabs.forEach((tab) => {
    const row = document.createElement("tr");

    // Find the summary for this tab
    let summarySnippet = "No summary available yet.";
    if (tab.url) {
      const tabSummary = allTabSummaries.find(
        (summary) => summary.url === tab.url,
      );
      if (tabSummary && tabSummary.summaries.length > 0) {
        const digest = tabSummary.summaries[0]; // Get the most recent summary
        const date = new Date(digest.timestamp);
        const formattedDate = date.toLocaleString();
        summarySnippet = `
                    <div class="summary-timestamp">Generated: ${formattedDate}</div>
                    <div class="summary-text">${digest.summary}</div>`;
      }
    }

    // Determine sync status
    // TODO: We may add these indicator in the title cell instead of building a dedicated column.
    let syncStatus = "";
    if (currentSession && tab.url) {
      if (syncedUrls.has(tab.url)) {
        syncStatus = `<span class="sync-status synced" title="Tab is synced to bookmarks">✓</span>`;
      } else {
        syncStatus = `<span class="sync-status not-synced" title="Tab exists in window but is not synced to bookmarks">⚠️</span>`;
      }
    } else if (!currentSession) {
      syncStatus = `<span class="sync-status no-session" title="No named session for this window">-</span>`;
    }

    row.innerHTML = `
            <td class="tab-id-cell">${tab.id || "N/A"}</td>
            <td class="title-cell" title="${tab.title}">${tab.title || "Untitled"}</td>
            <td class="url-cell" title="${tab.url}">${tab.url || "N/A"}</td>
            <td class="sync-status-cell">${syncStatus}</td>
            <td class="summary-cell">${summarySnippet}</td>
            <td class="actions-cell">
                <div class="tab-actions">
                    <button class="tab-action-button migrate-button" data-tab-id="${tab.id}" data-tab-url="${tab.url}">Migrate</button>
                    <button class="tab-action-button save-button" data-tab-id="${tab.id}" data-tab-url="${tab.url}">Save</button>
                    <button class="tab-action-button close-button" data-tab-id="${tab.id}">Close</button>
                </div>
            </td>`;
    tableBody.appendChild(row);

    // Add click event listener to the tab ID cell
    const tabIdCell = row.querySelector(".tab-id-cell");
    if (tabIdCell && tab.id) {
      tabIdCell.classList.add("clickable");
      tabIdCell.addEventListener("click", async () => {
        console.log(`Activating tab with ID: ${tab.id}`);
        try {
          // Activate the window first
          if (tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
          }
          // Then activate the tab
          const updatedTab = await chrome.tabs.update(tab.id!, {
            active: true,
          });
          console.log(`Successfully activated tab: ${updatedTab?.id}`);
        } catch (error) {
          console.error(
            `Error activating tab: ${error instanceof Error ? error.message : error}`,
          );
        }
      });
    }
  });

  // Add event listeners for the migrate buttons
  document.querySelectorAll(".migrate-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const target = event.currentTarget as HTMLButtonElement;
      const tabId = parseInt(target.getAttribute("data-tab-id") || "0");
      const tabUrl = target.getAttribute("data-tab-url") || "";

      if (tabId && tabUrl) {
        showMigrationDialog(tabId, tabUrl);
      }
    });
  });

  // Add event listeners for the save buttons
  document.querySelectorAll(".save-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const target = event.currentTarget as HTMLButtonElement;
      const tabId = parseInt(target.getAttribute("data-tab-id") || "0");
      const tabUrl = target.getAttribute("data-tab-url") || "";

      if (tabId && tabUrl) {
        saveTabToBookmarks(tabId);
      }
    });
  });

  // Add event listener for the close button
  document.querySelectorAll(".close-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const target = event.currentTarget as HTMLButtonElement;
      const tabId = parseInt(target.getAttribute("data-tab-id") || "0");

      if (tabId) {
        try {
          await chrome.tabs.remove(tabId);
          state_tabs = state_tabs.filter((t) => t.id !== tabId);
          // TODO: This updateUI should show the UI for the currently selected window panel.
          updateUI(state_windows, windowId);
        } catch (error) {
          console.error(
            `Error closing tab: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    });
  });
}

// Function to show the migration dialog
async function showMigrationDialog(tabId: number, tabUrl: string) {
  const dialog = document.querySelector<HTMLDivElement>("#migrationDialog")!;
  const tabInfoDiv =
    document.querySelector<HTMLDivElement>("#migrationTabInfo")!;
  const suggestedDestinationsDiv = document.querySelector<HTMLDivElement>(
    "#suggestedDestinations",
  )!;
  const allDestinationsDiv =
    document.querySelector<HTMLDivElement>("#allDestinations")!;

  // Get the tab details
  const tab = await chrome.tabs.get(tabId);

  // Display tab info
  tabInfoDiv.innerHTML = `
    <p><strong>Tab:</strong> ${tab.title}</p>
    <p><strong>URL:</strong> ${tab.url}</p>
  `;

  // Show the dialog
  dialog.style.display = "flex";

  // Get all tabs for embedding comparison
  const allTabs = await chrome.tabs.query({});
  const tabUrls = allTabs
    .map((tab) => tab.url!)
    .filter((url) => url && url !== tabUrl);

  // Request suggested destinations
  suggestedDestinationsDiv.innerHTML = "<p>Loading suggestions...</p>";

  try {
    const suggestionsResponse = await chrome.runtime.sendMessage({
      type: SUGGEST_TAB_DESTINATIONS,
      payload: {
        tabUrl,
        tabUrls,
      },
    });

    if (
      suggestionsResponse &&
      suggestionsResponse.type === "SUGGEST_TAB_DESTINATIONS_RESULT"
    ) {
      const suggestions = suggestionsResponse.payload.suggestions;

      if (suggestions.length === 0) {
        suggestedDestinationsDiv.innerHTML = "<p>No suggestions available.</p>";
      } else {
        suggestedDestinationsDiv.innerHTML = "";

        // Create a destination option for each suggestion
        suggestions.forEach(
          (suggestion: {
            session: NamedSession;
            averageSimilarity: number;
          }) => {
            const { session, averageSimilarity } = suggestion;
            const similarityPercentage = Math.round(averageSimilarity * 100);

            const destinationOption = document.createElement("div");
            destinationOption.className = "destination-option";
            destinationOption.innerHTML = `
            <div class="destination-name">${session.name || `Window ${session.windowId}`}</div>
            <div class="similarity-score">${similarityPercentage}% match</div>
          `;

            // Add click event to migrate the tab
            destinationOption.addEventListener("click", async () => {
              if (session.windowId) {
                await migrateTab(tabId, session.windowId);
                dialog.style.display = "none";
              }
            });

            suggestedDestinationsDiv.appendChild(destinationOption);
          },
        );
      }
    } else {
      suggestedDestinationsDiv.innerHTML = "<p>Error loading suggestions.</p>";
    }
  } catch (error) {
    console.error("Error getting suggestions:", error);
    suggestedDestinationsDiv.innerHTML = "<p>Error loading suggestions.</p>";
  }

  // Display all windows as potential destinations
  allDestinationsDiv.innerHTML = "";

  // Get all windows
  const windows = await chrome.windows.getAll();

  // Create a destination option for each window (except the current one)
  windows.forEach((window) => {
    if (window.id !== tab.windowId) {
      const destinationOption = document.createElement("div");
      destinationOption.className = "destination-option";

      // Find if this window has a named session
      const session = state_sessions.find((s) => s.windowId === window.id);

      destinationOption.innerHTML = `
        <div class="destination-name">${session?.name ? `${session.name} (Window ${window.id})` : `Window ${window.id}`}</div>
      `;

      // Add click event to migrate the tab
      destinationOption.addEventListener("click", async () => {
        if (window.id) {
          await migrateTab(tabId, window.id);
          dialog.style.display = "none";
        }
      });

      allDestinationsDiv.appendChild(destinationOption);
    }
  });

  // Add event listener for the cancel button
  const cancelButton = document.querySelector<HTMLButtonElement>(
    "#cancelMigrationButton",
  )!;
  cancelButton.addEventListener("click", () => {
    dialog.style.display = "none";
  });
}

// Function to migrate a tab to another window
async function migrateTab(tabId: number, windowId: number) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MIGRATE_TAB,
      payload: {
        tabId,
        windowId,
      },
    });

    if (response && response.type === "MIGRATE_TAB_RESULT") {
      console.log("Tab migrated successfully:", response.payload);

      // Refresh the UI with tab information
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows);
        });
      });
    } else {
      console.error("Error migrating tab:", response);
    }
  } catch (error) {
    console.error("Error sending migrate tab message:", error);
  }
}

// Add event listener for the "Categorize Tabs" button
const categorizeTabsButton = document.querySelector<HTMLButtonElement>(
  "#categorizeTabsButton",
);
if (categorizeTabsButton) {
  categorizeTabsButton.addEventListener("click", async () => {
    showCategoriesDialog();
  });
}

// Function to show the categories dialog
async function showCategoriesDialog() {
  const dialog = document.querySelector<HTMLDivElement>("#categoriesDialog")!;
  const categoriesList =
    document.querySelector<HTMLDivElement>("#categoriesList")!;

  // Show the dialog
  dialog.style.display = "flex";
  categoriesList.innerHTML = "<p>Analyzing tabs...</p>";

  // Get all tabs for categorization
  const allTabs = await chrome.tabs.query({});

  // Filter out pinned tabs
  const filteredTabs = allTabs.filter((tab) => !tab.pinned);

  // Collect all tab URLs
  const tabUrls: string[] = filteredTabs
    .map((tab) => tab.url!)
    .filter((url) => url);

  if (tabUrls.length < 2) {
    categoriesList.innerHTML = "<p>Not enough tabs to categorize.</p>";
    return;
  }

  try {
    // Request tab categorization
    const categoriesResponse = await chrome.runtime.sendMessage({
      type: CATEGORIZE_TABS,
      payload: {
        tabUrls,
      },
    });

    if (
      categoriesResponse &&
      categoriesResponse.type === "CATEGORIZE_TABS_RESULT"
    ) {
      const categories = categoriesResponse.payload.categories;

      if (!categories || categories.length === 0) {
        categoriesList.innerHTML =
          "<p>No categories found. Try generating more tab summaries first.</p>";
        return;
      }

      // Display the categories
      categoriesList.innerHTML = "";

      categories.forEach((category: { category: string; tabs: string[] }) => {
        const categoryDiv = document.createElement("div");
        categoryDiv.className = "category-group";

        // Create category header
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "category-name";
        categoryHeader.textContent = category.category;
        categoryDiv.appendChild(categoryHeader);

        // Create tabs list
        const tabsList = document.createElement("div");
        tabsList.className = "category-tabs";

        // Add each tab in this category
        category.tabs.forEach((tabUrl) => {
          // Find the tab with this URL
          const tab = filteredTabs.find((t) => t.url === tabUrl);
          if (tab) {
            const tabDiv = document.createElement("div");
            tabDiv.className = "category-tab";
            tabDiv.innerHTML = `
              <div class="tab-title">${tab.title || "Untitled"}</div>
              <div class="tab-actions">
                <button class="tab-action-button activate-button" data-tab-id="${tab.id}">Activate</button>
                <button class="tab-action-button migrate-button" data-tab-id="${tab.id}" data-tab-url="${tab.url}">Migrate</button>
              </div>
            `;
            tabsList.appendChild(tabDiv);
          }
        });

        categoryDiv.appendChild(tabsList);
        categoriesList.appendChild(categoryDiv);
      });

      // Add event listeners for the activate buttons
      document
        .querySelectorAll(".category-tab .activate-button")
        .forEach((button) => {
          button.addEventListener("click", async (event) => {
            const target = event.currentTarget as HTMLButtonElement;
            const tabId = parseInt(target.getAttribute("data-tab-id") || "0");

            if (tabId) {
              try {
                const tab = await chrome.tabs.get(tabId);
                // Activate the window first
                if (tab.windowId) {
                  await chrome.windows.update(tab.windowId, { focused: true });
                }
                // Then activate the tab
                await chrome.tabs.update(tabId, { active: true });
              } catch (error) {
                console.error("Error activating tab:", error);
              }
            }
          });
        });

      // Add event listeners for the migrate buttons
      document
        .querySelectorAll(".category-tab .migrate-button")
        .forEach((button) => {
          button.addEventListener("click", async (event) => {
            const target = event.currentTarget as HTMLButtonElement;
            const tabId = parseInt(target.getAttribute("data-tab-id") || "0");
            const tabUrl = target.getAttribute("data-tab-url") || "";

            if (tabId && tabUrl) {
              // Hide the categories dialog
              dialog.style.display = "none";
              // Show the migration dialog
              showMigrationDialog(tabId, tabUrl);
            }
          });
        });
    } else {
      categoriesList.innerHTML = "<p>Error categorizing tabs.</p>";
    }
  } catch (error) {
    console.error("Error categorizing tabs:", error);
    categoriesList.innerHTML = "<p>Error categorizing tabs.</p>";
  }

  // Add event listener for the close button
  const closeButton = document.querySelector<HTMLButtonElement>(
    "#closeCategoriesButton",
  )!;
  closeButton.addEventListener("click", () => {
    dialog.style.display = "none";
  });
}

/**
 * Saves a tab to bookmarks for the current session
 */
async function saveTabToBookmarks(tabId: number) {
  try {
    // Get the currently selected session
    const selectedSessionItem = document.querySelector(
      "#named_sessions li.selected",
    );
    if (!selectedSessionItem) {
      alert("Please select a named session first");
      return;
    }

    // Extract session ID from the selected item
    // This assumes the session ID is stored in a data attribute
    const sessionId = selectedSessionItem.getAttribute("data-session-id");
    if (!sessionId) {
      alert("No session ID found for the selected session");
      return;
    }

    // Save the tab to bookmarks
    const response = await chrome.runtime.sendMessage({
      type: SAVE_TAB_TO_BOOKMARKS,
      payload: {
        sessionId,
        tabId,
        metadata: {
          savedAt: Date.now(),
          tags: ["saved-tab"],
        },
      },
    });

    if (
      response &&
      response.type === "SAVE_TAB_TO_BOOKMARKS_RESULT" &&
      response.payload.success
    ) {
      console.log("Tab saved to bookmarks successfully");
      alert("Tab saved to bookmarks successfully");
    } else {
      console.error("Error saving tab to bookmarks:", response);
      alert("Error saving tab to bookmarks");
    }
  } catch (error) {
    console.error("Error saving tab to bookmarks:", error);
    alert(
      "Error saving tab to bookmarks: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

// After the existing event listener for requestTabSummariesButton (or near the end of the file),
// add the following code to handle Named Session creation:

const createNamedSessionButton = document.querySelector<HTMLButtonElement>(
  "#createNamedSessionButton",
);
const namedSessionInput =
  document.querySelector<HTMLInputElement>("#namedSessionInput");

if (createNamedSessionButton && namedSessionInput) {
  createNamedSessionButton.addEventListener("click", async () => {
    const sessionName = namedSessionInput.value || null;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      const response = await chrome.runtime.sendMessage({
        type: CREATE_NAMED_SESSION,
        payload: {
          windowId: currentWindow.id,
          sessionName: sessionName,
        },
      });
      if (response && response.type === "CREATE_NAMED_SESSION_RESULT") {
        console.log("Named Session created:", response.payload);
        // Refresh the sessions list by fetching the latest windows and tabs, then update the UI.
        chrome.windows.getAll({ populate: true }).then((windows) => {
          state_windows = windows;
          chrome.tabs.query({ currentWindow: true }).then((tabs) => {
            state_tabs = tabs;
            updateUI(state_windows);
          });
        });
      } else {
        console.error("Error creating Named Session:", response);
      }
    } catch (error) {
      console.error("Error sending create named session message:", error);
    }
  });
}

/**
 * Fetches and displays synced tabs for a session
 * Shows only tabs that are in the backend but not currently open in the window
 */
async function fetchAndDisplaySyncedTabs(sessionId: string) {
  try {
    // Get synced tabs for the session
    // TODO: We have duplicated calls for GET_SYNCED_OPENTABS here and in updateTabsTable. Consider refactoring.
    const response = await chrome.runtime.sendMessage({
      type: GET_SYNCED_OPENTABS,
      payload: {
        sessionId,
      },
    });

    if (
      !response ||
      response.type !== "GET_SYNCED_OPENTABS_RESULT" ||
      !response.payload.bookmarks
    ) {
      console.error("Error fetching synced tabs:", response);
      clearSyncedTabs();
      return;
    }

    const syncedTabs: SavedBookmark[] = response.payload.bookmarks;

    // Get all currently open tabs in the current window
    const currentWindow = await chrome.windows.getCurrent();
    const openTabs = await chrome.tabs.query({ windowId: currentWindow.id });

    // Create a set of open tab URLs for quick lookup
    const openTabUrls = new Set(openTabs.map((tab) => tab.url));

    // Filter synced tabs to only those that aren't already open
    const tabsNotOpen = syncedTabs.filter((tab) => !openTabUrls.has(tab.url));

    // Display the tabs that aren't open
    displaySyncedTabs(tabsNotOpen);
  } catch (error) {
    console.error("Error fetching synced tabs:", error);
    clearSyncedTabs();
  }
}

/**
 * Displays synced tabs in the synced tabs section
 */
function displaySyncedTabs(tabs: SavedBookmark[]) {
  const syncedTabsContainer =
    document.querySelector<HTMLDivElement>("#synced_tabs")!;
  const tabsList = syncedTabsContainer.querySelector("ul")!;

  // Clear existing tabs
  tabsList.innerHTML = "";

  if (tabs.length === 0) {
    // No tabs available - add a message
    const noTabsItem = document.createElement("li");
    noTabsItem.textContent = "No synced tabs from other devices found";
    tabsList.appendChild(noTabsItem);
    return;
  }

  // Add each tab to the list
  tabs.forEach((tab) => {
    const listItem = document.createElement("li");

    // Create tab title container
    const titleContainer = document.createElement("div");
    titleContainer.className = "synced-tab-title";
    titleContainer.textContent = tab.title || tab.url;
    titleContainer.title = tab.url;
    listItem.appendChild(titleContainer);

    // Create tab actions container
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "synced-tab-actions";

    // Add open button
    const openButton = document.createElement("button");
    openButton.className = "synced-tab-action-button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", async () => {
      try {
        await chrome.tabs.create({ url: tab.url });
      } catch (error) {
        console.error("Error opening tab:", error);
        alert(
          "Error opening tab: " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    });
    actionsContainer.appendChild(openButton);

    listItem.appendChild(actionsContainer);

    tabsList.appendChild(listItem);
  });
}

/**
 * Clears the synced tabs section
 */
function clearSyncedTabs() {
  const syncedTabsContainer =
    document.querySelector<HTMLDivElement>("#synced_tabs")!;
  const tabsList = syncedTabsContainer.querySelector("ul")!;

  // Clear existing tabs
  tabsList.innerHTML = "";

  // Add a message
  const noTabsItem = document.createElement("li");
  noTabsItem.textContent =
    "Select a named session to view tabs from other devices";
  tabsList.appendChild(noTabsItem);
}

/**
 * Fetches and displays saved bookmarks for a session
 */
async function fetchAndDisplaySavedBookmarks(sessionId: string) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: GET_SAVED_BOOKMARKS,
      payload: {
        sessionId,
      },
    });

    if (
      response &&
      response.type === "GET_SAVED_BOOKMARKS_RESULT" &&
      response.payload.bookmarks
    ) {
      const bookmarks: SavedBookmark[] = response.payload.bookmarks;
      displaySavedBookmarks(bookmarks);
    } else {
      console.error("Error fetching saved bookmarks:", response);
      clearSavedBookmarks();
    }
  } catch (error) {
    console.error("Error fetching saved bookmarks:", error);
    clearSavedBookmarks();
  }
}

/**
 * Displays saved bookmarks in the saved bookmarks section
 */
function displaySavedBookmarks(bookmarks: SavedBookmark[]) {
  const savedBookmarksContainer =
    document.querySelector<HTMLDivElement>("#saved_bookmarks")!;
  const bookmarksList = savedBookmarksContainer.querySelector("ul")!;

  // Clear existing bookmarks
  bookmarksList.innerHTML = "";

  if (bookmarks.length === 0) {
    // No bookmarks available - add a message
    const noBookmarksItem = document.createElement("li");
    noBookmarksItem.textContent = "No saved bookmarks for this session";
    bookmarksList.appendChild(noBookmarksItem);
    return;
  }

  // Add each bookmark to the list
  bookmarks.forEach((bookmark) => {
    const listItem = document.createElement("li");

    // Create bookmark title container
    const titleContainer = document.createElement("div");
    titleContainer.className = "bookmark-title";
    titleContainer.textContent = bookmark.title || bookmark.url;
    titleContainer.title = bookmark.url;
    listItem.appendChild(titleContainer);

    // Create bookmark actions container
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "bookmark-actions";

    // Add open button
    const openButton = document.createElement("button");
    openButton.className = "bookmark-action-button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => {
      openSavedBookmark(bookmark.id);
    });
    actionsContainer.appendChild(openButton);

    listItem.appendChild(actionsContainer);

    // Add metadata if available
    if (bookmark.metadata && bookmark.metadata.savedAt) {
      const metadataContainer = document.createElement("div");
      metadataContainer.className = "bookmark-metadata";

      const savedDate = new Date(bookmark.metadata.savedAt);
      metadataContainer.textContent = `Saved: ${savedDate.toLocaleString()}`;

      // Add tags if available
      if (bookmark.metadata.tags && bookmark.metadata.tags.length > 0) {
        metadataContainer.textContent += ` | Tags: ${bookmark.metadata.tags.join(", ")}`;
      }

      listItem.appendChild(metadataContainer);
    }

    bookmarksList.appendChild(listItem);
  });
}

/**
 * Clears the saved bookmarks section
 */
function clearSavedBookmarks() {
  const savedBookmarksContainer =
    document.querySelector<HTMLDivElement>("#saved_bookmarks")!;
  const bookmarksList = savedBookmarksContainer.querySelector("ul")!;

  // Clear existing bookmarks
  bookmarksList.innerHTML = "";

  // Add a message
  const noBookmarksItem = document.createElement("li");
  noBookmarksItem.textContent =
    "Select a named session to view saved bookmarks";
  bookmarksList.appendChild(noBookmarksItem);
}

/**
 * Opens a saved bookmark in a new tab
 */
async function openSavedBookmark(bookmarkId: string) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: OPEN_SAVED_BOOKMARK,
      payload: {
        bookmarkId,
      },
    });

    if (
      response &&
      response.type === "OPEN_SAVED_BOOKMARK_RESULT" &&
      response.payload.success
    ) {
      console.log(`Bookmark ${bookmarkId} opened successfully`);
    } else {
      console.error("Error opening bookmark:", response);
      alert("Error opening bookmark");
    }
  } catch (error) {
    console.error("Error opening bookmark:", error);
    alert(
      "Error opening bookmark: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Opens all bookmarks that aren't already open in the current window
 */
async function openAllBookmarks() {
  try {
    // TODO: Consider deciding these common logi about the UI state.
    // Get the currently selected session
    const selectedSessionItem = document.querySelector(
      "#named_sessions li.selected",
    );
    if (!selectedSessionItem) {
      alert("Please select a named session first");
      return;
    }

    // Extract session ID from the selected item
    const sessionId = selectedSessionItem.getAttribute("data-session-id");
    if (!sessionId) {
      alert("No session ID found for the selected session");
      return;
    }

    // TODO: Consider if we can/should use the already filled HTML elements to know the URLs to open.
    // Get all saved bookmarks for this session
    const bookmarksResponse = await chrome.runtime.sendMessage({
      type: GET_SAVED_BOOKMARKS,
      payload: {
        sessionId,
      },
    });

    if (
      !bookmarksResponse ||
      bookmarksResponse.type !== "GET_SAVED_BOOKMARKS_RESULT" ||
      !bookmarksResponse.payload.bookmarks
    ) {
      alert("Error fetching bookmarks");
      return;
    }

    const bookmarks: SavedBookmark[] = bookmarksResponse.payload.bookmarks;
    if (bookmarks.length === 0) {
      alert("No bookmarks found for this session");
      return;
    }

    // Get all currently open tabs
    const currentWindow = await chrome.windows.getCurrent();
    const openTabs = await chrome.tabs.query({ windowId: currentWindow.id });

    // Create a set of open tab URLs for quick lookup
    const openTabUrls = new Set(openTabs.map((tab) => tab.url));

    // Filter bookmarks to only those that aren't already open
    const bookmarksToOpen = bookmarks.filter(
      (bookmark) => !openTabUrls.has(bookmark.url),
    );

    if (bookmarksToOpen.length === 0) {
      alert("All bookmarks are already open in this window");
      return;
    }

    // Open each bookmark that isn't already open
    let openCount = 0;
    for (const bookmark of bookmarksToOpen) {
      try {
        await chrome.tabs.create({ url: bookmark.url });
        openCount++;
      } catch (error) {
        console.error(`Error opening bookmark ${bookmark.id}:`, error);
      }
    }

    alert(`Successfully opened ${openCount} bookmarks`);
  } catch (error) {
    console.error("Error opening all bookmarks:", error);
    alert(
      "Error opening all bookmarks: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Opens all synced tabs that aren't already open in the current window
 */
async function openAllSyncedTabs() {
  try {
    // Get the currently selected session
    const selectedSessionItem = document.querySelector(
      "#named_sessions li.selected",
    );
    if (!selectedSessionItem) {
      alert("Please select a named session first");
      return;
    }

    // Extract session ID from the selected item
    const sessionId = selectedSessionItem.getAttribute("data-session-id");
    if (!sessionId) {
      alert("No session ID found for the selected session");
      return;
    }

    // Get all synced tabs for this session
    const syncedTabsResponse = await chrome.runtime.sendMessage({
      type: GET_SYNCED_OPENTABS,
      payload: {
        sessionId,
      },
    });

    if (
      !syncedTabsResponse ||
      syncedTabsResponse.type !== "GET_SYNCED_OPENTABS_RESULT" ||
      !syncedTabsResponse.payload.bookmarks
    ) {
      alert("Error fetching synced tabs");
      return;
    }

    const syncedTabs: SavedBookmark[] = syncedTabsResponse.payload.bookmarks;
    if (syncedTabs.length === 0) {
      alert("No synced tabs found for this session");
      return;
    }

    // Get all currently open tabs
    const currentWindow = await chrome.windows.getCurrent();
    const openTabs = await chrome.tabs.query({ windowId: currentWindow.id });

    // Create a set of open tab URLs for quick lookup
    const openTabUrls = new Set(openTabs.map((tab) => tab.url));

    // Filter synced tabs to only those that aren't already open
    const tabsToOpen = syncedTabs.filter((tab) => !openTabUrls.has(tab.url));

    if (tabsToOpen.length === 0) {
      alert("All synced tabs are already open in this window");
      return;
    }

    // Open each synced tab that isn't already open
    let openCount = 0;
    for (const tab of tabsToOpen) {
      try {
        await chrome.tabs.create({ url: tab.url });
        openCount++;
      } catch (error) {
        console.error(
          `Error opening synced tab: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    alert(`Successfully opened ${openCount} synced tabs`);
  } catch (error) {
    console.error("Error opening all synced tabs:", error);
    alert(
      "Error opening all synced tabs: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

// Renderer for Session Metadata:
const sessionMetadataElement =
  document.querySelector<HTMLDivElement>("#session_metadata")!;
/**
 * Updates the session metadata display
 * @param session The named session, or null if this is an unnamed window
 * @param windowId The window ID (only used if session is null)
 */
function updateSessionMetadata(
  session: NamedSession | null,
  windowId?: number,
) {
  if (session) {
    // Format the creation and update dates
    const createdDate = new Date(session.createdAt).toLocaleString();
    const updatedDate = new Date(session.updatedAt).toLocaleString();

    // Display session metadata
    sessionMetadataElement.innerHTML = `
      Session ID: ${session.id} | 
      Window ID: ${session.windowId} | 
      Created: ${createdDate} | 
      Updated: ${updatedDate}
    `;
  } else if (windowId) {
    // Display window metadata for unnamed windows
    sessionMetadataElement.innerHTML = `Window ID: ${windowId} (Unnamed session)`;
  } else {
    // Clear metadata if no session or window is selected
    sessionMetadataElement.innerHTML = "";
  }
}
