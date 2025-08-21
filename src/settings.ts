import { h, init, propsModule, eventListenersModule } from "snabbdom";

import "./features/config-store";
import {
  ConfigStore,
  Config,
  BoolConfig,
  StringConfig,
  CONFIG_RO,
  CONFIG_STORE,
} from "./features/config-store";
import {
  OLLAMA_API_URL_DEFAULT,
  OLLAMA_MODEL_DEFAULT,
  OLLAMA_EMBEDDINGS_MODEL_DEFAULT,
} from "./lib/constants";
import serviceWorkerInterface from "./features/service-worker-interface";

import "./style.css";
import "./settings.css";

// TODO: Replace implementations and remove dependency to snabbdom.
// Initialize snabbdom patch function
const patch = init([propsModule, eventListenersModule]);

// Register change listener for elements in html:
// const settings = document.querySelector<HTMLDivElement>('#settings')!
const settingsTabOrderingUl = document.querySelector<HTMLUListElement>(
  "#settings-tab-ordering",
)!;
const settingsLlmUl =
  document.querySelector<HTMLUListElement>("#settings-llm")!;
const settingsBookmarkUl =
  document.querySelector<HTMLUListElement>("#settings-bookmark")!;

// Initialize the form asynchronously
async function initializeForm() {
  console.log("Initializing form...");
  console.log(
    "SORT_ON_TAB_SWITCH is BoolConfig:",
    ConfigStore.SORT_ON_TAB_SWITCH instanceof BoolConfig,
  );
  console.log(
    "USE_OLLAMA is BoolConfig:",
    ConfigStore.USE_OLLAMA instanceof BoolConfig,
  );

  // Fill the form:
  await appendBoolFormFrom(
    settingsTabOrderingUl,
    ConfigStore.SORT_ON_TAB_SWITCH,
  );

  // Add LLM settings
  await appendFormFrom(settingsLlmUl, ConfigStore.OPENAI_API_KEY);
  await appendFormFrom(settingsLlmUl, ConfigStore.OPENAI_API_BASE_URL);

  // Explicitly use appendBoolFormFrom for USE_OLLAMA
  if (ConfigStore.USE_OLLAMA instanceof BoolConfig) {
    console.log("Using appendBoolFormFrom for USE_OLLAMA");
    await appendBoolFormFrom(settingsLlmUl, ConfigStore.USE_OLLAMA);
  } else {
    console.error("USE_OLLAMA is not a BoolConfig instance!");
    // Fallback to regular form
    await appendFormFrom(settingsLlmUl, ConfigStore.USE_OLLAMA);
  }

  await appendFormFrom(
    settingsLlmUl,
    ConfigStore.OLLAMA_API_URL,
    OLLAMA_API_URL_DEFAULT,
  );
  await appendFormFrom(
    settingsLlmUl,
    ConfigStore.OLLAMA_MODEL,
    OLLAMA_MODEL_DEFAULT,
  );
  await appendFormFrom(
    settingsLlmUl,
    ConfigStore.OLLAMA_EMBEDDINGS_MODEL,
    OLLAMA_EMBEDDINGS_MODEL_DEFAULT,
  );

  // Add Bookmark settings
  await appendBookmarkChooser(
    settingsBookmarkUl,
    ConfigStore.BOOKMARK_PARENT_ID,
  );

  // Update Instance ID field in settings UI
  const instanceIdInput = document.getElementById(
    "instance_id",
  ) as HTMLInputElement;
  if (instanceIdInput) {
    let instanceId = await CONFIG_RO.INSTANCE_ID();
    if (!instanceId) {
      instanceId = Math.random().toString(36).substring(2, 10);
      // TODO: Implement a setter method in COFIG_STORE instead of set() for instance ID. So that we can ensure validation.
      CONFIG_STORE.updateInstanceId(instanceId);
    }
    instanceIdInput.value = instanceId;
    instanceIdInput.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      if (!CONFIG_STORE.updateInstanceId(target.value)) {
        // TODO: Show a message in UI in not-interrupting way (toast + style change?) if it fails.
        alert("Invalid instance ID: must be alphanumerical.");
      }
    });
    const regenerateBtn = document.createElement("button");
    regenerateBtn.textContent = "Regenerate Instance ID";
    regenerateBtn.addEventListener("click", async () => {
      let newId = Math.random().toString(36).substring(2, 10);
      CONFIG_STORE.updateInstanceId(newId);
      instanceIdInput.value = newId;
    });
    instanceIdInput.parentNode?.insertBefore(
      regenerateBtn,
      instanceIdInput.nextSibling,
    );
  }

  // Setup unread log badge updater
  try {
    setupLogUnreadBadge();
  } catch (e) {
    console.error("Failed to setup log unread badge:", e);
  }
}

// Poll the service worker for recent logs and update the badge.
function setupLogUnreadBadge() {
  const badge = document.getElementById("log-unread-badge");
  if (!badge) return;

  // Query timeframe: last 24 hours by default
  const timeframeMs = 24 * 60 * 60 * 1000;

  async function refresh() {
    if (!badge) return;
    try {
      const now = Date.now();
      const res = await serviceWorkerInterface.queryLogs({
        fromTs: now - timeframeMs,
        limit: 1000,
      });
      const total = res?.total ?? (res.entries ? res.entries.length : 0);
      // For simplicity, show total events in timeframe as "unread" count.
      badge.textContent = String(total);
      badge.style.display = total > 0 ? "inline-block" : "none";
    } catch (err) {
      console.error("Error refreshing log unread badge:", err);
      badge.textContent = "?";
      badge.style.display = "inline-block";
    }
  }

  // Initial refresh and periodic polling every 30s
  refresh();
  setInterval(refresh, 30 * 1000);
}

// Function to create a bookmark folder chooser
async function appendBookmarkChooser(
  parentUl: HTMLUListElement,
  config: StringConfig,
) {
  // Get the current value asynchronously
  const currentBookmarkId = await config.get();

  // Create the list item
  const li = document.createElement("li");

  // Create the label
  const label = document.createElement("label");
  label.setAttribute("for", config.key);
  label.textContent = config.description;

  // Create the select element for bookmark folders
  const select = document.createElement("select");
  select.setAttribute("id", config.key);

  // Add a default option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select a bookmark folder --";
  select.appendChild(defaultOption);

  // Add the description
  const description = document.createElement("p");
  description.className = "description";
  description.textContent = config.longDescription;

  // Add a button to refresh the bookmark list
  const refreshButton = document.createElement("button");
  refreshButton.textContent = "Refresh Bookmark Folders";
  refreshButton.addEventListener("click", () => {
    loadBookmarkFolders(select, currentBookmarkId);
  });

  // Add event listener for select change
  select.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    config.set(target.value);
  });

  // Append elements to the list item
  li.appendChild(label);
  li.appendChild(select);
  li.appendChild(refreshButton);
  li.appendChild(description);

  // Append the list item to the parent
  parentUl.appendChild(li);

  // Load the bookmark folders
  loadBookmarkFolders(select, currentBookmarkId);
}

// Function to load bookmark folders into the select element
async function loadBookmarkFolders(
  selectElement: HTMLSelectElement,
  selectedValue: string,
) {
  // Clear existing options except the default one
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }

  try {
    // Get all bookmark folders
    const bookmarkTree = await chrome.bookmarks.getTree();

    // Recursively add bookmark folders to the select element
    function addBookmarkFolders(
      nodes: chrome.bookmarks.BookmarkTreeNode[],
      depth = 0,
    ) {
      for (const node of nodes) {
        // Only add folders (nodes with children)
        if (node.children) {
          const option = document.createElement("option");
          option.value = node.id;
          // Add indentation to show hierarchy
          option.textContent =
            "  ".repeat(depth) + (node.title || "(untitled)");
          option.selected = node.id === selectedValue;
          selectElement.appendChild(option);

          // Recursively add child folders
          if (node.children) {
            addBookmarkFolders(node.children, depth + 1);
          }
        }
      }
    }

    addBookmarkFolders(bookmarkTree);
  } catch (error) {
    console.error("Error loading bookmark folders:", error);

    // Add an error option
    const errorOption = document.createElement("option");
    errorOption.value = "";
    errorOption.textContent = "Error loading bookmarks. Please try again.";
    selectElement.appendChild(errorOption);
  }
}

// Start initialization
initializeForm().catch((error) => {
  console.error("Failed to initialize form:", error);
});

async function appendBoolFormFrom(
  parentUl: HTMLUListElement,
  config: BoolConfig,
) {
  // Get the current value asynchronously
  const isChecked = await config.get();

  console.log(
    `Creating checkbox for ${config.key} with initial value:`,
    isChecked,
  );

  // Create a real DOM element for the checkbox
  const li = document.createElement("li");

  const label = document.createElement("label");
  label.setAttribute("for", config.key);
  label.textContent = config.description;

  const checkbox = document.createElement("input");
  checkbox.setAttribute("type", "checkbox");
  checkbox.setAttribute("id", config.key);
  checkbox.checked = !!isChecked; // Ensure boolean value

  checkbox.addEventListener("change", (event) => {
    console.log("Checkbox changed:", event);
    const target = event.target as HTMLInputElement;
    config.set(target.checked);
  });

  const description = document.createElement("p");
  description.className = "description";
  description.textContent = config.longDescription;

  // Append elements to the list item
  li.appendChild(label);
  li.appendChild(checkbox);
  li.appendChild(description);

  // Append the list item to the parent
  parentUl.appendChild(li);
}

async function appendFormFrom(
  parentUl: HTMLUListElement,
  config: Config,
  placeholder: string = "",
) {
  // Get the current value asynchronously
  const value = await config.get();
  const stringValue =
    value !== undefined && value !== null ? String(value) : "";

  // Create virtual DOM node
  const vnode = h("li", [
    h("label", { attrs: { for: config.key } }, config.description),
    h("input", {
      attrs: {
        type: "text",
        id: config.key,
        placeholder: placeholder,
      },
      props: {
        value: stringValue,
      },
      on: {
        input: (event: Event) => {
          console.log(event);
          const target = event.target as HTMLInputElement;
          config.set(target.value);
        },
      },
    }),
    h("p", { attrs: { class: "description" } }, config.longDescription),
  ]);

  // Patch the real DOM with the virtual DOM
  const newNode = document.createElement("li");
  parentUl.appendChild(newNode);
  patch(newNode, vnode);
}
