/**
 * A Web Component that displays session metadata.
 *
 * Attributes:
 *  - session-id: The ID of the session.
 *  - window-id: The associated window ID.
 *  - created: The creation date/time.
 *  - updated: The last updated date/time.
 *  - unnamed: If set to "true", displays a message for unnamed sessions.
 */
import { BaseComponent } from "./BaseComponent";
import styles from "./session-metadata.css?inline";

export class SessionMetadataComponent extends BaseComponent {
  static get observedAttributes() {
    return ["session-id", "window-id", "created", "updated", "unnamed"];
  }

  private sessionIdSpan: HTMLElement;
  private windowIdSpan: HTMLElement;
  private createdSpan: HTMLElement;
  private updatedSpan: HTMLElement;
  private unnamedSpan: HTMLElement;

  constructor() {
    super();
    this.initialize(styles);

    // Initialize the HTML structure using innerHTML with separators.
    this.shadow.innerHTML = `
      <span class="session-id"></span>
      <span class="separator"> | </span>
      <span class="window-id"></span>
      <span class="separator"> | </span>
      <span class="created"></span>
      <span class="separator"> | </span>
      <span class="updated"></span>
      <span class="unnamed"></span>
    `;

    // Assign span elements to instance members.
    this.sessionIdSpan = this.shadow.querySelector(".session-id")!;
    this.windowIdSpan = this.shadow.querySelector(".window-id")!;
    this.createdSpan = this.shadow.querySelector(".created")!;
    this.updatedSpan = this.shadow.querySelector(".updated")!;
    this.unnamedSpan = this.shadow.querySelector(".unnamed")!;
  }

  attributeChangedCallback(
    _name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ) {
    // Re-render the element when attributes change.
    this.render();
  }

  render() {
    const isUnnamed = this.getAttribute("unnamed") === "true";
    const isNamed = !isUnnamed && this.getAttribute("session-id");
    const isClosed = !isUnnamed && !this.getAttribute("session-id");

    // Update shadow root class based on state.
    const shadowHost = this.shadow.host as HTMLElement;
    shadowHost.classList.remove("named", "unnamed", "closed");
    if (isUnnamed) {
      shadowHost.classList.add("unnamed");
    } else if (isNamed) {
      shadowHost.classList.add("named");
    } else if (isClosed) {
      shadowHost.classList.add("closed");
    }

    // Update span contents.
    this.sessionIdSpan.textContent = `Session ID: ${this.getAttribute("session-id") || "N/A"}`;
    this.windowIdSpan.textContent = `Window ID: ${this.getAttribute("window-id") || "N/A"}`;
    this.createdSpan.textContent = `Created: ${this.getAttribute("created") || "N/A"}`;
    this.updatedSpan.textContent = `Updated: ${this.getAttribute("updated") || "N/A"}`;
    this.unnamedSpan.textContent = isUnnamed ? "(Unnamed session)" : "";
  }
}

customElements.define("session-metadata", SessionMetadataComponent);
