# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.

## Strategy and Next Steps (UPDATE THIS SECTION TO TRACK THE CURRENT STATUS)

- Change `displaySyncedTabs()` method to use proper type representing Synced open tabs.
- Show the owner of inactive open tabs in the Tabs UI.
- When syncing open tabs to the backend, only delete the tabs owned by the current instance.
- in Tabs UI, provide a feature to "takeover" the tabs opened by the other instances. This will open them in the current window, and update the owner fields.
