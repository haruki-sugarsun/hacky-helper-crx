/**
 * Search functionality for the tabs UI
 */

// TODO: Later move these logics to interact with service-worker to tabs.ts. so that features/ files only contains the pure business logic which are easy to test.
import { NamedSession, ClosedNamedSession } from "../lib/types";
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

  // Add keyboard shortcut for search ('/' key)
  document.addEventListener("keydown", (event: KeyboardEvent): void => {
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
  document.addEventListener("keydown", (event: KeyboardEvent): void => {
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
    const namedSessions: NamedSession[] =
      await serviceWorkerInterface.getNamedSessions();
    const closedSessions: ClosedNamedSession[] =
      await serviceWorkerInterface.getClosedNamedSessions();
    // Calculate openNamedSessions by excluding closed sessions from named sessions
    const openNamedSessions: NamedSession[] = namedSessions.filter(
      (session: NamedSession) =>
        !closedSessions.find(
          (closed: ClosedNamedSession) => closed.id === session.id,
        ),
    );

    // Filter sessions based on query
    const matchingNamedSessions = openNamedSessions
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
          sessionId: session.id,
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
function hideSearchResults(): void {
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

  items.forEach((item: Element) => {
    const sessionLabel = item.querySelector("session-label") as any;
    if (!sessionLabel) return;

    // TODO: Use proper getter method for labels.
    const labelText: string = sessionLabel.label?.toLowerCase() || "";
    if (labelText.includes(query)) {
      matches.push({
        element: item,
        label: sessionLabel.label || "",
        sessionId: sessionLabel.getAttribute("data-session-id") || undefined,
        isCurrent: item.classList.contains("current-window"),
      });
    }
  });

  return matches;
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
): void {
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
    resultItem.addEventListener("click", (): void => {
      // Hide search results
      hideSearchResults();
      // Simulate click on the original session item
      (result.element as HTMLElement).click();
    });

    container.appendChild(resultItem);
  });
}
