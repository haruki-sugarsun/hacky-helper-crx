import "./style.css";
import "./popup.css";
import { CONFIG_STORE } from "./config_store";

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
  const llmEnabled = await CONFIG_STORE.get("LLM_ENABLED");
  const disableOnBattery = await CONFIG_STORE.get("DISABLE_LLM_ON_BATTERY");

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

// Initialize the UI when the document is loaded
document.addEventListener("DOMContentLoaded", async () => {
  await initializeToggles();
});
