# Task: Implement "Pull All Windows" Action in Tabs UI

## Background

From `taskdocs/parking_lot.md`:

> Have a special menu in Tabs UI and Implement an action to apply "Pull Window" for all the existing windows

## Goal

- Add a menu or button in Tabs UI that allows the user to apply the "Pull Window" action to all open browser windows at once.
- The action should move all windows to the current window's position/size and focus them sequentially (or as appropriate).

## Subtasks

1. **UI Design**
   - Add a new global menu element (e.g., dropdown or button) for "Pull All Windows" in Tabs UI.
   - Place this menu next to the "settings" link in `tabs.html` header for visibility and consistency.
2. **Implementation**
   - In `src/tabs.ts`, implement a handler for the new action.
   - Use `chrome.windows.getAll()` to enumerate all windows.
   - For each window, call the existing `pullWindow(windowId)` logic, skipping the current window.
3. **Feedback**
   - Show a toast or log message for each window pulled, or a summary at the end.
   - Optionally, add a confirmation dialog before executing the action.
4. **Testing**
   - Verify that all windows are moved/focused as expected.
   - Ensure the UI remains responsive and no window is skipped.

## Notes

- Reuse the existing `pullWindow` function for consistency.
- Consider edge cases: minimized windows, windows on other displays, etc.
- Document the new feature in `README.md` and update any relevant UI docs.
- UI placement: The global menu for this action should be adjacent to the settings link in the header of `tabs.html`.

---

**Origin:** `taskdocs/parking_lot.md` line 51
**Status:** Not started
**Assignee:** (Unassigned)
