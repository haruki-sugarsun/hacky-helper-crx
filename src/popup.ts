import "./style.css";
import "./popup.css";
import { CONFIG_STORE, CONFIG_RO } from "./features/config-store";
import { MIGRATE_TAB } from "./lib/constants";
import serviceWorkerInterface from "./features/service-worker-interface";
import { handleMessages } from "./popup/popup-messages";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return handleMessages(message, sender, sendResponse);
});

// Function to initialize the toggle states from configuration
async function initializeToggles() {
  const llmToggle = document.getElementById("llm-toggle") as HTMLInputElement;
  const batteryToggle = document.getElementById(
    "battery-toggle",
  ) as HTMLInputElement;
  const batteryStatus = document.getElementById("battery-status");

  if (!llmToggle || !batteryToggle) {
    console.error("Toggle elements not found");
    return;
  }

  // Get current configuration values
  const llmEnabled = await CONFIG_RO.LLM_ENABLED();
  const disableOnBattery = await CONFIG_RO.DISABLE_LLM_ON_BATTERY();

  // Set toggle states
  llmToggle.checked = llmEnabled !== false; // Default to true if not set
  batteryToggle.checked = disableOnBattery === true;

  // Add event listeners
  llmToggle.addEventListener("change", () => {
    CONFIG_STORE.set("LLM_ENABLED", llmToggle.checked);
    console.log(`LLM services ${llmToggle.checked ? "enabled" : "disabled"}`);
  });

  batteryToggle.addEventListener("change", () => {
    CONFIG_STORE.set("DISABLE_LLM_ON_BATTERY", batteryToggle.checked);
    console.log(
      `Disable on battery ${batteryToggle.checked ? "enabled" : "disabled"}`,
    );

    // If battery detection is enabled, check battery status immediately
    if (batteryToggle.checked) {
      checkBatteryStatus(llmToggle, batteryStatus);
    }
  });

  // Check battery status if available
  await checkBatteryStatus(llmToggle, batteryStatus);
}

// Function to check battery status and update LLM toggle accordingly
async function checkBatteryStatus(
  llmToggle: HTMLInputElement,
  batteryStatus: HTMLElement | null,
) {
  // Check if Battery API is available
  if (typeof navigator.getBattery !== "function") {
    console.log("Battery API not available in this browser");

    if (batteryStatus) {
      batteryStatus.style.display = "block";
      batteryStatus.textContent =
        "Battery status detection not supported in this browser";
      batteryStatus.className = "battery-status";
    }
    return;
  }

  try {
    const battery = await navigator.getBattery();

    if (batteryStatus) {
      batteryStatus.style.display = "block";
      updateBatteryStatus(battery, llmToggle, batteryStatus);

      // Add event listeners for battery status changes
      battery.addEventListener("chargingchange", () => {
        updateBatteryStatus(battery, llmToggle, batteryStatus);
      });

      battery.addEventListener("levelchange", () => {
        updateBatteryStatus(battery, llmToggle, batteryStatus);
      });
    }
  } catch (error) {
    console.error("Error accessing battery status:", error);

    if (batteryStatus) {
      batteryStatus.style.display = "block";
      batteryStatus.textContent = "Error accessing battery status";
      batteryStatus.className = "battery-status";
    }
  }
}

// Function to update the UI based on battery status
async function updateBatteryStatus(
  battery: any,
  llmToggle: HTMLInputElement,
  statusElement: HTMLElement,
) {
  const isCharging = battery.charging;
  const level = Math.floor(battery.level * 100);

  // Update status display
  statusElement.textContent = `Battery: ${level}% ${isCharging ? "(Charging)" : "(Discharging)"}`;
  statusElement.className = `battery-status ${isCharging ? "charging" : "discharging"}`;

  // Check if we should disable LLM based on battery status
  const disableOnBattery = await CONFIG_STORE.get("DISABLE_LLM_ON_BATTERY");

  if (disableOnBattery && !isCharging) {
    // Disable LLM services when on battery
    llmToggle.checked = false;
    CONFIG_STORE.set("LLM_ENABLED", false);
    console.log("LLM services automatically disabled due to battery mode");
  } else if (disableOnBattery && isCharging) {
    // Re-enable LLM services when charging resumes
    llmToggle.checked = true;
    CONFIG_STORE.set("LLM_ENABLED", true);
    console.log("LLM services automatically enabled due to charging");
  }
}

// Function to show the migration dialog
async function showMigrationDialog() {
  const dialog = document.getElementById("migrationDialog") as HTMLDivElement;
  const tabInfoDiv = document.getElementById(
    "migrationTabInfo",
  ) as HTMLDivElement;
  const availableDestinationsDiv = document.getElementById(
    "availableDestinations",
  ) as HTMLDivElement;

  // Get the current tab
  const [currentTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  // TODO: We should not migrade the tabs UI or other extension URL.
  if (!currentTab || !currentTab.id) {
    alert("Could not determine the current tab.");
    return;
  }

  // Display tab info
  tabInfoDiv.innerHTML = `
    <p><strong>Tab:</strong> ${currentTab.title || "Untitled"}</p>
    <p><strong>URL:</strong> ${currentTab.url || "No URL"}</p>
  `;

  // Get all windows
  const windows = await chrome.windows.getAll();

  // Get all named sessions
  const sessions = await serviceWorkerInterface.getNamedSessions();

  // Show the dialog
  dialog.style.display = "flex";
  availableDestinationsDiv.innerHTML = "<p>Loading destinations...</p>";

  // Filter out the current window
  const otherWindows = windows.filter(
    (window) => window.id !== currentTab.windowId,
  );

  if (otherWindows.length === 0) {
    availableDestinationsDiv.innerHTML =
      "<p>No other windows available to migrate to.</p>";
    return;
  }

  // Display all windows as potential destinations
  availableDestinationsDiv.innerHTML = "";

  // Create a destination option for each window (except the current one)
  otherWindows.forEach((window) => {
    const destinationOption = document.createElement("div");
    destinationOption.className = "destination-option";

    // Find if this window has a named session
    const session = sessions.find((s) => s.windowId === window.id);

    destinationOption.innerHTML = `
      <div class="destination-name">${session?.name ? `${session.name} (Window ${window.id})` : `Window ${window.id}`}</div>
    `;

    // Add click event to migrate the tab
    destinationOption.addEventListener("click", async () => {
      if (window.id && currentTab.id) {
        await migrateTab(currentTab.id, window.id);
        dialog.style.display = "none";
        // Close the popup after migration
        // Use setTimeout to allow the migration to complete before closing
        setTimeout(() => {
          // Cast to any to bypass TypeScript error
          self.close();
        }, 300);
      }
    });

    availableDestinationsDiv.appendChild(destinationOption);
  });
}

// Function to migrate a tab to another window
async function migrateTab(tabId: number, windowId: number) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MIGRATE_TAB,
      payload: {
        tabId,
        windowId,
      },
    });

    if (response && response.type === "MIGRATE_TAB_RESULT") {
      console.log("Tab migrated successfully:", response.payload);
      return true;
    } else {
      console.error("Error migrating tab:", response);
      return false;
    }
  } catch (error) {
    console.error("Error sending migrate tab message:", error);
    return false;
  }
}

// Initialize the UI when the document is loaded
document.addEventListener("DOMContentLoaded", async () => {
  await initializeToggles();

  // Add event listener for the migrate button
  const migrateButton = document.getElementById("migrateTabButton");
  if (migrateButton) {
    migrateButton.addEventListener("click", showMigrationDialog);
  }

  // Add event listener for the cancel button in the migration dialog
  const cancelButton = document.getElementById("cancelMigrationButton");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      const dialog = document.getElementById(
        "migrationDialog",
      ) as HTMLDivElement;
      dialog.style.display = "none";
    });
  }
});
