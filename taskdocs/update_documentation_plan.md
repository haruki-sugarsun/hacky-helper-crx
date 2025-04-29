# Documentation Update Plan (Revised)

This document outlines the plan to update `ARCHITECTURE.md` and files within the `designdocs` directory based on recent changes and code analysis.

## Recent Changes & Implementation Details

-   **Strategy/Parking Lot Updates:** `parking_lot.md` and related strategy documents were updated.
-   **Sync Label Change:** "Force Sync to Bookmarks" changed to "Force Sync to Backend" in the UI (`src/tabs.ts`). The corresponding message type is `SYNC_SESSION_TO_BOOKMARKS` handled in `service-worker.ts` which calls `SessionManagement.syncSessionToBackend`.
-   **Drag-and-Drop Tab Migration:** Implemented drag-and-drop functionality for moving tabs between sessions/windows in `tabs.html`/`src/tabs.ts`.
    -   **UI:** Uses `dragstart`, `dragover`, `dragleave`, `drop`, `dragend` events. Visual feedback via CSS classes (`drag-over`, `drag-success`, `dragging-multi`). Uses a temporary `dragImageBlock` element.
    -   **Logic:** `handleTabDrop` function in `src/tabs.ts` determines the target (windowId or sessionId).
    -   **Backend:** Calls `migrateTabs` (for window targets) or `migrateTabsToSession` (for session targets, currently marked as TODO) in `src/tabs.ts`, which sends `MIGRATE_TABS` message via `serviceWorkerInterface`.
    -   **Service Worker:** `handleMigrateTabs` in `service-worker-handler.ts` processes the message, calling `SessionManagement.migrateTabsToWindow`. Migration *to closed sessions* is noted as a TODO in `service-worker-handler.ts` and `parking_lot.md`.
-   **Testing Framework Migration:** Migrated tests from Jest to Vitest. Test files (`*.test.ts`) exist in `src/features/` and `src/features/bookmark-storage/`.

## Update Tasks

### 1. `ARCHITECTURE.md`

-   **Testing:** Update the testing section to reflect the migration from Jest to **Vitest**. Mention the rationale (e.g., speed, Vite integration) and list the key test files (`service-worker-handler.test.ts`, `session-management.test.ts`, `bookmark-storage.test.ts`).
-   **UI Components / Tab Management (`tabs.html`, `tabs.ts`):** Incorporate details about the drag-and-drop functionality. Explain the event flow (`dragstart` -> `setDragImage` -> `dragover/leave` -> `drop` -> `handleTabDrop`). Mention the use of CSS for visual feedback.
-   **Service Worker / Message Handling:**
    -   Clarify the message handling split between `service-worker.ts` and `service-worker-handler.ts`.
    -   Update the description of the `MIGRATE_TABS` message handling in `service-worker-handler.ts` to include the call to `SessionManagement.migrateTabsToWindow`. Note the TODO for migrating to closed sessions.
    -   Reflect the "Force Sync to Backend" terminology change. Update the description of the `SYNC_SESSION_TO_BOOKMARKS` message handling and its connection to `SessionManagement.syncSessionToBackend`.
-   **Data Flow / Tab Management:** Update the data flow description for tab migration via drag-and-drop.

### 2. `designdocs/tabs_ui.md`

-   **UI Layout:** Ensure the layout diagram is still accurate.
-   **Detailed UI Functions / Drag-and-Drop Tab Migration:**
    -   Expand this section significantly. Describe the user flow: selecting tab(s), dragging, visual feedback on draggable items and drop targets (`drag-over` class), dropping onto a session list item.
    -   Mention the multi-select drag capability.
    -   Clarify that dropping triggers `handleTabDrop` which then communicates with the service worker. Update the reference from `tab-organizer.ts` to the correct backend logic flow (`tabs.ts` -> `service-worker-interface.ts` -> `service-worker-handler.ts` -> `session-management.ts`).
-   **Interaction with Other Components:** Update the description of message interactions related to tab migration (`MIGRATE_TABS`).

### 3. `designdocs/concepts.md`

-   **Session / Tab Migration:** Review and update the concept of tab migration to explicitly include drag-and-drop as a method, alongside button clicks. Mention the distinction between migrating to an active window vs. a (future) closed session.
-   **Data Storage/Synchronization / Backend Storage:** Verify that the description aligns with the "Force Sync to Backend" terminology and the role of `SessionManagement.syncSessionToBackend`. Ensure the concept of "Backend Storage" (currently Bookmarks) is clear.

### 4. `designdocs/bookmark_storage_encodings.md`

-   **Review:** Briefly review to confirm that recent synchronization logic changes (`syncSessionToBackend`) have not impacted bookmark storage encoding details. Update if necessary (still low probability).

## Next Steps

1.  Apply the proposed changes to `taskdocs/update_documentation_plan.md`.
2.  Proceed with updating the individual documentation files (`ARCHITECTURE.md`, `designdocs/tabs_ui.md`, `designdocs/concepts.md`) based on this revised plan.
