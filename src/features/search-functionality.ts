/**
 * Search functionality for the tabs UI
 */

import { SearchResultComponent } from "../ui/search-result";
// TODO: Later move these logics to interact with service-worker to tabs.ts. so that features/ files only contains the pure business logic which are easy to test.
import {
  NamedSession,
  ClosedNamedSession,
  SyncedTabEntity,
} from "../lib/types";
import serviceWorkerInterface from "./service-worker-interface";

/**
 * Initialize search functionality
 */
export function initSearchFunctionality(): void {
  // TODO: We may pass these elements as the method params from the caller (tabs.ts).
  const searchBar = document.querySelector<any>("#searchBar");
  const searchResults =
    document.querySelector<HTMLDivElement>("#searchResults");

  if (!searchBar || !searchResults) return;

  // Set up search callback
  searchBar.onSearch = (query: string): void => {
    showSearchResults(query);
  };

  // Set up clear callback
  searchBar.onClear = (): void => {
    hideSearchResults();
  };

  // Hide search results when focus moves outside of search section.
  // Note: The "focusin" event is triggered only when a focusable element (e.g., input, button, or an element with a tabindex) receives focus.
  // Ordinary elements like <span> are not focusable by default and will not fire "focusin" when clicked.
  // To handle such cases, we also listen for "click" events which are fired on all elements.
  document.addEventListener("focusin", (event: Event): void => {
    const target = event.target as HTMLElement;
    if (!target.closest(".search-section")) {
      hideSearchResults();
    }
  });
  // Also hide search results on click outside search section
  document.addEventListener("click", (event: Event): void => {
    const target = event.target as HTMLElement;
    if (!target.closest(".search-section")) {
      hideSearchResults();
    }
  });

  // Add keyboard navigation for search results
  searchBar.addEventListener("keydown", (event: KeyboardEvent): void => {
    // TODO: And we also want to have "enter" key to open the result.
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "Enter"
    ) {
      event.preventDefault();
      const results = searchResults.querySelectorAll("search-result");
      if (results.length === 0) return;

      let currentIndex = Array.from(results).findIndex((item) =>
        item.classList.contains("highlighted"),
      );

      if (event.key === "Enter") {
        // TODO: Check if this is equivalent to results[currentIndex] and dedup the logic if same.
        const current = Array.from(results).find((item) =>
          item.classList.contains("highlighted"),
        );

        if (current) {
          console.log(current);
          // TODO: This is not working as expected now.
          current.dispatchEvent(new Event("click"));
          return;
        }
      }
      // Remove current highlight
      if (currentIndex !== -1) {
        results[currentIndex].classList.remove("highlighted");
      }
      // Update index based on key
      if (event.key === "ArrowUp") {
        currentIndex = (currentIndex - 1 + results.length) % results.length;
      } else if (event.key === "ArrowDown") {
        currentIndex = (currentIndex + 1) % results.length;
      }

      // Highlight new result
      results[currentIndex].classList.add("highlighted");
      results[currentIndex].scrollIntoView({ block: "nearest" });
    }
  });

  // Add keyboard shortcut for search ('/' key)
  document.addEventListener("keydown", (event: KeyboardEvent): void => {
    // Only activate if not in an input field or textarea
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // TODO: we can allow input to the search bar if already focused.
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      searchBar.focus();
    }
  });

  // TODO: Check if this works as expected. It might have some timing issue, and implmenet a btter solution if needed.
  // Listen for hotkey messages from the service worker.
  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === "hotkey" && message.command === "focus-search-bar") {
      searchBar.focus();
    }
  });
}

/**
 * Show search results for the given query
 * @param query Search query
 */
async function showSearchResults(query: string): Promise<void> {
  const searchResults =
    document.querySelector<HTMLDivElement>("#searchResults");
  if (!searchResults) return;

  const normalizedQuery = query.toLowerCase().trim();

  // If query is empty, hide search results
  if (!normalizedQuery) {
    hideSearchResults();
    return;
  }

  // Show loading indicator
  searchResults.innerHTML = `
    <div class="search-loading">
      Searching...
    </div>
  `;
  searchResults.style.display = "block";

  try {
    // TODO: Cache these sessions and openTabs on the start of search. We can clear if the query is cleared, or searchBar loses focus.
    const namedSessions: NamedSession[] =
      await serviceWorkerInterface.getNamedSessions();
    const closedSessions: ClosedNamedSession[] =
      await serviceWorkerInterface.getClosedNamedSessions();
    const savedBookmarks = await serviceWorkerInterface.getAllSavedBookmarks();
    // TODO: we can actually fetch active named sessions direclty.
    // Calculate activeNamedSessions by excluding closed sessions from named sessions
    const activeNamedSessions: NamedSession[] = namedSessions.filter(
      (session: NamedSession) =>
        !closedSessions.find(
          (closed: ClosedNamedSession) => closed.id === session.id,
        ),
    );

    // Filter sessions based on query
    const matchingNamedSessions = activeNamedSessions
      .filter((session: NamedSession) =>
        session.name.toLowerCase().includes(normalizedQuery),
      )
      .map((session: NamedSession) => {
        // Find the corresponding DOM element
        const element = document
          .querySelector(`#named_sessions li [data-session-id="${session.id}"]`)
          ?.closest("li");
        return {
          element: element || document.createElement("li"), // Fallback if element not found
          label: session.name,
          session: { sessionId: session.id },
          isCurrent: false, // We'll update this later if needed
        };
      });

    const matchingClosedSessions = closedSessions
      .filter((session: ClosedNamedSession) =>
        session.name.toLowerCase().includes(normalizedQuery),
      )
      .map((session: ClosedNamedSession) => {
        // Find the corresponding DOM element
        const element = document
          .querySelector(
            `#closed_sessions li [data-session-id="${session.id}"]`,
          )
          ?.closest("li");
        return {
          element: element || document.createElement("li"), // Fallback if element not found
          label: session.name,
          session: { sessionId: session.id },
          isCurrent: false,
        };
      });

    // Fetch open tab titles using Chrome API
    const openTabs = await chrome.tabs.query({});
    const matchingTabs = openTabs
      // TODO: We might want to match with URL too.
      .filter((tab) => tab.title?.toLowerCase().includes(normalizedQuery))
      .map((tab) => ({
        element: document.createElement("li"), // Placeholder element
        label: tab.title || "",
        subLabel: tab.url || "",
        tab: { tabId: tab.id!, windowId: tab.windowId },
        isCurrent: tab.active || false,
      }));

    // Clear previous results
    searchResults.innerHTML = "";

    const matchingBookmarks = savedBookmarks
      .filter((bookmark: SyncedTabEntity) =>
        bookmark.title.toLowerCase().includes(normalizedQuery),
      )
      .map((bookmark: SyncedTabEntity) => ({
        element: document.createElement("li"),
        label: bookmark.title,
        subLabel: bookmark.url,
        isCurrent: false,
        savedBookmark: { sessionId: bookmark.sessionId, url: bookmark.url },
      }));

    // Combine all matching sessions, tabs, and bookmarks
    const allMatches = [
      ...matchingNamedSessions,
      ...matchingClosedSessions,
      ...matchingTabs,
      ...matchingBookmarks,
    ];

    if (allMatches.length === 0) {
      // No matches found
      searchResults.innerHTML = `
        <div class="search-no-results">
          No sessions matching "${normalizedQuery}"
        </div>
      `;
    } else {
      // Add category headers and results
      let resultComponents: SearchResultComponent[] = [];
      if (matchingNamedSessions.length > 0) {
        resultComponents = resultComponents.concat(
          addResultsCategory(
            searchResults,
            "Named Sessions",
            matchingNamedSessions,
          ),
        );
      }

      if (matchingClosedSessions.length > 0) {
        resultComponents = resultComponents.concat(
          addResultsCategory(
            searchResults,
            "Closed Sessions",
            matchingClosedSessions,
          ),
        );
      }

      if (matchingTabs.length > 0) {
        resultComponents = resultComponents.concat(
          addResultsCategory(searchResults, "Open Tabs", matchingTabs),
        );
      }

      if (matchingBookmarks.length > 0) {
        resultComponents = resultComponents.concat(
          addResultsCategory(
            searchResults,
            "Saved Bookmarks",
            matchingBookmarks,
          ),
        );
      }

      // Register hover handlers for all components
      resultComponents.forEach((component) => {
        component.addEventListener("mouseenter", () => {
          // Clear highlighted class from all other components
          resultComponents.forEach((otherComponent) => {
            if (otherComponent === component) {
              otherComponent.classList.add("highlighted");
            } else {
              otherComponent.classList.remove("highlighted");
            }
          });
        });
        component.addEventListener("mouseleave", () => {
          component.classList.remove("highlighted");
        });
      });
    }
  } catch (error) {
    console.error("Error searching sessions:", error);
    searchResults.innerHTML = `
      <div class="search-error">
        Error searching sessions
      </div>
    `;
  }

  // Show search results
  searchResults.style.display = "block";
}

/**
 * Hide search results
 */
function hideSearchResults(): void {
  const searchResults =
    document.querySelector<HTMLDivElement>("#searchResults");
  if (searchResults) {
    searchResults.style.display = "none";
    searchResults.innerHTML = "";
  }
}

/**
 * Add a category of search results to the search results container
 * @param container Search results container
 * @param categoryName Category name
 * @param results Array of matching session elements
 */
function addResultsCategory(
  container: HTMLDivElement,
  categoryName: string,
  results: Array<{
    element: Element; // TODO: Consider if having an element helps something. Maybe not.
    label: string;
    subLabel?: string;
    session?: { sessionId?: string }; // `session` exists for sessions. Handler will activate or restore it.
    tab?: { tabId: number; windowId: number }; // `tab` exists for open tabs. Handler will activate it.
    isCurrent: boolean;
    savedBookmark?: { sessionId: string; url: string }; // Added field for saved bookmarks
  }>,
): SearchResultComponent[] {
  // Create category header
  const categoryHeader = document.createElement("div");
  categoryHeader.className = "search-result-category";
  categoryHeader.textContent = categoryName;
  container.appendChild(categoryHeader);

  // Add each result
  const resultComponents: SearchResultComponent[] = [];
  results.forEach((result) => {
    // Use SearchResultComponent instead of createElement
    // TODO: Check https://stackoverflow.com/questions/55581839/passing-values-to-constructor-of-custom-htmlelement
    //       and https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-conformance
    const searchResult = new SearchResultComponent({
      resultLabel: result.label,
      resultSubLabel: result.subLabel,
      isCurrent: result.isCurrent,
      onClick: () => {
        hideSearchResults();
        // TODO: instead of passing a click event, we want to trigger desired actions per results.
        //       - Activate the window for Active Named Sessions.
        //       - Restore the session for Closed Named Sessions.
        //       - Activate the tab for a open tab in any of the windows.
        if (result.session) {
          // Handle sessions
          serviceWorkerInterface.activateSession(result.session.sessionId!);
        } else if (result.tab) {
          // Handle tabs using tabId and activate window
          chrome.tabs.update(result.tab.tabId, { active: true });
          chrome.windows.update(result.tab.windowId!, { focused: true });
        } else if (result.savedBookmark) {
          // Handle saved bookmarks
          const { sessionId, url } = result.savedBookmark;
          serviceWorkerInterface.activateSession(sessionId).then(() =>
            serviceWorkerInterface
              .getNamedSessions()
              .then((sessions) => sessions.find((s) => s.id === sessionId))
              .then((session) => {
                const windowId = session?.windowId;
                if (!windowId) return;
                chrome.tabs.query({ windowId }, (tabs) => {
                  const matchingTab = tabs.find((tab) => tab.url === url);
                  if (matchingTab) {
                    chrome.tabs.update(matchingTab.id!, { active: true });
                  } else {
                    chrome.tabs.create({ url, windowId });
                  }
                });
              }),
          );
        }
      },
    });
    container.appendChild(searchResult);
    resultComponents.push(searchResult);
  });
  return resultComponents;
}
