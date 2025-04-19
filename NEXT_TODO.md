# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.

## Strategy and Next Steps (UPDATE THIS SECTION TO TRACK THE CURRENT STATUS)

1. (src/sidepanel.ts) Implement side-panel's onMessage handler - **Implemented**.
2. (src/sidepanel.ts) On a message with type SP_TRIGGER, sendResponse an ack SuccessResult - **Implemented**.
3. (...) in the hotkey handler for open-side-panel, in service-worker impl, send SP_TRIGGER message before opening the sidepanel - **Implemented**.
4. (...) on SP_TRIGGER message, in sidepanel, if that panel is the currently focused, foreground window, click the "inspect page" as the primal action - **Implemented**.
