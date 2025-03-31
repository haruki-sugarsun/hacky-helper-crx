/**
 * Search bar component for the tabs UI
 */

import { BaseComponent } from "./BaseComponent";
import styles from "./search-bar.css?inline";

class SearchBarComponent extends BaseComponent {
  private searchInput: HTMLInputElement;
  private clearButton: HTMLButtonElement;

  // Callback functions
  public onSearch: ((query: string) => void) | null = null;
  public onClear: (() => void) | null = null;

  constructor() {
    super();
    const shadow = this.initialize(styles);

    // Create container
    const container = document.createElement("div");
    container.className = "search-container";

    // Create search input
    this.searchInput = document.createElement("input");
    this.searchInput.className = "search-input";
    this.searchInput.type = "text";
    this.searchInput.placeholder = "Search sessions... (/ or Alt+S)";

    // Create clear button
    // TODO: Consider replace the button label with an image.
    this.clearButton = document.createElement("button");
    this.clearButton.className = "clear-button";
    this.clearButton.textContent = "X";
    this.clearButton.style.display = "none";

    // Add event listeners
    this.searchInput.addEventListener("input", this.handleInput.bind(this));
    this.searchInput.addEventListener("keydown", this.handleKeyDown.bind(this));
    this.clearButton.addEventListener("click", this.handleClear.bind(this));

    // Append elements to container
    container.appendChild(this.searchInput);
    container.appendChild(this.clearButton);

    // Append container to shadow DOM
    shadow.appendChild(container);
  }

  /**
   * Handle input event
   */
  private handleInput() {
    const query = this.searchInput.value.trim();

    // Show/hide clear button
    this.clearButton.style.display = query ? "block" : "none";

    // Call onSearch callback
    if (this.onSearch) {
      this.onSearch(query);
    }
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(event: KeyboardEvent) {
    // Handle Escape key to clear search
    if (event.key === "Escape") {
      this.handleClear();
      event.preventDefault();
    }
  }

  /**
   * Handle clear button click
   */
  private handleClear() {
    this.searchInput.value = "";
    this.clearButton.style.display = "none";
    this.searchInput.focus();

    // Call onClear callback
    if (this.onClear) {
      this.onClear();
    }
  }

  /**
   * Focus the search input
   */
  public focus() {
    this.searchInput.focus();
  }

  /**
   * Get the current search query
   */
  public getQuery(): string {
    return this.searchInput.value.trim();
  }

  /**
   * Set the search query
   */
  public setQuery(query: string) {
    this.searchInput.value = query;
    this.handleInput();
  }
}

// Define the custom element
customElements.define("search-bar", SearchBarComponent);
