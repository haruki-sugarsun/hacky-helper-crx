# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.

## Strategy and Next Steps (UPDATE THIS SECTION TO TRACK THE CURRENT STATUS)

- Change `displaySyncedTabs()` method to use proper type representing Synced open tabs.
- Show the owner of inactive open tabs in the Tabs UI.
- When syncing open tabs to the backend, only delete the tabs owned by the current instance.

  1. Implement `handleTakeoverTab()` in `src/features/service-worker-handler.ts`:
     - Receive the backend tab ID (bookmark ID) as input.
     - Open the URL associated with the bookmark ID in the window of the session.
     - Overwrite the owner of the tab in the backend to reflect the current instance.
  2. Test the implementation to ensure proper functionality and no unintended side effects.

- In Tabs UI, provide a feature to "takeover" the tabs opened by the other instances. This will open them in the current window, and update the owner fields.
  1. Modify `tabs.html` to include a button for the "takeover" action.
  2. Update `src/tabs.ts` to handle the button's click event.
  3. Test the feature to ensure proper functionality and UI responsiveness.
