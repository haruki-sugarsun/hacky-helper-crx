# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps (UPDATE THIS SECTION TO TRACK THE CURRENT STATUS)

- **Feature:** Add "Pull Window" in the sessions action menu.
  - **UI Update:** Modify the action menu in **tabs.ts** to include a "Pull Window" option accessible from the Sessions UI.
  - **Event Handling:** In **tabs.ts**, implement an event handler for the "Pull Window" option that calls **chrome.windows.getCurrent()** to retrieve the current window's details.
  - **Window Relocation:** Once the current window's details are obtained, extract its position (e.g., top and left coordinates). Retrieve the target window's details via the session-to-window mapping. Then, use Chrome’s **chrome.windows.update()** API to reposition the target window so that its on-screen placement (top and left values) aligns with the active window—effectively "pulling" the window—without modifying the session’s window association.
  - **Testing:** Update unit tests in **src/features/session-management.test.ts** and conduct manual UI testing to ensure the target window relocates as expected.
  - **Documentation:** Update inline comments and documentation to clarify that the relocation logic is mainly implemented in **tabs.ts**, and that the session association remains unchanged.
