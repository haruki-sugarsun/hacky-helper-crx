# Documentation Update Plan

This document outlines the plan to update `ARCHITECTURE.md` and files within the `designdocs` directory based on recent changes.

## Recent Changes Summary

-   **Strategy/Parking Lot Updates:** `parking_lot.md` and related strategy documents were updated.
-   **Sync Label Change:** "Force Sync to Bookmarks" changed to "Force Sync to Backend".
-   **Drag-and-Drop Tab Migration:** Implemented drag-and-drop functionality for moving tabs between sessions/windows.
-   **Testing Framework Migration:** Migrated tests from Jest to Vitest.

## Update Tasks

### 1. `ARCHITECTURE.md`

-   **Testing:** Update the testing section to reflect the migration from Jest to Vitest. Mention the rationale and any impact on the testing strategy.
-   **UI Components / Tab Management:** Incorporate details about the new drag-and-drop functionality for tab migration. Explain how it fits into the overall architecture.
-   **Service Worker / Sync Logic:** Review and update sections related to the service worker and data synchronization to reflect the "Force Sync to Backend" label change and any underlying logic adjustments.

### 2. `designdocs/tabs_ui.md`

-   **User Interaction:** Add a section detailing the drag-and-drop functionality for tab migration. Describe the user flow and visual feedback.
-   **Component Interaction:** Explain how the drag-and-drop feature interacts with other UI components and the backend logic (e.g., `tab-organizer.ts`).

### 3. `designdocs/concepts.md`

-   **Tab Migration:** Review the concept of tab migration to ensure it accurately reflects the addition of drag-and-drop capabilities.
-   **Synchronization:** Verify that the description of data synchronization aligns with the recent changes ("Force Sync to Backend").

### 4. `designdocs/bookmark_storage_encodings.md`

-   **Review:** Briefly review to confirm that recent synchronization logic changes have not impacted bookmark storage encoding. Update if necessary (low probability).
