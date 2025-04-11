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

### Named Sessions (`[Named]`)

- Named Sessions has action menu to trigger several actions:
  - Rename the session
  - Clone the session
  - Delete the session

### Unnamed Sessions (`[Unnamed]`)

### Closed Sessions (`[Closed]`)

## Tabs Area (`(Tabs)`)

- This is a Scroallable Area

### Session Name (`[Session Name]`)

### Open Tabs (`[Open Tabs]`)

- When viewing other session,
- Each
- Calculated LLM-based summary and keywords are shown in the table.
- When viewing the other session (!= session in the current window), we may have a button to "Bring (Migrate to the Current Session)".
  - We can consider some other wording too.

### Saved Bookmarkd (`[]`)

### Synced Tabs (`[Synced Tabs]`)

# Interaction with Other Components

- Message-based interactions with the Service-Worker.
  - Necessary processing for Session Management is mostly delegated to the Service-Worker via messages.
  - Tabs UI also receives some events via messages and modify the UI.
    - Reloading the UI on Hotkey.
    - Focus the Search Bar on Hotkey.
