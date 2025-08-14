# Task: Implement "Pull All Windows" Action in Tabs UI

## Background
From `taskdocs/parking_lot.md`:
> Have a special menu in Tabs UI and Implement an action to apply "Pull Window" for all the existing windows

## Goal
- Add a menu or button in Tabs UI that allows the user to apply the "Pull Window" action to all open browser windows at once.
- The action should move all windows to the current window's position/size and focus them sequentially (or as appropriate).

## Subtasks
1. **UI Design**
   - Add a new menu item or button labeled "Pull All Windows" to the Tabs UI (e.g., in the session or global menu).
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

---

**Origin:** `taskdocs/parking_lot.md` line 51
**Status:** Not started
**Assignee:** (Unassigned)
