// Message types for Side Panel.
export const SP_TRIGGER = "SP_TRIGGER";
export const TB_TOGGLE_BOOKMARKS_PANE = "TB_TOGGLE_BOOKMARKS_PANE";

// ================================
// UI State Management Messages (Task 2.1)
// ================================

/**
 * Message type for marking tabs UI as outdated
 * Sent from service worker to tabs UI when tab/window events occur
 */
export const TABS_MARK_UI_OUTDATED = "TABS_MARK_UI_OUTDATED";

// ================================
// UI State Management Message Types (Task 2.1)
// ================================

/**
 * Message sent from service worker to tabs UI to mark it as outdated
 */
export interface TabsUIOutdatedMessage {
  type: "TABS_MARK_UI_OUTDATED";
  reason: string;
  timestamp: number;
}
