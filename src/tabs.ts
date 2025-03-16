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
  GET_CLOSED_NAMED_SESSIONS,
  RESTORE_CLOSED_SESSION,
  // GET_SAVED_BOOKMARKS,
  // OPEN_SAVED_BOOKMARK,
} from "./lib/constants";
import { ClosedNamedSession, NamedSession, TabSummary } from "./lib/types";
import "./style.css";
import "./tabs.css";

// References to the fixed elements and handler setup:
const tabs_tablist = document.querySelector<HTMLDivElement>("#tabs_tablist")!;
console.log("tabs.ts", new Date());

// Page State
var windowIds: (number | undefined)[] = []; // IDs of all windows
var state_windows: chrome.windows.Window[]; // All windows
var state_tabs: chrome.tabs.Tab[]; // Tabs in the current window
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

  const windowsGetAll = chrome.windows.getAll().then((results) => {
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

      updateUI(state_windows, state_tabs);
    })
    .catch((err) => {
      console.error(err);
      // TODO: Show some error dialog in this case?
    });
}

// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
init();
// Add event listener for the "button to request the tab summaries."
const requestTabSummariesButton = document.querySelector<HTMLButtonElement>(
  "#requestTabSummariesButton",
)!;
requestTabSummariesButton.addEventListener("click", async () => {
  console.log("Tab summaries requested");

  // Refresh the windows list
  chrome.windows.getAll().then((windows) => {
    state_windows = windows;
    updateUI(state_windows, state_tabs);
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
  onClick: () => void,
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

  // Make the label clickable to select the session
  labelContainer.addEventListener("click", onClick);

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

      // Refresh the UI
      chrome.windows.getAll().then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows, state_tabs);
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
 * Deletes a session
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

      // Refresh the UI
      chrome.windows.getAll().then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows, state_tabs);
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

        // Refresh the UI
        chrome.windows.getAll().then((windows) => {
          state_windows = windows;
          chrome.tabs.query({ currentWindow: true }).then((tabs) => {
            state_tabs = tabs;
            updateUI(state_windows, state_tabs);
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

      // Refresh the UI
      chrome.windows.getAll().then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows, state_tabs);
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
  tabs: chrome.tabs.Tab[],
) {
  // Log window and tab information for debugging
  windows.forEach((w) => {
    console.log(`ID: ${w.id}, Tabs: ${w.tabs?.length || 0}`);
  });
  tabs.forEach((t) => {
    console.log(`Title: ${t.title}, URL: ${t.url}`);
  });

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
  await chrome.runtime
    .sendMessage({ type: GET_CLOSED_NAMED_SESSIONS })
    .then((response) => {
      if (response && response.type === "GET_CLOSED_NAMED_SESSIONS_RESULT") {
        closedSessions = response.payload.closedSessions || [];
      }
    })
    .catch((err) => {
      console.error("Error fetching closed named sessions:", err);
    });

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

  // Add a list item for each window
  for (let i = 0; i < windows.length; i++) {
    const win = windows[i];
    // Count non-pinned tabs for this window
    const tabCount = state_tabs.filter(
      (tab) => tab.windowId === win.id && !tab.pinned,
    ).length;

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
    const listItem = createSessionListItem(
      label,
      () => {
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
          chrome.tabs.query({ windowId: win.id }).then((windowTabs) => {
            console.log(`Found ${windowTabs.length} tabs in window ${win.id}`);
            updateTabsTable(windowTabs);
          });
        }
      },
      isCurrent,
      associatedSession?.id,
    );

    if (isCurrent) {
      currentWindowItem = listItem;
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

  // Auto-select the current window and load its tabs
  if (currentWindowItem) {
    currentWindowItem.classList.add("selected");
    const currentWindow = windows.find((w) => w.focused);
    if (currentWindow && currentWindow.id) {
      chrome.tabs.query({ windowId: currentWindow.id }).then((windowTabs) => {
        console.log(
          `Auto-loading ${windowTabs.length} tabs for current window ${currentWindow.id}`,
        );
        updateTabsTable(windowTabs);
      });
    }
  }
}

// Helper function to update the tabs table with tabs from a specific window
async function updateTabsTable(tabs: chrome.tabs.Tab[]) {
  const tabsTable = tabs_tablist.querySelector("table")!;

  // Update table headers - now including the summary column and actions
  const tableHead = tabsTable.querySelector("thead")!;
  tableHead.innerHTML = `
        <tr>
            <th>Tab ID</th>
            <th>Title</th>
            <th>URL</th>
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
            <td colspan="4">No tabs available in this window (excluding pinned tabs).</td>
        `;
    tableBody.appendChild(noTabsRow);
    return;
  }

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

    row.innerHTML = `
            <td class="tab-id-cell">${tab.id || "N/A"}</td>
            <td class="title-cell" title="${tab.title}">${tab.title || "Untitled"}</td>
            <td class="url-cell" title="${tab.url}">${tab.url || "N/A"}</td>
            <td class="summary-cell">${summarySnippet}</td>
            <td class="actions-cell">
                <div class="tab-actions">
                    <button class="tab-action-button migrate-button" data-tab-id="${tab.id}" data-tab-url="${tab.url}">Migrate</button>
                    <button class="tab-action-button save-button" data-tab-id="${tab.id}" data-tab-url="${tab.url}">Save</button>
                </div>
            </td>
        `;
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

      // Refresh the UI
      chrome.windows.getAll().then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows, state_tabs);
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
        chrome.windows.getAll().then((windows) => {
          state_windows = windows;
          chrome.tabs.query({ currentWindow: true }).then((tabs) => {
            state_tabs = tabs;
            updateUI(state_windows, state_tabs);
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
