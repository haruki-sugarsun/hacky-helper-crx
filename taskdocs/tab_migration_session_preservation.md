# Implementation Plan: Keep Current Visible Session After Tab Migration

## Problem Statement

Currently, when migrating a tab from one window to another using the "Bring Here" or "Migrate" functionality in the Tabs UI, the UI reloads completely and resets to show the default window (usually the current window). This causes the user to lose their context of which session they were viewing, which disrupts workflow.

## Implementation Goal

Maintain the currently selected session's view in the Tabs UI after migrating tabs between windows, preserving the user's context and improving the user experience.

## Implementation Steps

### Step 1: Modify Single Tab Migration Function

Update the `migrateTab` function in `src/tabs.ts` to capture and maintain the currently selected session:

```typescript
async function migrateTab(tabId: number, windowId: number) {
  try {
    // Capture the currently selected session's window ID before migration
    const selectedSessionItem = document.querySelector(
      "#named_sessions li.selected, #tabs_sessions li.selected",
    );
    let currentlySelectedWindowId: number | undefined = undefined;

    if (selectedSessionItem) {
      // Try to get the window ID associated with this selected session
      const sessionId = selectedSessionItem.getAttribute("data-session-id");
      if (sessionId) {
        // For named sessions
        const session = state_sessions.find((s) => s.id === sessionId);
        if (session && session.windowId) {
          currentlySelectedWindowId = session.windowId;
        }
      } else {
        // For unnamed sessions
        // Extract window ID from the session-label element
        const sessionLabel = selectedSessionItem.querySelector("session-label");
        if (sessionLabel) {
          const labelText = sessionLabel.getAttribute("label") || "";
          const windowIdMatch = labelText.match(/Window (\d+)/);
          if (windowIdMatch && windowIdMatch[1]) {
            currentlySelectedWindowId = parseInt(windowIdMatch[1], 10);
          }
        }
      }
    }

    const response = await chrome.runtime.sendMessage({
      type: MIGRATE_TAB,
      payload: {
        tabId,
        windowId,
      },
    });

    if (response && response.type === "MIGRATE_TAB_RESULT") {
      console.log("Tab migrated successfully:", response.payload);

      // Refresh the UI with tab information, but maintain the selected session
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows, currentlySelectedWindowId);
        });
      });
    } else {
      console.error("Error migrating tab:", response);
    }
  } catch (error) {
    console.error("Error sending migrate tab message:", error);
  }
}
```

### Step 2: Modify Multiple Tab Migration Function

Similarly update the `migrateMultipleTabs` function with the same pattern:

```typescript
async function migrateMultipleTabs(tabIds: number[], windowId: number) {
  try {
    // Capture the currently selected session's window ID before migration
    const selectedSessionItem = document.querySelector(
      "#named_sessions li.selected, #tabs_sessions li.selected",
    );
    let currentlySelectedWindowId: number | undefined = undefined;

    // Same window ID extraction logic as in migrateTab
    if (selectedSessionItem) {
      // Extract window ID (same logic as in migrateTab)
      // ...
    }

    const response = await chrome.runtime.sendMessage({
      type: MIGRATE_TAB,
      payload: {
        tabIds,
        windowId,
      },
    });

    if (response && response.type === "MIGRATE_TAB_RESULT") {
      console.log("Tabs migrated successfully:", response.payload);

      // Refresh the UI with tab information, but maintain the selected session
      chrome.windows.getAll({ populate: true }).then((windows) => {
        state_windows = windows;
        chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          state_tabs = tabs;
          updateUI(state_windows, currentlySelectedWindowId);
        });
      });
    } else {
      console.error("Error migrating tabs:", response);
    }
  } catch (error) {
    console.error("Error sending migrate tabs message:", error);
  }
}
```

### Step 3: Verify the updateUI Function

Ensure the `updateUI` function correctly uses the `selectedSessionByWindowId` parameter:

```typescript
async function updateUI(
  windows: chrome.windows.Window[],
  selectedSessionByWindowId?: number /* Optionally specify the session to be opened after the UI refresh by windowId. Select the current if undefined. */,
) {
  // Existing logic to fetch and sort sessions...

  // In the loop that creates session list items:
  for (const session of sortedNamedSessions) {
    // Find the window associated with this session
    const win = sortedWindows.find((w) => w.id === session.windowId);
    if (!win) continue; // Skip if window not found

    // Create list item...

    if (selectedSessionByWindowId && selectedSessionByWindowId === win.id) {
      selectedWindowId = selectedSessionByWindowId;
      selectedWindowItem = listItem;
    }

    // Add to list...
  }

  // Same for unnamed sessions...

  // Make sure the selection is preserved even when dealing with closed sessions
}
```

### Step 4: Implementation of Helper Functions

We may need utility functions to extract window IDs consistently:

```typescript
/**
 * Helper function to extract window ID from a selected session element
 * @returns Window ID if found, undefined otherwise
 */
function getWindowIdFromSelectedSession(): number | undefined {
  const selectedSessionItem = document.querySelector(
    "#named_sessions li.selected, #tabs_sessions li.selected",
  );
  if (!selectedSessionItem) return undefined;

  // Try getting window ID from named session
  const sessionId = selectedSessionItem.getAttribute("data-session-id");
  if (sessionId) {
    const session = state_sessions.find((s) => s.id === sessionId);
    return session?.windowId;
  }

  // Try getting window ID from unnamed session label
  const sessionLabel = selectedSessionItem.querySelector("session-label");
  if (sessionLabel) {
    const labelText = sessionLabel.getAttribute("label") || "";
    const windowIdMatch = labelText.match(/Window (\d+)/);
    if (windowIdMatch && windowIdMatch[1]) {
      return parseInt(windowIdMatch[1], 10);
    }
  }

  return undefined;
}
```

### Step 5: Testing

Test the implementation with the following scenarios:

1. Select a named session, then migrate a tab from another session

   - Expected result: The UI should remain showing the originally selected named session

2. Select an unnamed session (window), then migrate a tab from another session

   - Expected result: The UI should remain showing the originally selected window

3. Migrate multiple tabs

   - Expected result: The UI should continue showing the originally selected session/window

4. Edge case: If the selected session is closed during migration
   - Expected result: Fall back to the default behavior (current window)

## Benefits

- Improved user experience by maintaining context during tab migrations
- Reduced disruption to user workflow
- Consistent behavior across single and multiple tab migrations

## Follow-up Tasks

- Add unit tests for the new functionality
- Consider adding this behavior to other operations that refresh the UI
- Update documentation to reflect the new behavior
