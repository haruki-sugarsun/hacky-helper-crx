import {
  GET_CACHED_SUMMARIES,
  CREATE_NAMED_SESSION,
  GET_NAMED_SESSIONS,
  CATEGORIZE_TABS,
  SUGGEST_TAB_DESTINATIONS,
  MIGRATE_TAB,
} from "./lib/constants";
import { NamedSession, TabSummary } from "./lib/types";
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

// Page Initializer
async function init() {
  console.log("init");

  // Check for duplicates first
  const isDuplicate = await checkForDuplicates();
  if (isDuplicate) {
    // If this is a duplicate, stop initialization as this tab will be closed
    return;
  }

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
): HTMLLIElement {
  const li = document.createElement("li");
  li.textContent = label;
  if (isCurrent) {
    li.classList.add("current-window");
  }
  li.addEventListener("click", onClick);
  return li;
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

  // ---- Update the UI for Named and Unnamed Sessions ----
  // Get both containers:
  const namedSessionsContainer =
    document.querySelector<HTMLDivElement>("#named_sessions")!;
  const namedList = namedSessionsContainer.querySelector("ul")!;
  const unnamedSessionsContainer =
    document.querySelector<HTMLDivElement>("#tabs_sessions")!;
  const unnamedList = unnamedSessionsContainer.querySelector("ul")!;

  // Clear existing items in both lists:
  namedList.innerHTML = "";
  unnamedList.innerHTML = "";

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
