/**
 * Interface for tracking UI outdated state
 */
export interface UIState {
  isOutdated: boolean;
  lastUpdateTimestamp: number;
  outdatedReasons: string[]; // For debugging
  refreshInProgress: boolean;
}

/**
 * Interface for UI state change events
 */
export interface UIStateChangeEvent {
  type: "outdated" | "refreshing" | "refreshed";
  reason?: string;
  previousState: UIState;
  currentState: UIState;
}

/**
 * Callback function for UI state changes
 */
export type UIStateChangeListener = (event: UIStateChangeEvent) => void;

/**
 * Configuration for UI state management
 */
export interface UIStateConfig {
  enableDebugLogging?: boolean;
  maxOutdatedTime?: number; // Default: 30 minutes
}

/**
 * Encapsulated UI state management for tabs UI
 * Provides event-driven API for state changes and visual indicator management
 */
export class TabsUIStateManager {
  private state: UIState;
  private config: UIStateConfig;
  private listeners: UIStateChangeListener[] = [];

  constructor(config: UIStateConfig = {}) {
    this.config = {
      enableDebugLogging: false,
      maxOutdatedTime: 30 * 60 * 1000, // 30 minutes
      ...config,
    };

    this.state = {
      isOutdated: false,
      lastUpdateTimestamp: Date.now(),
      outdatedReasons: [],
      refreshInProgress: false,
    };

    this.log("TabsUIStateManager initialized");
  }

  // ================================
  // Public API - State Management
  // ================================

  /**
   * Get current UI state (immutable copy)
   */
  public getState(): Readonly<UIState> {
    return { ...this.state };
  }

  /**
   * Mark UI as outdated with reason
   */
  public markAsOutdated(reason: string): void {
    const previousState = { ...this.state };
    const timestamp = Date.now();

    this.state.isOutdated = true;
    this.state.lastUpdateTimestamp = timestamp;
    this.state.outdatedReasons.push(reason);

    this.log(
      `Marked as outdated: ${reason} at ${new Date(timestamp).toISOString()}`,
    );
    this.emitStateChange("outdated", reason, previousState);
  }

  /**
   * Clear outdated state after successful refresh
   */
  public clearOutdatedState(): void {
    const previousState = { ...this.state };
    const timestamp = Date.now();

    this.state.isOutdated = false;
    this.state.lastUpdateTimestamp = timestamp;
    this.state.outdatedReasons = [];
    this.state.refreshInProgress = false;

    this.log(`Cleared outdated state at ${new Date(timestamp).toISOString()}`);
    this.emitStateChange("refreshed", undefined, previousState);
  }

  /**
   * Set refresh in progress state
   */
  public setRefreshInProgress(inProgress: boolean): void {
    const previousState = { ...this.state };

    this.state.refreshInProgress = inProgress;

    this.log(`Refresh in progress: ${inProgress}`);
    if (inProgress) {
      this.emitStateChange("refreshing", undefined, previousState);
    }
  }

  /**
   * Check if UI should be force refreshed due to age
   */
  public shouldForceRefresh(): boolean {
    const now = Date.now();
    const timeSinceUpdate = now - this.state.lastUpdateTimestamp;
    return timeSinceUpdate > this.config.maxOutdatedTime!;
  }

  // ================================
  // Public API - Event Management
  // ================================

  /**
   * Add listener for state changes
   */
  public addEventListener(listener: UIStateChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener for state changes
   */
  public removeEventListener(listener: UIStateChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // ================================
  // Public API - Configuration
  // ================================

  /**
   * Enable/disable debug logging
   */
  public setDebugLogging(enabled: boolean): void {
    this.config.enableDebugLogging = enabled;
    this.log(`Debug logging ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Get debug information about current state
   */
  public getDebugInfo(): object {
    return {
      state: this.getState(),
      config: { ...this.config },
      timeSinceUpdate: Date.now() - this.state.lastUpdateTimestamp,
      shouldForceRefresh: this.shouldForceRefresh(),
      listenersCount: this.listeners.length,
    };
  }

  // ================================
  // Private Methods
  // ================================

  // TODO: We may have better logging? maybe using some lib?
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[TabsUIStateManager] ${message}`);
    }
  }

  private emitStateChange(
    type: UIStateChangeEvent["type"],
    reason: string | undefined,
    previousState: UIState,
  ): void {
    const event: UIStateChangeEvent = {
      type,
      reason,
      previousState,
      currentState: { ...this.state },
    };

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in UI state change listener:", error);
      }
    });
  }
}

// ================================
// Global Instance for Easy Access
// ================================

/**
 * Global instance of TabsUIStateManager for tabs.ts
 * Can be configured before first use
 */
export const tabsUIState = new TabsUIStateManager({
  enableDebugLogging: true, // Default for development
});

// ================================
// Convenience Functions
// ================================

/**
 * Create a visual indicator controller for UI state changes
 * TODO: Consider if this can/should be in the tabs.ts.
 */
export function createVisualIndicatorController(
  indicatorElement: HTMLElement,
  stateManager: TabsUIStateManager = tabsUIState,
): () => void {
  const showIndicator = () => {
    indicatorElement.classList.remove("hide");
    indicatorElement.classList.add("show", "pulse");
    indicatorElement.setAttribute("aria-hidden", "false");
  };

  const hideIndicator = () => {
    indicatorElement.classList.remove("show", "pulse");
    indicatorElement.classList.add("hide");
    indicatorElement.setAttribute("aria-hidden", "true");

    // After animation completes, ensure it's hidden
    setTimeout(() => {
      if (indicatorElement.classList.contains("hide")) {
        indicatorElement.style.display = "none";
      }
    }, 300);
  };

  const handleStateChange = (event: UIStateChangeEvent) => {
    switch (event.type) {
      case "outdated":
        indicatorElement.style.display = "block";
        // Small delay to ensure display change takes effect before animation
        setTimeout(() => showIndicator(), 10);
        break;
      case "refreshed":
        hideIndicator();
        break;
      case "refreshing":
        // Remove pulse animation during refresh
        indicatorElement.classList.remove("pulse");
        break;
    }
  };

  stateManager.addEventListener(handleStateChange);

  // Return cleanup function
  return () => {
    stateManager.removeEventListener(handleStateChange);
  };
}

/**
 * Create a focus-based refresh controller
 */
export function createFocusRefreshController(
  refreshCallback: () => Promise<void>,
  stateManager: TabsUIStateManager = tabsUIState,
): () => void {
  const handleRefresh = async (_reason: string) => {
    if (stateManager.getState().isOutdated) {
      stateManager.setRefreshInProgress(true);

      try {
        await refreshCallback();
        stateManager.clearOutdatedState();
      } catch (error) {
        console.error("Failed to refresh UI:", error);
        // Keep outdated state on error
      } finally {
        stateManager.setRefreshInProgress(false);
      }
    }
  };

  const handleFocus = () => handleRefresh("window-focus");
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      handleRefresh("visibility-change");
    }
  };
  const handlePageShow = () => handleRefresh("page-show");

  // Add event listeners
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", handlePageShow);

  // Return cleanup function
  return () => {
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", handlePageShow);
  };
}
