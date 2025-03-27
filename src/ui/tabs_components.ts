import styles from "./tabs_components.css?inline";

/**
 * SessionLabel component displays a session's label with a menu button
 * and dropdown menu for various actions.
 */
class SessionLabel extends HTMLElement {
  private labelContainer: HTMLDivElement;
  private menuButton: HTMLButtonElement;
  private dropdownMenu: HTMLDivElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // Add styles to shadow DOM
    const styleElement = document.createElement("style");
    styleElement.textContent = styles;
    this.shadowRoot?.appendChild(styleElement);

    // Create the component's elements
    this.labelContainer = document.createElement("div");
    this.labelContainer.className = "session-label";

    this.menuButton = document.createElement("button");
    this.menuButton.className = "session-menu-button";
    this.menuButton.innerHTML = "⋮"; // Vertical ellipsis
    this.menuButton.title = "Session actions";

    this.dropdownMenu = document.createElement("div");
    this.dropdownMenu.className = "session-dropdown-menu";

    // Create a container for proper layout
    const container = document.createElement("div");
    container.className = "container";

    // Append elements to container
    container.appendChild(this.labelContainer);
    container.appendChild(this.menuButton);
    container.appendChild(this.dropdownMenu);

    // Append container to shadow DOM
    this.shadowRoot?.appendChild(container);

    // Add event listeners
    this.menuButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dropdownMenu.classList.toggle("show");

      // Close other open menus
      document.querySelectorAll("session-label").forEach((label) => {
        if (label !== this) {
          (label as SessionLabel).closeMenu();
        }
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", () => {
      this.closeMenu();
    });
  }

  /**
   * Close the dropdown menu
   */
  closeMenu() {
    this.dropdownMenu.classList.remove("show");
  }

  /**
   * Set the label text
   */
  set label(value: string) {
    this.labelContainer.textContent = value;
  }

  /**
   * Set the menu items
   */
  set menuItems(items: { text: string; onClick: (e: Event) => void }[]) {
    this.dropdownMenu.innerHTML = "";
    items.forEach((item) => {
      const menuItem = document.createElement("div");
      menuItem.className = "session-menu-item";
      menuItem.textContent = item.text;
      menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeMenu();
        item.onClick(e);
      });
      this.dropdownMenu.appendChild(menuItem);
    });
  }

  /**
   * Set whether this is the current window
   */
  set isCurrent(value: boolean) {
    if (value) {
      this.classList.add("current-window");
    } else {
      this.classList.remove("current-window");
    }
  }

  /**
   * Set the session ID
   */
  set sessionId(value: string | undefined) {
    if (value) {
      this.setAttribute("data-session-id", value);
    } else {
      this.removeAttribute("data-session-id");
    }
  }
}

// Register the web components
customElements.define("session-label", SessionLabel);
