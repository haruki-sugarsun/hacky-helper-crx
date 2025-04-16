# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps

Affected File: src/tabs.ts  
Methods to implement: updateUI(), updateTabsTable() (update migration controls integration)  
Identify the section in updateUI() responsible for rendering tab items and their container handling.

- Implement tab migration in Tabs UI via drag-n-drop with assigned change steps:

  - **Step 1: Drag Event Setup in Tab Rendering**
    - In updateUI(), locate the rendering logic for individual tab items (e.g., a function like renderTabItem).
    - Add the `draggable` attribute to each tab element.
    - Attach a `dragstart` event listener to capture initial drag data (starting position and tab identifier).
    - Attach a `dragend` event listener to perform necessary cleanup.
  - **Step 2: Drop Event Handling in Container**
    - In updateUI(), identify the parent container holding the tab elements.
    - Add a `dragover` event listener on the container to enable dropping (using preventDefault).
    - Attach a `drop` event listener to handle drop events, validate dragged data, and determine the correct insertion index.
  - **Step 3: State Update for Tab Sessions**
    - In updateUI() or its helper functions, implement logic to compute the new tab order after a drop event.
    - Update the underlying tab session state with the new order and persist these changes.
  - **Step 4: UI Integration and Visual Feedback**
    - Enhance updateUI() to include visual cues (e.g., highlighting drop targets) during drag-n-drop operations.
    - Optionally add conditional rendering of migration controls based on the current state.
  - **Step 5: Unit Testing**
    - Develop unit tests to simulate drag and drop events.
    - Verify that the tab order updates correctly in the session state.
    - Test edge cases such as invalid drop targets and rapid drag events.
