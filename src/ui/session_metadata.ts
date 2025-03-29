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
import styles from "./session_metadata.css?inline";

const sharedSheet = new CSSStyleSheet();
sharedSheet.replaceSync(styles);

export class SessionMetadataComponent extends HTMLElement {
  static init() {
    // Define the custom element so it can be used as <session-metadata>
    customElements.define("session-metadata", SessionMetadataComponent);
  }

  static get observedAttributes() {
    return ["session-id", "window-id", "created", "updated", "unnamed"];
  }

  constructor() {
    super();
    // Attach a shadow DOM so styles and markup are encapsulated.
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [sharedSheet];
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
    this.shadowRoot!.innerHTML = `${content}`;
  }
}
