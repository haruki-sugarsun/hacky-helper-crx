# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps (UPDATE THIS SECTION TO TRACK THE CURRENT STATUS)

- **Feature:** Add "Pull Window" for unnamed session windows in the sessions action menu.
  - **UI Update:** Modify the action menu in **tabs.ts** to include a "Pull Window" option accessible from the Sessions UI.
  - **Event Handling:** Reuse the existing `pullWindow` event handler in **tabs.ts**, which calls **chrome.windows.getCurrent()** to retrieve the current window's details and initiates the pull action.
  - **Window Relocation:** The `pullWindow` function extracts the current window's position and, after retrieving the target session window via the session-to-window mapping, uses **chrome.windows.update()** to align the target window with the current window's position. Further refinement and testing are required.
  - **Testing:** Update unit tests in **src/features/session-management.test.ts** and conduct manual UI testing to ensure the target window relocates as expected.
  - **Documentation:** Update inline comments and documentation to clarify that the relocation logic is mainly implemented in **tabs.ts**, and that the session association remains unchanged.
  - **Status:** Event Handling, Window Relocation, and UI integration are fully implemented via the `pullWindow` function in **tabs.ts**. Unit tests in **src/features/session-management.test.ts** have been updated and are passing, and documentation has been revised.
