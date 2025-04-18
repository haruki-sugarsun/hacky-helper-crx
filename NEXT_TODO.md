# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.

## Strategy and Next Steps (UPDATE THIS SECTION TO TRACK THE CURRENT STATUS)

1. (src/sidepanel-helper.ts) Define a helper method `openSidePanel()` - **Implemented**.
2. (src/sidepanel-helper.ts) Implement the logic to open the sidepanel - **Implemented**.
3. (src/popup.ts) Add a button in the popup UI to open the sidepanel and attach an event listener to call `openSidePanel()` when clicked - **Implemented**.
4. (src/service-worker.ts) Add a global event listener to detect the hotkey and call `openSidePanel()` directly - **Implemented**.
