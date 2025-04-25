import {
  GET_CACHED_SUMMARIES,
  CREATE_NAMED_SESSION,
  CATEGORIZE_TABS,
  SUGGEST_TAB_DESTINATIONS,
  MIGRATE_TAB,
  SAVE_TAB_TO_BOOKMARKS,
  SYNC_SESSION_TO_BOOKMARKS,
  UPDATE_NAMED_SESSION_TABS,
  DELETE_NAMED_SESSION,
  RENAME_NAMED_SESSION,
  OPEN_SAVED_BOOKMARK,
} from "./lib/constants";
import { ensureTabsHtmlInWindow } from "./features/tabs-helpers";
import {
  ClosedNamedSession,
  NamedSession,
  SyncedTabEntity,
  TabSummary,
} from "./lib/types";
import "./style.css";
import "./tabs.css";
import serviceWorkerInterface from "./features/service-worker-interface";
// We import files and *Component names separately to ensure the top-level side effects.
import "./ui/session-label";
import "./ui/search-bar";
import "./ui/search-result";
import "./ui/search-results.css";
import "./ui/session-metadata";
import { SessionMetadataComponent } from "./ui/session-metadata";
import { initSearchFunctionality } from "./features/search-functionality";
import { CONFIG_RO } from "./features/config-store";

// Entrypoint code for tabs.html.
console.log("tabs.ts", new Date());

// TODO: Consider showing a message in UI instead of alert().
// TODO: And better to kick initialization via SessionManager instead of direcly calling bookmarkStorage here.
// TODO: Check if BookmarkStorage is setup and initialized. If not, show a message to fix the issue.
(async () => {
  const bookmarkFolder = await CONFIG_RO.BOOKMARK_PARENT_ID();
  if (!bookmarkFolder) {
    alert("Bookmark folder is not set. Please set it in extension settings.");
  }
})();

// References to the fixed elements and handler setup:
// TODO: Gather all the references by ID in the top-level, so that we can know the necessary HTML elements to be modified.
const tabs_tablist = document.querySelector<HTMLDivElement>("#tabs_tablist")!;

// Tabs Area
const sessionMetadataElement =
  document.querySelector<SessionMetadataComponent>("#session_metadata")!;

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
  const { sessionId: sessionIdFromUrl, sessionName: sessionNameFromUrl } =
    getSessionParamsFromUrl();

  if (!sessionIdFromUrl) return;

  try {
    // Get current window
    const currentWindow = await chrome.windows.getCurrent();

    // Get all named sessions
    // TODO: We actually need only the session by Id.
    const sessions = await serviceWorkerInterface.getNamedSessions();

    // Check if this session exists but has a null windowId (lost association)
    // TODO: We also need to check if the window exists or not, and override if not exiting.
    const session = sessions.find(
      (s: NamedSession) => s.id === sessionIdFromUrl,
    );
    if (session) {
      // TODO: Define the function in service-worker-interface and service-worker-handler. Missing type complicated the thing.
      if (!session.windowId || session.windowId === null) {
        console.log(
          `Restoring session-window association for session ${sessionIdFromUrl} with window ${currentWindow.id}`,
        );
        // Update the session with the current window ID
        const updateResponse =
          await serviceWorkerInterface.reassociateNamedSession({
            sessionId: sessionIdFromUrl,
            windowId: currentWindow.id!,
          });
        if (
          updateResponse &&
          "success" in updateResponse &&
          updateResponse.success
        ) {
          console.log("Successfully restored session-window association");
        }
      } else if (session.windowId !== currentWindow.id) {
        // TODO: De-dup this logic. as it maybe useful in other methods and actually we have another similar code.
        console.log(
          `Duplicate Tabs UI instance detected for session ${sessionIdFromUrl}: already associated with window ${session.windowId} (current window: ${currentWindow.id}). Skipping update.`,
        );
        if (chrome.notifications) {
          // Ensure permission added in manifest
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icon.png"),
            title: "Duplicate Tabs UI Instance",
            message:
              "Another Tabs UI instance is already active for this session.",
          });
        }
      } else {
        console.log(
          `Session ${sessionIdFromUrl} is already properly associated with the current window ${currentWindow.id}`,
        );
      }
    } else if (sessionNameFromUrl) {
      // TODO: This check looks naive. Let's reconsider the condition more.
      // If the session doesn't exist but we have a name, create it
      console.log(
        `Restoring session-window association for session ${sessionIdFromUrl} with window ${currentWindow.id}`,
      );
      // Update the session with the current window ID
      const updateResponse = await chrome.runtime.sendMessage({
        type: UPDATE_NAMED_SESSION_TABS,
        payload: {
          sessionId: sessionIdFromUrl,
          windowId: currentWindow.id,
        },
      });

      if (
        updateResponse &&
        updateResponse.type === "UPDATE_NAMED_SESSION_TABS_RESULT"
      ) {
        console.log("Successfully restored session-window association");
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

document.addEventListener("DOMContentLoaded", () => {
  // Initialize the page
  init();
  // Initialize search functionality
  initSearchFunctionality();
});

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

// Add event listener for the "Takeover Tabs" button
const takeoverSyncedTabsButton = document.querySelector<HTMLButtonElement>(
  "#takeoverSyncedTabsButton",
);
if (takeoverSyncedTabsButton) {
  takeoverSyncedTabsButton.addEventListener("click", async () => {
    console.log("Taking over synced tabs from other devices");
    try {
      // Get the currently selected session
      const selectedSessionItem = document.querySelector(
        "#named_sessions li.selected",
      );
      if (!selectedSessionItem) {
        alert("Please select a named session first");
        return;
      }

      // Extract session ID from the session-label web component inside the selected item
      const sessionLabel = selectedSessionItem.querySelector("session-label");
      if (!sessionLabel) {
        alert("No session label found for the selected session");
        return;
      }

      const sessionId = sessionLabel.getAttribute("data-session-id");
      if (!sessionId) {
        alert("No session ID found for the selected session");
        return;
      }

      // Get synced tabs for the session
      const syncedTabs =
        await serviceWorkerInterface.getSyncedOpenTabs(sessionId);
      if (!syncedTabs || syncedTabs.length === 0) {
        alert("No synced tabs found for this session");
        return;
      }

      // Take over each synced tab
      // TODO: We should also check if the tab is already open in this window. i.e. we only take over inactive synced tabs found in the backend.
      for (const tab of syncedTabs) {
        try {
          const result = await serviceWorkerInterface.takeoverTab(
            tab.id,
            sessionId,
          );
          if (result && "success" in result && result.success) {
            console.log(`Successfully took over tab: ${tab.id}`);
          } else {
            console.error(`Failed to take over tab: ${tab.id}`);
          }
          console.log(`Successfully took over tab: ${tab.id}`);
        } catch (error) {
          console.error(`Error taking over tab ${tab.id}:`, error);
        }
      }

      alert("Successfully took over all synced tabs");
    } catch (error) {
      console.error("Error taking over synced tabs:", error);
      alert(
        "Error taking over synced tabs: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
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
  windowId?: number,
): HTMLLIElement {
  const li = document.createElement("li");
  // TODO: Call SessionLabel constroctor, so that we can be more TYPED!
  const sessionLabel = document.createElement("session-label") as any;

  // Set the label text
  sessionLabel.label = label;

  // Set whether this is the current window
  sessionLabel.isCurrent = isCurrent;

  // Set the session ID if provided
  sessionLabel.sessionId = sessionId;

  // Set data attributes for selection purposes
  if (sessionId) {
    li.setAttribute("data-session-id", sessionId);
  }

  if (windowId) {
    li.setAttribute("data-window-id", String(windowId));
  }

  // Set menu items based on whether this is a named session or not
  if (sessionId) {
    // Actions for named sessions
    sessionLabel.menuItems = [
      {
        text: "Force Sync to Bookmarks",
        onClick: () => forceSyncSession(sessionId),
      },
      {
        text: "Update Tabs",
        onClick: () => updateSessionTabs(sessionId),
      },
      {
        text: "Rename Session",
        onClick: () => renameSession(sessionId),
      },
      {
        text: "Clone Session",
        onClick: () => cloneSession(sessionId),
      },
      {
        text: "Delete Session",
        onClick: () => deleteSession(sessionId),
      },
    ];
  } else {
    // Actions for unnamed sessions (windows)
    sessionLabel.menuItems = [
      {
        text: "Create Named Session",
        onClick: () => promptCreateNamedSession(),
      },
    ];
  }

  li.appendChild(sessionLabel);

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

// TODO: Organize the methods related to the actions.
/**
 * Clones a session with the given ID using the service worker interface.
 * After successful cloning, it refreshes the UI with updated windows and tabs state.
 *
 * @param sessionId - The ID of the session to clone
 * @returns A Promise that resolves when the cloning operation and UI update are complete
 */
async function cloneSession(sessionId: string) {
  const result = await serviceWorkerInterface.cloneNamedSession(sessionId);
  if (result.success) {
    console.log(`Session ${sessionId} cloned successfully.`);
    alert("Session cloned successfully.");
    chrome.windows.getAll({ populate: true }).then((windows) => {
      state_windows = windows;
      chrome.tabs.query({ currentWindow: true }).then((tabs) => {
        state_tabs = tabs;
        updateUI(state_windows);
      });
    });
  } else {
    console.error("Error cloning session:", result);
    alert("Failed to clone session.");
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
  const sessionLabel = document.createElement("session-label") as any;

  // Set the label text
  const tabCount = closedSession.tabs.length;
  sessionLabel.label = `${closedSession.name} (${tabCount} tab${tabCount !== 1 ? "s" : ""})`;

  // Set the session ID
  sessionLabel.sessionId = closedSession.id;

  // Set menu items for closed sessions
  sessionLabel.menuItems = [
    {
      text: "Restore Session",
      onClick: () => restoreClosedSession(closedSession.id),
    },
    {
      text: "Delete Session",
      onClick: () => deleteSession(closedSession.id),
    },
  ];

  li.appendChild(sessionLabel);
  li.setAttribute("data-session-id", closedSession.id);

  // Make the label clickable to view the session's tabs
  sessionLabel.addEventListener("click", () => {
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
    const response =
      await serviceWorkerInterface.restoreClosedSession(sessionId);

    if (response) {
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
      <th>Title & URL</th>
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
      <td colspan="2">No tabs available in this closed session.</td>
    `;
    tableBody.appendChild(noTabsRow);
    return;
  }

  // Add rows for each tab in the closed session
  closedSession.tabs.forEach((tab) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td class="title-url-cell" title="${tab.title} - ${tab.url}">
        <div class="title-url-container">
          <div class="title-container">
            <span class="title-text">${tab.title || "Untitled"}</span>
          </div>
          <div class="url-text">${tab.url || "N/A"}</div>
        </div>
      </td>
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
  selectedSessionInfo?: {
    windowId?: number;
    sessionId?: string;
    isClosed?: boolean;
  } /* Optionally specify the session to be selected after the UI refresh */,
) {
  // Log window and tab information for debugging
  windows.forEach((w) => {
    console.log(`ID: ${w.id}, Tabs: ${w.tabs?.length || 0}`);
  });
  // We don't need to log tabs separately as they're now included in windows

  // ---- Fetch and update Named Sessions ----
  // TODO: Migrate the call with GET_NAMED_SESSIONS to service-worker-interface/handler/messages.ts.
  state_sessions = await serviceWorkerInterface.getNamedSessions();

  // ---- Fetch and update Closed Named Sessions ----
  let closedSessions: ClosedNamedSession[] =
    await serviceWorkerInterface.getClosedNamedSessions();

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

  // Sort named sessions alphabetically by name
  const sortedNamedSessions = [...state_sessions].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Sort windows by ID for unnamed sessions
  const sortedWindows = [...windows].sort((a, b) => (a.id || 0) - (b.id || 0));

  // Track the current window to auto-select it
  let currentWindowItem: HTMLLIElement | undefined = undefined;
  // Auto-select the specified window and load its tabs
  // TODO: Logic around these "selected*" variables are too complicated. Consider refactoring.
  let selectedWindowId: number | undefined;
  let selectedWindowItem: HTMLLIElement | undefined = undefined;
  let selectedClosedSessionItem: HTMLLIElement | undefined = undefined;
  let selectedClosedSession: ClosedNamedSession | undefined = undefined;

  // Helper function to add click and double-click event listeners to a session list item
  const addSessionEventListeners = (
    listItem: HTMLLIElement,
    win: chrome.windows.Window,
    associatedSession: NamedSession | undefined,
  ) => {
    // Make the label clickable to select the session
    listItem.addEventListener("click", () => {
      // Clear selection on all items and mark this one as selected
      namedList
        .querySelectorAll("li")
        .forEach((item) => item.classList.remove("selected"));
      unnamedList
        .querySelectorAll("li")
        .forEach((item) => item.classList.remove("selected"));
      closedList
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
          // For named session, make sure the "Saved Bookmarks" UI is visible
          const savedBookmarksContainer =
            document.querySelector<HTMLDivElement>("#saved_bookmarks");
          if (savedBookmarksContainer) {
            savedBookmarksContainer.style.display = "block";
          }
          fetchAndDisplaySavedBookmarks(associatedSession.id);
          fetchAndDisplaySyncedTabs(associatedSession.id);
          // Update session metadata
          renderSessionsMetadata(associatedSession);
        } else {
          // Clear saved bookmarks and synced tabs if this is not a named session
          clearSavedBookmarks();
          clearSyncedTabs();
          // For unnamed session, completely hide the "Saved Bookmarks" UI
          // TODO: This logic actually can and should be merged into a common logic.
          const savedBookmarksContainer =
            document.querySelector<HTMLDivElement>("#saved_bookmarks");
          if (savedBookmarksContainer) {
            savedBookmarksContainer.style.display = "none";
          }
          // Update session metadata for unnamed window
          renderSessionsMetadata(null, winId);
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
  };

  // 1. Add named sessions to the UI
  for (const session of sortedNamedSessions) {
    // Find the window associated with this session
    const win = sortedWindows.find((w) => w.id === session.windowId);
    if (!win) continue; // Skip if window not found

    // Count non-pinned tabs for this window
    let tabCount = 0;
    if (win.tabs) {
      tabCount = win.tabs.filter((tab) => !tab.pinned).length;
    }

    // Build the label
    const label = `${session.name} (Window: ${win.id}, ${tabCount} tab${tabCount !== 1 ? "s" : ""})`;

    const isCurrent = win.focused;
    // Create the list item
    const listItem = createSessionListItem(
      label,
      isCurrent,
      session.id,
      win.id,
    );

    // Add event listeners
    addSessionEventListeners(listItem, win, session);

    if (isCurrent) {
      currentWindowItem = listItem;
    }

    // Check if this is the session to select
    if (selectedSessionInfo && selectedSessionInfo.windowId === win.id) {
      selectedWindowId = selectedSessionInfo.windowId;
      selectedWindowItem = listItem;
    }

    namedList.appendChild(listItem);
  }

  // 2. Add unnamed sessions (windows without associated named sessions) to the UI
  for (const win of sortedWindows) {
    // Skip windows that have an associated named session
    const hasNamedSession = sortedNamedSessions.some(
      (session) => session.windowId === win.id && session.name,
    );
    if (hasNamedSession) continue;

    // For unnamed sessions, we can ignore windows which has no valid http, https, or extension URL scheme.
    if (win.tabs) {
      const meaningfulTabs = win.tabs.filter(
        (tab) => tab.url && /^https?:|^chrome-extension:/.test(tab.url),
      );
      if (meaningfulTabs.length === 0) {
        continue;
      }
    } else {
      continue;
    }

    // Count non-pinned tabs for this window
    let tabCount = 0;
    if (win.tabs) {
      tabCount = win.tabs.filter((tab) => !tab.pinned).length;
    }

    // Build the label
    const label = `Window ${win.id} (${tabCount} tab${tabCount !== 1 ? "s" : ""})`;

    const isCurrent = win.focused;
    // Create the list item
    const listItem = createSessionListItem(label, isCurrent, undefined, win.id);

    // Add event listeners
    addSessionEventListeners(listItem, win, undefined);

    if (isCurrent) {
      currentWindowItem = listItem;
    }

    // Check if this is the session to select
    if (selectedSessionInfo && selectedSessionInfo.windowId === win.id) {
      selectedWindowId = selectedSessionInfo.windowId;
      selectedWindowItem = listItem;
    }

    unnamedList.appendChild(listItem);
  }

  // 3. Add closed sessions to the UI
  if (closedSessions.length === 0) {
    // No closed sessions available - add a message
    const noSessionsItem = document.createElement("li");
    noSessionsItem.textContent = "No closed sessions available";
    closedList.appendChild(noSessionsItem);
  } else {
    // Sort closed sessions alphabetically by name
    const sortedClosedSessions = [...closedSessions].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    // Add each closed session
    sortedClosedSessions.forEach((session) => {
      const listItem = createClosedSessionListItem(session);

      // Check if this is the closed session to select
      if (
        selectedSessionInfo?.isClosed &&
        selectedSessionInfo.sessionId === session.id
      ) {
        selectedClosedSessionItem = listItem;
        selectedClosedSession = session;
      }

      closedList.appendChild(listItem);
    });
  }

  // Override the selected window with the current window if not yet specified.
  if (!selectedWindowItem && !selectedClosedSessionItem) {
    selectedWindowId = windows.find((w) => w.focused)?.id;
    selectedWindowItem = currentWindowItem;
  }

  // Check if we should select a closed session
  if (selectedClosedSessionItem && selectedClosedSession) {
    // Clear all other selections
    document
      .querySelectorAll(
        "#named_sessions li, #tabs_sessions li, #closed_sessions li",
      )
      .forEach((item) => item.classList.remove("selected"));

    // Select the closed session
    (selectedClosedSessionItem as HTMLLIElement).classList.add("selected");

    // Display the tabs for this closed session
    displayClosedSessionTabs(selectedClosedSession);
    return;
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
      const associatedSession = sortedNamedSessions.find(
        (session) => session.windowId === selectedWindowId && session.name,
      );
      // TODO: We have similar code snippet in this method. Consider refactoring them into renderSessionTabsPane() or something.
      if (associatedSession) {
        fetchAndDisplaySavedBookmarks(associatedSession.id);
        fetchAndDisplaySyncedTabs(associatedSession.id);

        // Check if this window has any non-pinned tabs
        chrome.tabs
          .query({ windowId: selectedWindowId, pinned: false })
          .then((tabs) => {
            if (tabs.length === 0) {
              // If there are no non-pinned tabs, automatically show the saved bookmarks panel
              const savedBookmarksContainer =
                document.querySelector<HTMLDivElement>("#saved_bookmarks");
              if (
                savedBookmarksContainer &&
                savedBookmarksContainer.classList.contains("collapsed")
              ) {
                savedBookmarksContainer.classList.remove("collapsed");

                // Update the toggle button text
                // TODO: Factor out the repeating code.
                const toggleBookmarksButton =
                  document.querySelector<HTMLButtonElement>(
                    "#toggleBookmarksButton",
                  );
                if (toggleBookmarksButton) {
                  toggleBookmarksButton.textContent = "❌";
                  toggleBookmarksButton.title = "Collapse bookmarks panel";
                }
              }
            }
          });

        // Update session metadata
        renderSessionsMetadata(associatedSession);
      } else {
        // Clear saved bookmarks and synced tabs if this is not a named session
        // TODO: For unamed session, which definitely has no bookmark, we can completely hide the "Saved Bookmarks" UI.
        clearSavedBookmarks();
        clearSyncedTabs();

        const savedBookmarksContainer =
          document.querySelector<HTMLDivElement>("#saved_bookmarks");
        if (savedBookmarksContainer) {
          savedBookmarksContainer.style.display = "none";
        }

        // Update session metadata for unnamed window
        renderSessionsMetadata(null, selectedWindowId);
      }
    }
  }
}

// Helper function to update the tabs table with tabs from a specific window
async function updateTabsTable(
  selectedWindowId: number, // windowId for the session shown in the UI.
  tabs: chrome.tabs.Tab[],
) {
  // Get the current window where tabs.html is running
  const currentWindow = await chrome.windows.getCurrent();
  const tabsTable = tabs_tablist.querySelector("table")!;

  // Update table headers - now including the summary column and actions
  // TODO: Show the tabs found in the bookmark backend but not-opened in the current window.
  const tableHead = tabsTable.querySelector("thead")!;
  tableHead.innerHTML = `
        <tr>
            <th>Tab ID</th>
            <th>Title & URL</th>
            <th>Summary</th>
            <th>Actions</th>
        </tr>
    `;

  // Add event listener to the "Migrate Selected" button
  const migrateSelectedButton = document.querySelector<HTMLButtonElement>(
    "#migrateSelectedButton",
  );
  if (migrateSelectedButton) {
    // Remove any existing event listeners
    migrateSelectedButton.replaceWith(migrateSelectedButton.cloneNode(true));

    // Get the fresh reference after replacing
    const freshMigrateSelectedButton =
      document.querySelector<HTMLButtonElement>("#migrateSelectedButton");
    if (freshMigrateSelectedButton) {
      freshMigrateSelectedButton.addEventListener("click", () => {
        const selectedTabIds = getSelectedTabIds();
        if (selectedTabIds.length > 0) {
          showMigrationDialogForMultipleTabs(selectedTabIds);
        } else {
          alert("Please select at least one tab to migrate");
        }
      });
    }
  }

  // Clear existing table rows
  const tableBody = tabsTable.querySelector("tbody")!;
  tableBody.innerHTML = "";

  // Filter out all pinned tabs
  const filteredTabs = tabs.filter((tab) => !tab.pinned);

  if (filteredTabs.length === 0) {
    // No tabs available - add a message row
    const noTabsRow = document.createElement("tr");

    // Check if this is a named session
    const currentWindow = tabs[0]?.windowId;
    const currentSession = state_sessions.find(
      (session) => session.windowId === currentWindow && session.name,
    );

    if (currentSession) {
      // This is a named session with no tabs - offer to open saved bookmarks
      noTabsRow.innerHTML = `
            <td colspan="6">
              <div class="no-tabs-message">
                <p>No tabs available in this window (excluding pinned tabs).</p>
                <p>Would you like to open the saved bookmarks for this session?</p>
                <button id="openSavedBookmarksButton" class="action-button">Open Saved Bookmarks</button>
              </div>
            </td>
        `;
      tableBody.appendChild(noTabsRow);

      // Add event listener for the "Open Saved Bookmarks" button
      setTimeout(() => {
        const openSavedBookmarksButton =
          document.querySelector<HTMLButtonElement>(
            "#openSavedBookmarksButton",
          );
        if (openSavedBookmarksButton) {
          openSavedBookmarksButton.addEventListener("click", async () => {
            console.log("Opening saved bookmarks for empty session");
            await openAllBookmarks();
          });
        }
      }, 0);
    } else {
      // Regular window with no tabs
      noTabsRow.innerHTML = `
            <td colspan="6">No tabs available in this window (excluding pinned tabs).</td>
        `;
      tableBody.appendChild(noTabsRow);
    }
    return;
  }

  // Get the current session if it's a named session
  const currentSession = state_sessions.find(
    (session) => session.windowId === selectedWindowId && session.name,
  );

  // Get synced bookmarks and saved bookmarks for the current session if it exists
  // TODO: Rename the variable to syncedOpenTabs.
  let syncedBookmarks: SyncedTabEntity[] = [];
  let savedBookmarks: SyncedTabEntity[] = [];

  if (currentSession) {
    try {
      // Get synced bookmarks via session_management abstraction
      syncedBookmarks = await serviceWorkerInterface.getSyncedOpenTabs(
        currentSession.id,
      );

      // Get saved bookmarks
      savedBookmarks = await serviceWorkerInterface.getSavedBookmarks(
        currentSession.id,
      );
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
    }
  }

  // Create sets of URLs for quick lookup
  const syncedUrls = new Set(syncedBookmarks.map((bookmark) => bookmark.url));
  const savedUrls = new Set(savedBookmarks.map((bookmark) => bookmark.url));

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

    // Determine sync status and bookmark status for inclusion in the title cell
    let statusIndicators = "";
    if (currentSession && tab.url) {
      // Saved bookmark indicator has the higher preference.
      if (savedUrls.has(tab.url)) {
        statusIndicators += `<span class="sync-status synced" title="Tab is saved in bookmarks">⭐</span>`;
      } else if (syncedUrls.has(tab.url)) {
        // Sync status indicator
        statusIndicators += `<span class="sync-status synced" title="Tab is synced to bookmarks">✓</span>`;
      } else {
        statusIndicators += `<span class="sync-status not-synced" title="Tab exists in window but is not synced to bookmarks">⚠️</span>`;
      }
    }

    // Add checkbox for multiple tab selection and merged Title/URL column
    // TODO: When showing another session/window, replace the migrate button with a button to bring the session to the current session.
    // TODO: `selectedWindowId !== tab.windowId` this condition is wrong, we need to know if the current window is the same as the tabs' window or not.
    row.innerHTML = `
            <td class="tab-id-cell">
              <div class="tab-id-container">
                <input type="checkbox" class="tab-select-checkbox" data-tab-id="${tab.id}" data-tab-url="${tab.url}">
                <span>${tab.id || "N/A"}</span>
              </div>
            </td>
            <td class="title-url-cell" title="${tab.title} - ${tab.url}">
              <div class="title-url-container">
                <div class="title-container clickable">
                  <span class="title-text">${tab.title || "Untitled"}</span>
                  ${statusIndicators}
                </div>
                <div class="url-text">${tab.url || "N/A"}</div>
              </div>
            </td>
            <td class="summary-cell">${summarySnippet}</td>
            <td class="actions-cell">
                <div class="tab-actions">
                    ${
                      currentWindow.id && currentWindow.id !== tab.windowId
                        ? `<button class="tab-action-button migrate-button" data-tab-id="${tab.id}" data-tab-url="${tab.url}">Bring Here</button>`
                        : `<button class="tab-action-button migrate-button" data-tab-id="${tab.id}" data-tab-url="${tab.url}">Migrate</button>`
                    }
                    <button class="tab-action-button save-button" data-tab-id="${tab.id}" data-tab-url="${tab.url}">Save</button>
                    <button class="tab-action-button close-button" data-tab-id="${tab.id}">Close</button>
                </div>
            </td>`;
    tableBody.appendChild(row);

    // Add click event listener to the title-url-cell for tab activation
    const titleUrlCell = row.querySelector(".title-url-cell");
    if (titleUrlCell && tab.id) {
      titleUrlCell.addEventListener("click", async () => {
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

    // Prevent checkbox from triggering tab activation
    const checkbox = row.querySelector(".tab-select-checkbox");
    if (checkbox) {
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent event from bubbling up to parent elements
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
        const tab = await chrome.tabs.get(tabId);

        if (currentWindow.id && currentWindow.id !== tab.windowId) {
          // If viewing another window's tabs, move directly to current window
          await migrateTab(tabId, currentWindow.id);
        } else {
          // If in current window, show migration dialog
          showMigrationDialog(tabId, tabUrl);
        }
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
          updateUI(state_windows, { windowId: selectedWindowId });
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

/**
 * Gets the IDs of all selected tabs
 * @returns Array of selected tab IDs
 */
function getSelectedTabIds(): number[] {
  const selectedTabIds: number[] = [];
  const checkboxes = document.querySelectorAll<HTMLInputElement>(
    ".tab-select-checkbox:checked",
  );

  checkboxes.forEach((checkbox) => {
    const tabId = parseInt(checkbox.getAttribute("data-tab-id") || "0");
    if (tabId) {
      selectedTabIds.push(tabId);
    }
  });

  return selectedTabIds;
}

/**
 * Shows the migration dialog for multiple tabs
 * @param tabIds Array of tab IDs to migrate
 */
async function showMigrationDialogForMultipleTabs(tabIds: number[]) {
  const dialog = document.querySelector<HTMLDivElement>("#migrationDialog")!;
  const tabInfoDiv =
    document.querySelector<HTMLDivElement>("#migrationTabInfo")!;
  const suggestedDestinationsDiv = document.querySelector<HTMLDivElement>(
    "#suggestedDestinations",
  )!;
  const allDestinationsDiv =
    document.querySelector<HTMLDivElement>("#allDestinations")!;

  // Display tab info
  tabInfoDiv.innerHTML = `
    <p><strong>Selected Tabs:</strong> ${tabIds.length} tabs selected</p>
  `;

  // Show the dialog
  dialog.style.display = "flex";

  // Hide suggestions section for multiple tabs
  suggestedDestinationsDiv.innerHTML =
    "<p>Suggestions not available when migrating multiple tabs.</p>";

  // Display all windows as potential destinations
  allDestinationsDiv.innerHTML = "";

  // Get all windows
  const windows = await chrome.windows.getAll();

  // Get the current window ID (assuming all selected tabs are from the same window)
  const currentTab = await chrome.tabs.get(tabIds[0]);
  const currentWindowId = currentTab.windowId;

  // Create a destination option for each window (except the current one)
  windows.forEach((window) => {
    if (window.id !== currentWindowId) {
      const destinationOption = document.createElement("div");
      destinationOption.className = "destination-option";

      // Find if this window has a named session
      const session = state_sessions.find((s) => s.windowId === window.id);

      destinationOption.innerHTML = `
        <div class="destination-name">${session?.name ? `${session.name} (Window ${window.id})` : `Window ${window.id}`}</div>
      `;

      // Add click event to migrate the tabs
      destinationOption.addEventListener("click", async () => {
        if (window.id) {
          await migrateMultipleTabs(tabIds, window.id);
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

/**
 * Migrates multiple tabs to another window
 * @param tabIds Array of tab IDs to migrate
 * @param windowId Destination window ID
 */
async function migrateMultipleTabs(tabIds: number[], windowId: number) {
  try {
    // Store the current selected session info before migration
    const selectedSessionInfo = getSelectedSessionInfo();

    // TODO: Define the API in service-worker-interface.ts.
    const response = await chrome.runtime.sendMessage({
      type: MIGRATE_TAB,
      payload: {
        tabIds,
        windowId,
      },
    });

    if (response && response.type === "MIGRATE_TAB_RESULT") {
      console.log("Tabs migrated successfully:", response.payload);

      // Refresh the UI with tab information, but maintain the selected session
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows, selectedSessionInfo);
        });
      });
    } else {
      console.error("Error migrating tabs:", response);
    }
  } catch (error) {
    console.error("Error sending migrate tabs message:", error);
  }
}

// Function to migrate a tab to another window
async function migrateTab(tabId: number, windowId: number) {
  try {
    // Store the current selected session info before migration
    const selectedSessionInfo = getSelectedSessionInfo();

    const response = await chrome.runtime.sendMessage({
      type: MIGRATE_TAB,
      payload: {
        tabId,
        windowId,
      },
    });

    if (response && response.type === "MIGRATE_TAB_RESULT") {
      console.log("Tab migrated successfully:", response.payload);

      // Refresh the UI with tab information, but maintain the selected session
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows, selectedSessionInfo);
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

    // Extract session ID from the session-label web component inside the selected item
    const sessionLabel = selectedSessionItem.querySelector("session-label");
    if (!sessionLabel) {
      alert("No session label found for the selected session");
      return;
    }

    const sessionId = sessionLabel.getAttribute("data-session-id");
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
    const syncedTabs =
      await serviceWorkerInterface.getSyncedOpenTabs(sessionId);

    if (!syncedTabs) {
      console.error("Error fetching synced tabs:", syncedTabs);
      clearSyncedTabs();
      return;
    }

    // Get all currently open tabs in the current window
    const currentWindow = await chrome.windows.getCurrent();
    const openTabs = await chrome.tabs.query({ windowId: currentWindow.id });

    // Create a set of open tab URLs for quick lookup
    const openTabUrls = new Set(openTabs.map((tab) => tab.url));

    const instanceId = await CONFIG_RO.INSTANCE_ID();
    // Filter synced tabs to only those that aren't already open, and owned by the other instances.
    const tabsNotOpen = syncedTabs.filter(
      (tab) =>
        !openTabUrls.has(tab.url) && (!tab.owner || tab.owner !== instanceId),
    );
    // TODO: Annotate them and see markers for "The same page is open" and "Owner by others".

    // Display the tabs that aren't open
    displaySyncedTabs(tabsNotOpen, sessionId);
  } catch (error) {
    console.error("Error fetching synced tabs:", error);
    clearSyncedTabs();
  }
}

/**
 * Displays synced tabs in the synced tabs section
 */
async function displaySyncedTabs(tabs: SyncedTabEntity[], sessionId: string) {
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
  const instanceId = await CONFIG_RO.INSTANCE_ID();
  tabs.forEach((tab) => {
    const listItem = document.createElement("li");

    // Create tab title container
    const titleContainer = document.createElement("div");
    titleContainer.className = "synced-tab-title";
    titleContainer.textContent = tab.title || tab.url;
    titleContainer.title = tab.url;
    listItem.appendChild(titleContainer);
    // Insert owner info container with visibility weight and indicator if different
    const ownerContainer = document.createElement("div");
    ownerContainer.className = "synced-tab-owner";
    // TODO: Fix this as this is a tentative stub implementation.
    const owner = tab.owner;
    if (owner && owner !== instanceId) {
      ownerContainer.textContent = "Owner: " + owner + " (Different)";
      ownerContainer.classList.add("different-owner");
    } else {
      ownerContainer.textContent = "Owner: " + (owner || "Unknown");
    }
    listItem.appendChild(ownerContainer);

    // Create tab actions container
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "synced-tab-actions";

    const takeoverButton = document.createElement("button");
    takeoverButton.className = "synced-tab-action-button";
    takeoverButton.textContent = "Takeover";
    takeoverButton.addEventListener("click", async () => {
      try {
        const result = await serviceWorkerInterface.takeoverTab(
          tab.id,
          sessionId,
        );
        if (result && "success" in result && result.success) {
          console.log(`Successfully took over tab: ${tab.id}`);
          alert(`Tab ${tab.id} successfully taken over.`);
        } else {
          console.error(`Failed to take over tab: ${tab.id}`);
          alert(`Failed to take over tab ${tab.id}.`);
        }
      } catch (error) {
        console.error(`Error taking over tab ${tab.id}:`, error);
        alert(`Error taking over tab ${tab.id}: ${error}`);
      }
    });
    actionsContainer.appendChild(takeoverButton);

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
    const bookmarks = await serviceWorkerInterface.getSavedBookmarks(sessionId);

    if (bookmarks && bookmarks.length > 0) {
      displaySavedBookmarks(bookmarks);
    } else {
      console.error("No saved bookmarks found.");
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
function displaySavedBookmarks(bookmarks: SyncedTabEntity[]) {
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
  // Add dbclick to open the bookmark.
  bookmarks.forEach((bookmark) => {
    const listItem = document.createElement("li");

    // Create bookmark title container
    const titleContainer = document.createElement("div");
    titleContainer.className = "bookmark-title";
    // Create title and URL elements
    const titleText = document.createElement("div");
    titleText.className = "bookmark-title-text";
    titleText.textContent = bookmark.title || "Untitled";

    const urlText = document.createElement("div");
    urlText.className = "bookmark-url-text";
    urlText.textContent = bookmark.url;

    titleContainer.appendChild(titleText);
    titleContainer.appendChild(urlText);
    titleContainer.title = `${bookmark.title || "Untitled"}\n${bookmark.url}`;
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

    // Add remove button
    const removeButton = document.createElement("button");
    removeButton.className = "bookmark-action-button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      if (confirm("Are you sure you want to remove this bookmark?")) {
        removeBookmark(bookmark.id);
      }
    });
    actionsContainer.appendChild(removeButton);

    listItem.appendChild(actionsContainer);

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
 * Removes a saved bookmark
 */
async function removeBookmark(bookmarkId: string) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "REMOVE_SAVED_BOOKMARK", // TODO: Make a constant.
      payload: {
        bookmarkId,
      },
    });

    if (
      response &&
      response.type === "REMOVE_SAVED_BOOKMARK_RESULT" &&
      response.payload.success
    ) {
      console.log(`Bookmark ${bookmarkId} removed successfully`);

      // Get the currently selected session
      const selectedSessionItem = document.querySelector(
        "#named_sessions li.selected",
      );
      if (selectedSessionItem) {
        const sessionId = selectedSessionItem.getAttribute("data-session-id");
        if (sessionId) {
          // Refresh the bookmarks display
          await fetchAndDisplaySavedBookmarks(sessionId);
        }
      }
    } else {
      console.error("Error removing bookmark:", response);
      alert("Error removing bookmark");
    }
  } catch (error) {
    console.error("Error removing bookmark:", error);
    alert(
      "Error removing bookmark: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
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

    // Extract session ID from the session-label web component inside the selected item
    // TODO: Factor out these repeating logic.
    const sessionLabel = selectedSessionItem.querySelector("session-label");
    if (!sessionLabel) {
      alert("No session label found for the selected session");
      return;
    }

    const sessionId = sessionLabel.getAttribute("data-session-id");
    if (!sessionId) {
      alert("No session ID found for the selected session");
      return;
    }

    // TODO: Consider if we can/should use the already filled HTML elements to know the URLs to open.
    // Get all saved bookmarks for this session
    const bookmarks = await serviceWorkerInterface.getSavedBookmarks(sessionId);

    if (!bookmarks?.length) {
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

    // Extract session ID from the session-label web component inside the selected item
    // TODO: Factor out these repeating logic.
    const sessionLabel = selectedSessionItem.querySelector("session-label");
    if (!sessionLabel) {
      alert("No session label found for the selected session");
      return;
    }

    const sessionId = sessionLabel.getAttribute("data-session-id");
    if (!sessionId) {
      alert("No session ID found for the selected session");
      return;
    }

    // Get all synced tabs for this session
    const syncedTabs: SyncedTabEntity[] =
      await serviceWorkerInterface.getSyncedOpenTabs(sessionId);
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
/**
 * Renders the session metadata display using a web component.
 * @param session The named session, or null if this is an unnamed window.
 * @param windowId The window ID (only used if session is null).
 */
function renderSessionsMetadata(
  session: NamedSession | null,
  windowId?: number,
) {
  if (session) {
    const createdDate = new Date(session.createdAt).toLocaleString();
    const updatedDate = new Date(session.updatedAt).toLocaleString();
    // TODO: Merge these setAttribute  calls into one method call.
    sessionMetadataElement.setAttribute("session-id", session.id);
    sessionMetadataElement.setAttribute("window-id", String(session.windowId));
    sessionMetadataElement.setAttribute("created", createdDate);
    sessionMetadataElement.setAttribute("updated", updatedDate);
    sessionMetadataElement.setAttribute("unnamed", "false");
  } else if (windowId) {
    sessionMetadataElement.setAttribute("window-id", String(windowId));
    sessionMetadataElement.setAttribute("unnamed", "true");
  }
  // TODO: We need to support Closed Named Session as well.
}

/**
 * Helper function to extract window ID and/or session ID from a selected session element
 * @returns An object containing the window ID and/or session ID if found
 */
function getSelectedSessionInfo(): {
  windowId?: number;
  sessionId?: string;
  isClosed?: boolean;
} {
  const selectedSessionItem = document.querySelector(
    "#named_sessions li.selected, #tabs_sessions li.selected, #closed_sessions li.selected",
  );
  if (!selectedSessionItem) return {};

  // Check which container the selected item belongs to
  const isClosed = selectedSessionItem.closest("#closed_sessions") !== null;

  // Get session ID if present (for both named and closed sessions)
  const sessionIdAttr = selectedSessionItem.getAttribute("data-session-id");
  const sessionId = sessionIdAttr || undefined; // Convert null to undefined

  // For closed sessions, we only need the session ID
  if (isClosed) {
    return { sessionId, isClosed: true };
  }

  // For open sessions, try to get the window ID
  // First check for direct data-window-id attribute
  const windowIdAttr = selectedSessionItem.getAttribute("data-window-id");
  if (windowIdAttr) {
    return { windowId: parseInt(windowIdAttr, 10), sessionId };
  }

  // If we have a session ID but not a window ID, try to get it from state
  if (sessionId) {
    const session = state_sessions.find((s) => s.id === sessionId);
    if (session?.windowId) {
      return { windowId: session.windowId, sessionId };
    }
  }

  // Try getting window ID from session label (fallback)
  const sessionLabel = selectedSessionItem.querySelector("session-label");
  if (sessionLabel) {
    const labelText = sessionLabel.getAttribute("label") || "";
    const windowIdMatch = labelText.match(/Window (\d+)/);
    if (windowIdMatch && windowIdMatch[1]) {
      return { windowId: parseInt(windowIdMatch[1], 10), sessionId };
    }
  }

  return { sessionId };
}
