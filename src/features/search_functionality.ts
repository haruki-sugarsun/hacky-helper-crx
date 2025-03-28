/**
 * Search functionality for the tabs UI
 */

// TODO: Later move these logics to interact with service-worker to tabs.ts. so that features/ files only contains the pure business logic which are easy to test.
import {
  GET_NAMED_SESSIONS,
  GET_CLOSED_NAMED_SESSIONS,
} from "../lib/constants";
import { NamedSession, ClosedNamedSession } from "../lib/types";

/**
 * Initialize search functionality
 */
export function initSearchFunctionality() {
  // TODO: We may pass these elements as the method params.
  const searchBar = document.querySelector<any>("#searchBar");
  const searchResults =
    document.querySelector<HTMLDivElement>("#searchResults");

  if (!searchBar || !searchResults) return;

  // Set up search callback
  searchBar.onSearch = (query: string) => {
    showSearchResults(query);
  };

  // Set up clear callback
  searchBar.onClear = () => {
    hideSearchResults();
  };
  // Hide search results when focus moves outside of search section.
  // Note: The "focusin" event is triggered only when a focusable element (e.g., input, button, or an element with a tabindex) receives focus.
  // Ordinary elements like <span> are not focusable by default and will not fire "focusin" when clicked.
  // To handle such cases, we also listen for "click" events which are fired on all elements.
  document.addEventListener("focusin", (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".search-section")) {
      hideSearchResults();
    }
  });
  // Also hide search results on click outside search section
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".search-section")) {
      hideSearchResults();
    }
  });

  // Add keyboard shortcut for search ('/' key)
  document.addEventListener("keydown", (event) => {
    // Only activate if not in an input field or textarea
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

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

  // Add global keyboard shortcut (Alt+S)
  document.addEventListener("keydown", (event) => {
    if (event.key === "s" && event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      searchBar.focus();
    }
  });
}

/**
 * Show search results for the given query
 * @param query Search query
 */
async function showSearchResults(query: string) {
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
    // Get sessions from service worker
    const namedSessions = await getNamedSessionsFromServiceWorker();
    const closedSessions = await getClosedNamedSessionsFromServiceWorker();
    // Calculate openNamedSessions by excluding closed sessions from named sessions
    const openNamedSessions = namedSessions.filter(
      session => !closedSessions.find(closed => closed.id === session.id)
    );

    // Filter sessions based on query
    // TODO: Use openNamedSessions here and show results 
    const matchingNamedSessions = openNamedSessions
      .filter((session) => session.name.toLowerCase().includes(normalizedQuery))
      .map((session) => {
        // Find the corresponding DOM element
        const element = document
          .querySelector(`#named_sessions li [data-session-id="${session.id}"]`)
          ?.closest("li");
        return {
          element: element || document.createElement("li"), // Fallback if element not found
          label: session.name,
          sessionId: session.id,
          isCurrent: false, // We'll update this later if needed
        };
      });

    const matchingClosedSessions = closedSessions
      .filter((session) => session.name.toLowerCase().includes(normalizedQuery))
      .map((session) => {
        // Find the corresponding DOM element
        const element = document
          .querySelector(
            `#closed_sessions li [data-session-id="${session.id}"]`,
          )
          ?.closest("li");
        return {
          element: element || document.createElement("li"), // Fallback if element not found
          label: session.name,
          sessionId: session.id,
          isCurrent: false,
        };
      });

    // For unnamed sessions (windows), we still use the DOM approach
    const unnamedSessions = getMatchingSessions(
      "#tabs_sessions li",
      normalizedQuery,
    );

    // Clear previous results
    searchResults.innerHTML = "";

    // Combine all matching sessions
    const allMatches = [
      ...matchingNamedSessions,
      ...unnamedSessions,
      ...matchingClosedSessions,
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
      if (matchingNamedSessions.length > 0) {
        addResultsCategory(
          searchResults,
          "Named Sessions",
          matchingNamedSessions,
        );
      }

      if (unnamedSessions.length > 0) {
        addResultsCategory(searchResults, "Windows", unnamedSessions);
      }

      if (matchingClosedSessions.length > 0) {
        addResultsCategory(
          searchResults,
          "Closed Sessions",
          matchingClosedSessions,
        );
      }
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
function hideSearchResults() {
  const searchResults =
    document.querySelector<HTMLDivElement>("#searchResults");
  if (searchResults) {
    searchResults.style.display = "none";
    searchResults.innerHTML = "";
  }
}

/**
 * Get matching sessions from the specified container
 * @param selector CSS selector for the container
 * @param query Search query
 * @returns Array of matching session elements
 */
function getMatchingSessions(
  selector: string,
  query: string,
): Array<{
  element: Element;
  label: string;
  sessionId?: string;
  isCurrent: boolean;
}> {
  const items = document.querySelectorAll(selector);
  const matches: Array<{
    element: Element;
    label: string;
    sessionId?: string;
    isCurrent: boolean;
  }> = [];

  items.forEach((item) => {
    const sessionLabel = item.querySelector("session-label") as any;
    if (!sessionLabel) return;

    // TODO: Use proper getter method for labels.
    const label = sessionLabel.label?.toLowerCase() || "";
    if (label.includes(query)) {
      matches.push({
        element: item,
        label: sessionLabel.label || "",
        sessionId: sessionLabel.getAttribute("data-session-id"),
        isCurrent: item.classList.contains("current-window"),
      });
    }
  });

  return matches;
}

/**
 * Get named sessions from the service worker
 * @returns Promise with named sessions
 */
async function getNamedSessionsFromServiceWorker(): Promise<NamedSession[]> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: GET_NAMED_SESSIONS,
    });

    if (response && response.type === "GET_NAMED_SESSIONS_RESULT") {
      return response.payload;
    }
    return [];
  } catch (error) {
    console.error("Error fetching named sessions:", error);
    return [];
  }
}

/**
 * Get closed named sessions from the service worker
 * TODO: Check if we really need this. as  GET_NAMED_SESSIONS returns everything including Closed ones.
 * @returns Promise with closed named sessions
 */
async function getClosedNamedSessionsFromServiceWorker(): Promise<
  ClosedNamedSession[]
> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: GET_CLOSED_NAMED_SESSIONS,
    });

    if (response && response.type === "GET_CLOSED_NAMED_SESSIONS_RESULT") {
      return response.payload.closedSessions || [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching closed named sessions:", error);
    return [];
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
    element: Element;
    label: string;
    sessionId?: string;
    isCurrent: boolean;
  }>,
) {
  // Create category header
  const categoryHeader = document.createElement("div");
  categoryHeader.className = "search-result-category";
  categoryHeader.textContent = categoryName;
  container.appendChild(categoryHeader);

  // Add each result
  results.forEach((result) => {
    const resultItem = document.createElement("div");
    resultItem.className = "search-result-item";
    if (result.isCurrent) {
      resultItem.classList.add("current");
    }

    const resultLabel = document.createElement("div");
    resultLabel.className = "search-result-label";
    resultLabel.textContent = result.label;
    resultItem.appendChild(resultLabel);

    // Add click handler to select the session
    resultItem.addEventListener("click", () => {
      // Hide search results
      hideSearchResults();

      // Simulate click on the original session item
      (result.element as HTMLElement).click();
    });

    container.appendChild(resultItem);
  });
}
