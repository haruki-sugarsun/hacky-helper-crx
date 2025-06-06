# Design Doc: Tabs UI

Tabs UI is an extention component

# Related Files

- tabs.html
- src/tabs.ts
- src/tabs.css
- src/features/search_functionality.ts
- src/features/session_management.ts
- src/features/tab_categorization.ts
- src/features/service-worker-interface.ts
- src/ui/search_bar.ts
- src/ui/search_results.css

# UI Layout

```
 Header
───────────┬────────────────────────────────
(Sessions) │ (Tabs)
...........│ [Session Name]
[Named  ]  │ [Open Tabs  ] [Saved Bookmarks]
[Unnamed]  │ [Synced Tabs]
[Closed ]  │
```

# Detailed UI Functions

## Header Area (`Header`)

- We have global functions accsible from the header area.
- A user can search among the sessions using a search bar.
  - The search bar can be activated by '/' in Tabs UI or 'Alt+S' globally in thr browser.
- When showing the results, the user can select the results by cursor up/down.

### Universal Search for Sessions and Tabs

- Incremental search on user typing.
- Search results shows results for categorized into these:
  - Active Named Sessions
  - Closed Named Sessions
  - Open Tabs in any of the windows

## Sessions Area (`(Sessions)`)

- This is a Scroallable Area
- Sessions are sorted alphabetically in each categories.
- The action menu for session (active/unnamed) commonly has
  - Close window

### Named Sessions (`[Named]`)

- Named Sessions has action menu to trigger several actions:
  - Rename the session
  - Clone the session
  - Delete the session

### Unnamed Sessions (`[Unnamed]`)

### Closed Sessions (`[Closed]`)

## Tabs Area (`(Tabs)`)

- This is a Scroallable Area

### Drag-and-Drop Tab Migration

- Users can drag one or multiple tabs from the **"Open Tabs"** list (specifically, the `<tr>` elements representing tabs in the table body) and drop them onto a session list item (`<li>` element representing an active named or unnamed session) in the "Sessions Area".
- **User Flow & UI Feedback:**
  - **Selection:** Users can select multiple tabs using Shift+Click or Ctrl/Cmd+Click.
  - **Drag Start (`dragstart`):** When dragging starts on a tab row, the IDs of all selected tabs are stored in the `dataTransfer` object as JSON. A custom drag image (a small block showing the number of tabs being dragged) is created and set using `setDragImage`.
  - **Dragging:** Selected tab rows get a `dragging-multi` class for visual indication (e.g., slight opacity).
  - **Drag Over/Leave (`dragover`, `dragleave`):** As the dragged tabs move over a potential drop target (session list item), the target gets a `drag-over` class (e.g., highlighted border) to indicate it's a valid drop zone. This class is removed on `dragleave`.
  - **Drop (`drop`):** When the tabs are dropped onto a valid session item, the `drop` event is triggered on the list item. The `handleTabDrop` function in `src/tabs.ts` is called.
  - **Feedback:** The target list item briefly gets a `drag-success` class for visual confirmation.
- **Backend Logic:**
  - The `handleTabDrop` function retrieves the dragged tab IDs from `dataTransfer` and the target `windowId` or `sessionId` from the drop target element.
  - It then calls `migrateTabs` (if dropping onto an active window/session represented by `windowId`) or `migrateTabsToSession` (if dropping onto a closed session represented by `sessionId` - _Note: This part is currently marked as TODO in the code_).
  - `migrateTabs` uses the `serviceWorkerInterface` to send a `MIGRATE_TABS` message to the service worker.
  - The service worker's `handleMigrateTabs` function (in `src/features/service-worker-handler.ts`) receives the message and calls `SessionManagement.migrateTabsToWindow` (in `src/features/session-management.ts`), which uses `chrome.tabs.move` to perform the actual tab migration between windows.

### Session Name (`[Session Name]`)

### Open Tabs (`[Open Tabs]`)

- When viewing other session,
- Each
- Calculated LLM-based summary and keywords are shown in the table.
- When viewing the other session (!= session in the current window), we may have a button to "Bring (Migrate to the Current Session)".
  - We can consider some other wording too.

### Saved Bookmarkd (`[]`)

### Synced Tabs (`[Synced Tabs]`)

#### Actions (Buttons and menu)

(TODO: Add description about takeover.)
The "open" button has been added to the synced tabs section. This button allows users to open the URL of a synced tab in a new browser tab.

- **Position**: The button is displayed alongside the "Takeover" button for each synced tab.
- **Behavior**: When clicked, the button opens the tab's URL in a new browser tab. If the URL is missing, an error message is displayed.
- **Styling**: The button uses the same styling conventions as other action buttons in the UI.

# Interaction with Other Components

- Message-based interactions with the Service-Worker.
  - Necessary processing for Session Management (creation, deletion, renaming, syncing, migration) is mostly delegated to the Service-Worker via messages defined in `src/lib/constants.ts` and `src/features/service-worker-messages.ts`.
  - **Tab Migration:** When a user drops tabs onto a session, `tabs.ts` sends a `MIGRATE_TABS` message (via `serviceWorkerInterface`) to the service worker (`service-worker-handler.ts`), which then calls `SessionManagement.migrateTabsToWindow`.
  - Tabs UI also receives some events via messages and modify the UI.
    - Reloading the UI on Hotkey.
    - Focus the Search Bar on Hotkey.
