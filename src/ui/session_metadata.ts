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
import { BaseComponent } from "./base_component";
import styles from "./session_metadata.css?inline";

export class SessionMetadataComponent extends BaseComponent {
  static get observedAttributes() {
    return ["session-id", "window-id", "created", "updated", "unnamed"];
  }

  constructor() {
    super();
    this.initialize(styles);
    // TODO: Construct DOM here using shadow.
    this.render();
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
    let content = "";
    // If the 'unnamed' attribute is present and equals "true"
    if (this.getAttribute("unnamed") === "true") {
      const windowId = this.getAttribute("window-id") || "N/A";
      content = `<div>Window ID: ${windowId} (Unnamed session)</div>`;
    } else {
      const sessionId = this.getAttribute("session-id") || "N/A";
      const windowId = this.getAttribute("window-id") || "N/A";
      const created = this.getAttribute("created") || "N/A";
      const updated = this.getAttribute("updated") || "N/A";
      content = `<div>
        Session ID: ${sessionId} | 
        Window ID: ${windowId} | 
        Created: ${created} | 
        Updated: ${updated}
      </div>`;
    }
    this.shadow.innerHTML = `${content}`;
  }
}

customElements.define("session-metadata", SessionMetadataComponent);
