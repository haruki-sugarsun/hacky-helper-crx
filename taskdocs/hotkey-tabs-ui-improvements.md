## Analysis Notes (Captain Nova's Log)

- Hotkey handling is implemented globally in the extension (service-worker.ts), not in tabs.ts.
- The service worker listens for chrome.commands events and routes actions based on the existence of tabs.html:
  - If tabs.html is open: focuses/activates it and sends a message for further UI actions (e.g., focus search bar, switch mode).
  - If not open: opens tabs.html, then sends the message after a delay.
- This enables context-aware hotkey behavior and flexible UI routing.
- To extend: add more command cases in service-worker.ts, using the same existence-check pattern.
- UI-side (tabs.ts) should handle messages from the service worker to perform focus/mode switching.

"Don’t Panic"――ホットキーの航路は既に拡張しやすい設計だ。

---

# Task Plan: Hotkey Open-Tabs-Page Improvements

## Overview

Enhance the Tabs UI with hotkey support to:

- Focus the Tabs UI when a specific hotkey is pressed.
- Switch between different modes:
  - "Just refresh the Tabs table"
  - "Open Saved Bookmarks pane"

## Steps

### 1. Hotkey Detection

- Implement global or context-specific hotkey listener in the extension (likely in `tabs.ts`).
- Choose appropriate key combinations (configurable if possible).

### 2. Focus Tabs UI

- On hotkey press, programmatically focus the Tabs UI window or pane.
- Ensure accessibility and smooth user experience.

### 3. Mode Switching

- On repeated hotkey presses or with modifier keys, toggle between:
  - Refreshing the open tabs table.
  - Displaying the saved bookmarks pane.
- Update UI state and provide visual feedback for the current mode.

### 4. UI Updates

- Update `tabs.ts` and related UI components to support mode switching.
- Ensure the UI reflects the current mode clearly (e.g., highlight, label, etc.).

### 5. Testing

- Add/Update tests for hotkey handling and mode switching.
- Manual test: Verify hotkey focus and mode toggling work as intended.

### 6. Documentation

- Update `DEVPLANS.md` and `ARCHITECTURE.md` to document the new hotkey and mode logic.

---

**Status:** PLANNED

**Next:**

- Analyze `tabs.ts` for current hotkey and UI logic.
- Design hotkey and mode switching mechanism.
- Implement hotkey listener and mode toggling.
- Test and document.
