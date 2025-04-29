# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps

- Support dragging of multiple rows using selection by checkbox. **(In Progress)**
- Give visible interaction for the drop-target (li for sessions). **(Next)**
  - We would like to make sure "multiple selection" case also have a good visible feedback.
- Make the visible feedback of dragged rows with opacity e.g. 0.8. **(Next)**

### Affected Files

- **Primary File**: `src/tabs.ts`
- **Supporting Files**:
  - `src/tabs.css` for styling drag-and-drop interactions.
  - `src/ui/session-label.ts` if session labels need enhancements for drag-and-drop.

### Implementation Plan

#### Step 1: Drag Event Setup in Tab Rendering **(Completed)**

- **File**: `src/tabs.ts`
- **Details**:
  - Located the rendering logic for individual tab items.
  - Added the `draggable` attribute to each tab element.
  - Attached `dragstart` and `dragend` event listeners to handle drag initiation and cleanup.

#### Step 2: Drop Event Handling in Container **(In Progress)**

- **File**: `src/tabs.ts`
- **Details**:
  - Identify the parent container holding the tab elements.
  - Add a `dragover` event listener on the container to enable dropping (using `preventDefault`).
  - Attach a `drop` event listener to handle drop events, validate dragged data, and determine the correct insertion index.

#### Step 3: Multi-Row Dragging Support **(Next)**

- **File**: `src/tabs.ts`
- **Details**:
  - Add checkboxes to tab rows for multi-selection.
  - Modify `dragstart` to include all selected rows in the drag data.
  - Update `drop` logic to handle multiple rows being dropped at once.

#### Step 4: UI Integration and Visual Feedback **(Next)**

- **Files**: `src/tabs.ts`, `src/tabs.css`
- **Details**:
  - Enhance `updateUI()` to include visual cues (e.g., highlighting drop targets) during drag-and-drop operations.
  - Add a CSS class (e.g., `.drag-over`) to highlight drop targets.
  - Use `opacity: 0.8` for dragged elements.

#### Step 5: Unit Testing **(Pending)**

- **File**: `src/tabs.ts`
- **Details**:
  - Develop unit tests to simulate drag-and-drop events.
  - Verify that the tab order updates correctly in the session state.
  - Test edge cases such as invalid drop targets and rapid drag events.

### HTML/CSS Enhancements

- **HTML**:
  - Update tab rows to include `<input type="checkbox" class="tab-select-checkbox">`.
- **CSS**:
  - Add styles for `.drag-over` to highlight drop targets.
  - Add styles for `.dragging` to adjust the appearance of dragged elements.
