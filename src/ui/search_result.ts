/**
 * Web Component for displaying a search result item.
 */

import { BaseComponent } from "./base_component";
import styles from "./search_result.css?inline";

export class SearchResultComponent extends BaseComponent {
  constructor({
    resultLabel = "No Label",
    resultSubLabel = undefined as string | undefined,
    sessionId = undefined as string | undefined,
    isCurrent = false,
    onClick = undefined as (() => void) | undefined,
  } = {}) {
    super();
    this.initialize(styles);

    this.setAttribute("label", resultLabel);
    if (sessionId) this.setAttribute("session-id", sessionId);
    if (isCurrent) this.classList.add("current");
    if (onClick) this.addEventListener("click", onClick);
    // TODO: Build the structure using using innerHTML.
    // Build structure using innerHTML for a cleaner markup and improved order.
    this.shadow.innerHTML = `
      <div class="search-result-item">
        <div class="search-result-label">${this.getAttribute("label") || "No Label"}</div>
        ${resultSubLabel ? `<div class="search-result-sub-label">${resultSubLabel}</div>` : ""}
      </div>
    `;
  }

  connectedCallback() {
    this.addEventListener("click", () => {
      const sessionId = this.getAttribute("session-id");
      if (sessionId) {
        this.dispatchEvent(
          new CustomEvent("search-result-click", {
            detail: { sessionId },
            bubbles: true,
            composed: true,
          }),
        );
      }
    });
  }
}

customElements.define("search-result", SearchResultComponent);
