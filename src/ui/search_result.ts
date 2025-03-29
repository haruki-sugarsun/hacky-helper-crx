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
    // Create container
    const container = document.createElement("div");
    container.className = "search-result-item";

    // Create label
    const labelElement = document.createElement("div");
    labelElement.className = "search-result-label";
    labelElement.textContent = this.getAttribute("label") || "No Label";

    // Create sub-label
    if (resultSubLabel) {
      const subLabelElement = document.createElement("div");
      subLabelElement.className = "search-result-sub-label";
      subLabelElement.textContent = resultSubLabel;
      container.appendChild(subLabelElement);
    }

    container.appendChild(labelElement);
    this.shadow.appendChild(container);
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
